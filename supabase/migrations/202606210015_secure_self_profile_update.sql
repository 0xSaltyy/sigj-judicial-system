-- Allow the protected owner to update safe self-profile placement fields only
-- through an authenticated RPC, while preserving all owner invariants.
insert into public.role_permission_rules(role,resource,action,allowed)
select 'AUXILIAR'::public.app_role,known.resource,known.action,false
from (select distinct resource,action from public.role_permission_rules) known
on conflict(role,resource,action) do nothing;

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
    not new.is_owner or new.role<>'SUPER_ADMIN' or not new.is_active
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

create or replace function public.update_self_profile_secure(p_payload jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare
  v_actor public.profiles%rowtype;
  v_institution uuid:=nullif(p_payload->>'institution_id','')::uuid;
  v_dependency uuid:=nullif(p_payload->>'dependency_id','')::uuid;
  v_public_institution uuid:=nullif(p_payload->>'public_institution_id','')::uuid;
  v_public_dependency uuid:=nullif(p_payload->>'public_dependency_id','')::uuid;
  v_public_profile boolean:=coalesce((p_payload->>'public_profile')::boolean,false);
begin
  select * into v_actor from public.profiles where id=auth.uid() and is_active for update;
  if not found then raise exception 'El perfil institucional no está disponible'; end if;
  if not public.has_effective_permission('perfil','edit') then raise exception 'No tiene permiso para editar su perfil'; end if;

  if v_institution is distinct from v_actor.institution_id
     and not public.has_effective_permission('perfil','edit_institution') then
    raise exception 'No tiene permiso para cambiar su institución';
  end if;
  if v_dependency is distinct from v_actor.dependency_id
     and not public.has_effective_permission('perfil','edit_dependency') then
    raise exception 'No tiene permiso para cambiar su dependencia o despacho';
  end if;
  if nullif(trim(p_payload->>'position_title'),'') is distinct from v_actor.position_title
     and not public.has_effective_permission('perfil','edit_title') then
    raise exception 'No tiene permiso para cambiar su cargo institucional';
  end if;
  if v_public_profile is distinct from v_actor.public_profile
     and not public.has_effective_permission('perfil','publish_profile') then
    raise exception 'No tiene permiso para publicar su perfil';
  end if;
  if (
    nullif(trim(p_payload->>'public_display_name'),'') is distinct from v_actor.public_display_name
    or nullif(trim(p_payload->>'public_title'),'') is distinct from v_actor.public_title
    or nullif(trim(p_payload->>'public_bio'),'') is distinct from v_actor.public_bio
    or nullif(trim(p_payload->>'public_phone'),'') is distinct from v_actor.public_phone
    or v_public_institution is distinct from v_actor.public_institution_id
    or v_public_dependency is distinct from v_actor.public_dependency_id
  ) and not public.has_effective_permission('perfil','edit_public') then
    raise exception 'No tiene permiso para editar la identidad pública';
  end if;

  if v_institution is not null and not exists(select 1 from public.dependencies where id=v_institution and is_active and archived_at is null) then
    raise exception 'La institución seleccionada no está disponible';
  end if;
  if v_dependency is not null and not exists(select 1 from public.dependencies where id=v_dependency and is_active and archived_at is null) then
    raise exception 'La dependencia seleccionada no está disponible';
  end if;
  if v_dependency is not null and v_institution is not null and not public.dependency_is_within(v_dependency,v_institution) then
    raise exception 'La dependencia no pertenece a la institución seleccionada';
  end if;
  if not v_actor.is_owner and (
    (v_public_institution is not null and v_public_institution is distinct from v_institution)
    or (v_public_dependency is not null and v_public_dependency is distinct from v_dependency)
  ) then raise exception 'La identidad pública debe coincidir con su asignación institucional'; end if;

  perform set_config('sigj.self_profile_update','yes',true);
  update public.profiles set
    full_name=trim(p_payload->>'full_name'),
    position_title=case when public.has_effective_permission('perfil','edit_title') then nullif(trim(p_payload->>'position_title'),'') else position_title end,
    institution_id=case when public.has_effective_permission('perfil','edit_institution') then v_institution else institution_id end,
    dependency_id=case when public.has_effective_permission('perfil','edit_dependency') then v_dependency else dependency_id end,
    public_display_name=case when public.has_effective_permission('perfil','edit_public') then nullif(trim(p_payload->>'public_display_name'),'') else public_display_name end,
    public_title=case when public.has_effective_permission('perfil','edit_public') then nullif(trim(p_payload->>'public_title'),'') else public_title end,
    public_bio=case when public.has_effective_permission('perfil','edit_public') then nullif(trim(p_payload->>'public_bio'),'') else public_bio end,
    public_phone=case when public.has_effective_permission('perfil','edit_public') then nullif(trim(p_payload->>'public_phone'),'') else public_phone end,
    public_institution_id=case when public.has_effective_permission('perfil','edit_public') then v_public_institution else public_institution_id end,
    public_dependency_id=case when public.has_effective_permission('perfil','edit_public') then v_public_dependency else public_dependency_id end,
    public_profile=case when public.has_effective_permission('perfil','publish_profile') then v_public_profile else public_profile end
  where id=v_actor.id;
  return true;
end $$;
revoke all on function public.update_self_profile_secure(jsonb) from public,anon;
grant execute on function public.update_self_profile_secure(jsonb) to authenticated;
notify pgrst,'reload schema';
