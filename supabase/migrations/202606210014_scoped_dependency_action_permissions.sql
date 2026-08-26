-- Normalize dependency administration around create/edit while preserving the
-- legacy manage permission as an umbrella. A specific user override always
-- wins, so "deny create" cannot be bypassed by a role-level manage grant.
insert into public.role_permission_rules(role,resource,action,allowed)
select role,'dependencias',action,false
from unnest(enum_range(null::public.app_role)) role
cross join unnest(array['create','edit']) action
on conflict(role,resource,action) do nothing;

update public.role_permission_rules set allowed=true
where role in ('SUPER_ADMIN','ADMIN_INSTITUCIONAL')
  and resource='dependencias' and action in ('create','edit');

create or replace function public.can_manage_dependency_action(
  p_action text,
  p_user_id uuid default auth.uid()
) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare
  v_profile public.profiles%rowtype;
  v_effect public.permission_effect;
begin
  if p_user_id is null or p_action not in ('create','edit') then return false; end if;
  if p_user_id is distinct from auth.uid() and not public.is_owner() then return false; end if;
  select * into v_profile from public.profiles where id=p_user_id and is_active;
  if not found then return false; end if;
  if v_profile.is_owner or v_profile.role='SUPER_ADMIN' then return true; end if;

  select effect into v_effect from public.user_permission_overrides
  where user_id=p_user_id and resource='dependencias' and action=p_action;
  if v_effect='deny' then return false; end if;
  if v_effect='allow' then return true; end if;

  return public.has_effective_permission('dependencias',p_action,p_user_id)
    or public.has_effective_permission('dependencias','manage',p_user_id)
    or public.has_effective_permission('instituciones','manage',p_user_id);
end $$;
revoke all on function public.can_manage_dependency_action(text,uuid) from public,anon;
grant execute on function public.can_manage_dependency_action(text,uuid) to authenticated,service_role;

create or replace function public.save_dependency_scoped(p_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_actor public.profiles%rowtype;
  v_root uuid;
  v_parent uuid;
  v_result uuid;
  v_old public.dependencies%rowtype;
  v_action text:=case when p_id is null then 'create' else 'edit' end;
  v_global boolean:=false;
begin
  select * into v_actor from public.profiles where id=auth.uid() and is_active;
  if not found then raise exception 'Su perfil no está activo o disponible'; end if;
  if not public.can_manage_dependency_action(v_action,auth.uid()) then
    raise exception '%',case when v_action='create' then 'No tiene permiso para crear dependencias' else 'No tiene permiso para editar dependencias' end;
  end if;

  v_global:=v_actor.is_owner or v_actor.role='SUPER_ADMIN';
  v_parent:=nullif(p_payload->>'parent_id','')::uuid;
  if not v_global then
    v_root:=coalesce(v_actor.institution_id,v_actor.dependency_id);
    if v_root is null then raise exception 'Su perfil no tiene alcance institucional suficiente'; end if;
    if v_parent is null or not public.dependency_is_within(v_parent,v_root) then
      raise exception 'Solo puede administrar dependencias dentro de su institución';
    end if;
    if p_id is not null and not public.dependency_is_within(p_id,v_root) then
      raise exception 'Esta dependencia pertenece a otra institución';
    end if;
    if p_id is not null and p_id=v_actor.institution_id
       and not public.has_effective_permission('instituciones','manage') then
      raise exception 'No tiene permiso para editar la institución raíz';
    end if;
  end if;

  if p_id is not null then
    select * into v_old from public.dependencies where id=p_id for update;
    if not found then raise exception 'La dependencia ya no está disponible'; end if;
    if v_parent=p_id or (v_parent is not null and public.dependency_is_within(v_parent,p_id)) then
      raise exception 'La dependencia superior produciría un ciclo';
    end if;
    update public.dependencies set
      parent_id=v_parent,name=trim(p_payload->>'name'),code=upper(trim(p_payload->>'code')),
      type=trim(p_payload->>'type'),level=(p_payload->>'level')::smallint,
      description=nullif(trim(p_payload->>'description'),''),competence=trim(p_payload->>'competence'),
      jurisdiction=trim(p_payload->>'jurisdiction'),route_slug=trim(p_payload->>'route_slug'),
      department=trim(p_payload->>'department'),municipality=trim(p_payload->>'municipality'),
      is_active=(p_payload->>'is_active')::boolean,public_visible=(p_payload->>'public_visible')::boolean
    where id=p_id returning id into v_result;
  else
    insert into public.dependencies(parent_id,name,code,type,level,description,competence,jurisdiction,route_slug,department,municipality,is_active,public_visible)
    values(v_parent,trim(p_payload->>'name'),upper(trim(p_payload->>'code')),trim(p_payload->>'type'),
      (p_payload->>'level')::smallint,nullif(trim(p_payload->>'description'),''),trim(p_payload->>'competence'),
      trim(p_payload->>'jurisdiction'),trim(p_payload->>'route_slug'),trim(p_payload->>'department'),
      trim(p_payload->>'municipality'),(p_payload->>'is_active')::boolean,(p_payload->>'public_visible')::boolean)
    returning id into v_result;
  end if;

  perform public.log_security_event(
    case when p_id is null then 'DEPENDENCY_CREATED' else 'DEPENDENCY_UPDATED' end,
    'dependencies',v_result,'Dependencia gestionada dentro del alcance autorizado',
    jsonb_build_object('parent_id',v_parent,'permission_action',v_action)
  );
  return v_result;
end $$;
revoke all on function public.save_dependency_scoped(uuid,jsonb) from public,anon;
grant execute on function public.save_dependency_scoped(uuid,jsonb) to authenticated;

notify pgrst,'reload schema';
