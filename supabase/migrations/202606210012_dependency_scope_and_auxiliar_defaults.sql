insert into public.role_permissions(role,label,scope_description,permissions,can_manage_users)
values('AUXILIAR','Auxiliar judicial','Apoyo documental y elaboración de borradores dentro de su dependencia.','["read_assigned_cases","upload_documents","draft_actions"]'::jsonb,false)
on conflict(role) do update set label=excluded.label,scope_description=excluded.scope_description,permissions=excluded.permissions,can_manage_users=false;

insert into public.role_permission_rules(role,resource,action,allowed)
select 'AUXILIAR'::public.app_role,v.resource,v.action,true from (values
 ('expedientes','view'),('providencias','view'),('providencias','create'),('providencias','edit'),('providencias','print'),
 ('actuaciones','view'),('actuaciones','create'),('audiencias','view'),('actas','view'),
 ('documentos','view'),('documentos','upload'),('documentos','preview'),('documentos','download'),
 ('firmas','view'),('enlaces','view'),('notificaciones','view'),('perfil','edit'),('perfil','edit_public'),('usuarios','edit_own')
) v(resource,action) on conflict(role,resource,action) do update set allowed=true;

update public.role_permission_rules set allowed=true
where role='ADMIN_INSTITUCIONAL' and resource='dependencias' and action='manage';

create or replace function public.save_dependency_scoped(p_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor public.profiles%rowtype; v_root uuid; v_parent uuid; v_result uuid; v_old public.dependencies%rowtype;
begin
  select * into v_actor from public.profiles where id=auth.uid() and is_active;
  if not found or not public.has_effective_permission('dependencias','manage') then
    perform public.log_security_event('DEPENDENCY_MANAGEMENT_DENIED','dependencies',p_id,'Intento de gestionar una dependencia sin permiso','{}'::jsonb);
    raise exception 'No tiene permiso para administrar dependencias';
  end if;
  v_parent:=nullif(p_payload->>'parent_id','')::uuid;
  if not v_actor.is_owner then
    if v_actor.role<>'ADMIN_INSTITUCIONAL' then raise exception 'La administración de dependencias no está disponible para su perfil'; end if;
    v_root:=coalesce(v_actor.institution_id,v_actor.dependency_id);
    if v_root is null or v_parent is null or not public.dependency_is_within(v_parent,v_root) then
      perform public.log_security_event('DEPENDENCY_SCOPE_DENIED','dependencies',p_id,'Intento de gestionar una dependencia fuera de la institución','{}'::jsonb);
      raise exception 'Solo puede gestionar dependencias dentro de su institución';
    end if;
    if p_id is not null and (p_id=v_root or not public.dependency_is_within(p_id,v_root)) then raise exception 'No puede editar la institución raíz ni dependencias externas'; end if;
  end if;
  if p_id is not null then
    select * into v_old from public.dependencies where id=p_id for update;
    if not found then raise exception 'La dependencia ya no está disponible'; end if;
    if v_parent=p_id or (v_parent is not null and public.dependency_is_within(v_parent,p_id)) then raise exception 'La dependencia superior produciría un ciclo'; end if;
    update public.dependencies set parent_id=v_parent,name=trim(p_payload->>'name'),code=upper(trim(p_payload->>'code')),type=trim(p_payload->>'type'),
      level=(p_payload->>'level')::smallint,description=nullif(trim(p_payload->>'description'),''),competence=trim(p_payload->>'competence'),
      jurisdiction=trim(p_payload->>'jurisdiction'),route_slug=trim(p_payload->>'route_slug'),department=trim(p_payload->>'department'),municipality=trim(p_payload->>'municipality'),
      is_active=(p_payload->>'is_active')::boolean,public_visible=(p_payload->>'public_visible')::boolean where id=p_id returning id into v_result;
  else
    insert into public.dependencies(parent_id,name,code,type,level,description,competence,jurisdiction,route_slug,department,municipality,is_active,public_visible)
    values(v_parent,trim(p_payload->>'name'),upper(trim(p_payload->>'code')),trim(p_payload->>'type'),(p_payload->>'level')::smallint,nullif(trim(p_payload->>'description'),''),trim(p_payload->>'competence'),trim(p_payload->>'jurisdiction'),trim(p_payload->>'route_slug'),trim(p_payload->>'department'),trim(p_payload->>'municipality'),(p_payload->>'is_active')::boolean,(p_payload->>'public_visible')::boolean)
    returning id into v_result;
  end if;
  perform public.log_security_event(case when p_id is null then 'DEPENDENCY_CREATED' else 'DEPENDENCY_UPDATED' end,'dependencies',v_result,'Dependencia gestionada dentro del alcance autorizado',jsonb_build_object('parent_id',v_parent));
  return v_result;
end $$;
revoke all on function public.save_dependency_scoped(uuid,jsonb) from public,anon;
grant execute on function public.save_dependency_scoped(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
