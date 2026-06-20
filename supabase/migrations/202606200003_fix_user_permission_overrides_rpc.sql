-- Repara la RPC de overrides individuales con una firma estable para PostgREST.
-- La migración es idempotente respecto de posibles firmas previas y fuerza la recarga del schema cache.
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

  if not found or not v_actor.is_owner or v_actor.role <> 'SUPER_ADMIN' then
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
grant execute on function public.replace_user_permission_overrides(uuid, jsonb, text) to authenticated, service_role;

notify pgrst, 'reload schema';
