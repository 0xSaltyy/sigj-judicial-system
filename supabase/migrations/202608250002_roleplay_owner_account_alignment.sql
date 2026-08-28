-- Align the protected owner account with the roleplay DOJ role model.
-- A protected owner may use role OWNER or ATTORNEY_GENERAL while keeping
-- position_title = Attorney General. This preserves legacy SUPER_ADMIN support.

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active
      and is_owner
      and role in ('SUPER_ADMIN','OWNER','ATTORNEY_GENERAL')
  )
$$;

create or replace function public.guard_profile_privileges() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_self_profile_update boolean:=coalesce(current_setting('sigj.self_profile_update',true),'')='yes';
begin
  if tg_op='DELETE' then
    if old.is_owner then raise exception 'The owner account cannot be deleted'; end if;
    if auth.uid() is not null and not public.is_owner() then raise exception 'Only the owner may delete profiles'; end if;
    return old;
  end if;

  if old.is_owner and (
    not new.is_owner
    or new.role not in ('SUPER_ADMIN','OWNER','ATTORNEY_GENERAL')
    or not new.is_active
    or new.email is distinct from old.email
  ) then raise exception 'The owner account is protected'; end if;

  if old.is_owner
     and (new.institution_id is distinct from old.institution_id or new.dependency_id is distinct from old.dependency_id)
     and not (auth.uid()=old.id and v_self_profile_update) then
    raise exception 'The owner institutional assignment is protected';
  end if;

  if (
    old.role is distinct from new.role or old.is_active is distinct from new.is_active
    or old.email is distinct from new.email or old.institution_id is distinct from new.institution_id
    or old.dependency_id is distinct from new.dependency_id or old.is_owner is distinct from new.is_owner
  ) and auth.uid() is not null and not public.is_owner()
    and not (auth.uid()=old.id and v_self_profile_update) then
    raise exception 'Only the owner may change user access';
  end if;
  return new;
end $$;

create or replace function public.has_effective_permission(
  p_resource text,
  p_action text,
  p_user_id uuid default auth.uid()
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype;
  v_effect public.permission_effect;
  v_allowed boolean;
  v_action text := p_action;
begin
  if p_user_id is null then return false; end if;
  if p_user_id is distinct from auth.uid() and not public.is_owner() then return false; end if;
  if p_resource = 'documentos' and p_action = 'create' then v_action := 'upload'; end if;
  select * into v_profile from public.profiles where id = p_user_id and is_active;
  if not found then return false; end if;
  if v_profile.is_owner and v_profile.role in ('SUPER_ADMIN','OWNER','ATTORNEY_GENERAL') then return true; end if;
  select effect into v_effect from public.user_permission_overrides
    where user_id = p_user_id and resource = p_resource and action = v_action;
  if v_effect = 'deny' then return false; end if;
  if v_effect = 'allow' then return true; end if;
  select allowed into v_allowed from public.role_permission_rules
    where role = v_profile.role and resource = p_resource and action = v_action;
  return coalesce(v_allowed, false);
end $$;

drop function if exists public.replace_user_permission_overrides(uuid, jsonb, text);
drop function if exists public.replace_user_permission_overrides(jsonb, text, uuid);

create function public.replace_user_permission_overrides(
  p_user_id uuid,
  p_entries jsonb,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_old_values jsonb;
  v_new_values jsonb;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_actor
  from public.profiles
  where id = auth.uid() and is_active;

  if not found or not v_actor.is_owner or v_actor.role not in ('SUPER_ADMIN','OWNER','ATTORNEY_GENERAL') then
    raise exception 'Only the protected owner may manage user permissions';
  end if;

  select * into v_target
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_target.is_owner then
    insert into public.audit_logs(
      user_id, target_user_id, action, table_name, record_id, description, metadata
    ) values (
      auth.uid(), p_user_id, 'OWNER_PERMISSION_OVERRIDE_DENIED',
      'user_permission_overrides', p_user_id,
      'Se impidió aplicar permisos personalizados a la cuenta propietaria protegida',
      jsonb_build_object('source', 'replace_user_permission_overrides')
    );
    return jsonb_build_object(
      'ok', false,
      'error', 'La cuenta propietaria protegida no admite permisos personalizados'
    );
  end if;

  if jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'Permission entries must be an array';
  end if;

  if p_reason is not null and char_length(trim(p_reason)) > 500 then
    raise exception 'Permission reason is too long';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_entries) as entry(resource text, action text, effect text)
    where entry.resource is null
      or entry.action is null
      or entry.effect not in ('allow', 'deny')
      or not exists (
        select 1
        from public.role_permission_rules rule
        where rule.resource = entry.resource and rule.action = entry.action
      )
  ) then
    raise exception 'One or more permission entries are invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_entries) as entry(resource text, action text, effect text)
    group by entry.resource, entry.action
    having count(*) > 1
  ) then
    raise exception 'Duplicate permission entries are not allowed';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'resource', resource,
    'action', action,
    'effect', effect,
    'reason', reason
  ) order by resource, action), '[]'::jsonb)
  into v_old_values
  from public.user_permission_overrides
  where user_id = p_user_id;

  delete from public.user_permission_overrides
  where user_id = p_user_id;

  insert into public.user_permission_overrides(
    user_id, resource, action, effect, reason, created_by
  )
  select
    p_user_id,
    entry.resource,
    entry.action,
    entry.effect::public.permission_effect,
    nullif(trim(p_reason), ''),
    auth.uid()
  from jsonb_to_recordset(p_entries) as entry(resource text, action text, effect text);

  get diagnostics v_count = row_count;

  select coalesce(jsonb_agg(jsonb_build_object(
    'resource', resource,
    'action', action,
    'effect', effect,
    'reason', reason
  ) order by resource, action), '[]'::jsonb)
  into v_new_values
  from public.user_permission_overrides
  where user_id = p_user_id;

  insert into public.audit_logs(
    user_id, target_user_id, action, table_name, record_id,
    description, old_values, new_values, metadata
  ) values (
    auth.uid(), p_user_id, 'USER_PERMISSION_OVERRIDES_REPLACED',
    'user_permission_overrides', p_user_id,
    'Permisos personalizados reemplazados desde la administración interna',
    v_old_values, v_new_values,
    jsonb_build_object('override_count', v_count, 'reason', nullif(trim(p_reason), ''))
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'override_count', v_count
  );
end $$;

revoke all on function public.replace_user_permission_overrides(uuid, jsonb, text) from public, anon;
grant execute on function public.replace_user_permission_overrides(uuid, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
