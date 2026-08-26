-- Permisos editables por rol y excepciones por usuario.
do $$ begin
  create type public.permission_effect as enum ('allow', 'deny');
exception when duplicate_object then null;
end $$;

create table if not exists public.role_permission_rules (
  role public.app_role not null,
  resource text not null check (resource in (
    'expedientes','providencias','actuaciones','audiencias','actas','documentos',
    'comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion'
  )),
  action text not null check (action in (
    'view','create','edit','archive','restore','hard_delete','publish','sign','share','manage'
  )),
  allowed boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role, resource, action)
);

create table if not exists public.user_permission_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource text not null check (resource in (
    'expedientes','providencias','actuaciones','audiencias','actas','documentos',
    'comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion'
  )),
  action text not null check (action in (
    'view','create','edit','archive','restore','hard_delete','publish','sign','share','manage'
  )),
  effect public.permission_effect not null,
  reason text check (reason is null or char_length(reason) <= 500),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, resource, action)
);

create index if not exists permission_overrides_user_idx
  on public.user_permission_overrides(user_id, resource, action);

create trigger role_permission_rules_updated before update on public.role_permission_rules
for each row execute function public.set_updated_at();
create trigger user_permission_overrides_updated before update on public.user_permission_overrides
for each row execute function public.set_updated_at();

-- Todas las combinaciones aplicables existen explícitamente para que la matriz sea determinista.
with catalog(resource, action) as (values
  ('expedientes','view'),('expedientes','create'),('expedientes','edit'),('expedientes','archive'),('expedientes','restore'),('expedientes','hard_delete'),('expedientes','share'),
  ('providencias','view'),('providencias','create'),('providencias','edit'),('providencias','archive'),('providencias','restore'),('providencias','hard_delete'),('providencias','publish'),('providencias','sign'),('providencias','share'),
  ('actuaciones','view'),('actuaciones','create'),('actuaciones','edit'),('actuaciones','archive'),('actuaciones','restore'),('actuaciones','hard_delete'),
  ('audiencias','view'),('audiencias','create'),('audiencias','edit'),('audiencias','archive'),('audiencias','restore'),('audiencias','hard_delete'),
  ('actas','view'),('actas','create'),('actas','edit'),('actas','publish'),('actas','sign'),
  ('documentos','view'),('documentos','create'),('documentos','edit'),('documentos','archive'),('documentos','restore'),('documentos','hard_delete'),('documentos','share'),
  ('comunicados','view'),('comunicados','create'),('comunicados','edit'),('comunicados','archive'),('comunicados','restore'),('comunicados','hard_delete'),('comunicados','publish'),
  ('estados','view'),('estados','create'),('estados','edit'),('estados','archive'),('estados','restore'),('estados','hard_delete'),('estados','publish'),
  ('usuarios','view'),('usuarios','create'),('usuarios','edit'),('usuarios','manage'),
  ('roles','view'),('roles','manage'),('auditoria','view'),
  ('enlaces','view'),('enlaces','share'),('enlaces','manage'),
  ('firmas','view'),('firmas','sign'),('firmas','manage'),
  ('configuracion','view'),('configuracion','manage')
), roles(role) as (
  select unnest(enum_range(null::public.app_role))
)
insert into public.role_permission_rules(role, resource, action, allowed)
select role, resource, action, false from roles cross join catalog
on conflict (role, resource, action) do nothing;

-- SUPER_ADMIN conserva el conjunto completo; la cuenta propietaria no admite excepciones.
update public.role_permission_rules set allowed = true where role = 'SUPER_ADMIN';

-- Lectura judicial común para roles operativos.
update public.role_permission_rules set allowed = true
where action = 'view' and resource in ('expedientes','providencias','actuaciones','audiencias','actas','documentos','firmas','enlaces')
and role in ('ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR');

update public.role_permission_rules set allowed = true where
  (role = 'ADMIN_INSTITUCIONAL' and (resource,action) in (('expedientes','edit'),('documentos','create'),('documentos','edit'),('enlaces','share')))
  or (role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL') and (resource,action) in (
    ('providencias','create'),('providencias','edit'),('providencias','publish'),('providencias','sign'),('providencias','share'),
    ('actuaciones','create'),('audiencias','create'),('audiencias','edit'),('actas','create'),('actas','edit'),('actas','publish'),
    ('documentos','create'),('documentos','edit'),('documentos','share'),('enlaces','share'),('firmas','sign'),('firmas','manage')
  ))
  or (role = 'SECRETARIO_GENERAL' and (resource,action) in (
    ('expedientes','create'),('expedientes','edit'),('actuaciones','create'),('audiencias','create'),('audiencias','edit'),
    ('actas','create'),('actas','edit'),('actas','publish'),('documentos','create'),('documentos','edit'),('documentos','share'),
    ('comunicados','view'),('comunicados','create'),('comunicados','edit'),('comunicados','publish'),
    ('estados','view'),('estados','create'),('estados','edit'),('estados','publish'),('enlaces','share'),('firmas','manage')
  ))
  or (role = 'SECRETARIO_DESPACHO' and (resource,action) in (
    ('expedientes','edit'),('providencias','create'),('providencias','edit'),('actuaciones','create'),('audiencias','create'),('audiencias','edit'),
    ('actas','create'),('actas','edit'),('actas','publish'),('documentos','create'),('documentos','edit'),('documentos','share'),
    ('estados','view'),('estados','create'),('estados','edit'),('estados','publish'),('enlaces','share'),('firmas','manage')
  ))
  or (role = 'OFICIAL_MAYOR' and (resource,action) in (
    ('providencias','create'),('providencias','edit'),('actuaciones','create'),('documentos','create'),('documentos','edit'),('documentos','share')
  ))
  or (role = 'RADICADOR' and (resource,action) in (
    ('expedientes','view'),('expedientes','create'),('expedientes','edit'),('documentos','view'),('documentos','create'),('documentos','edit')
  ))
  or (role = 'REPARTO' and (resource,action) in (('expedientes','view'),('expedientes','edit'),('documentos','view')))
  or (role = 'ARCHIVO' and (resource,action) in (
    ('expedientes','view'),('expedientes','archive'),('documentos','view'),('documentos','archive'),('actuaciones','view'),('audiencias','view'),('providencias','view')
  ))
  or (role = 'GOBERNACION_COMUNICACIONES' and (resource,action) in (
    ('comunicados','view'),('comunicados','create'),('comunicados','edit'),('comunicados','publish')
  ));

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
begin
  if p_user_id is null then return false; end if;
  if p_user_id is distinct from auth.uid() and not public.is_owner() then return false; end if;
  select * into v_profile from public.profiles where id = p_user_id and is_active;
  if not found then return false; end if;
  if v_profile.is_owner and v_profile.role = 'SUPER_ADMIN' then return true; end if;
  select effect into v_effect from public.user_permission_overrides
    where user_id = p_user_id and resource = p_resource and action = p_action;
  if v_effect = 'deny' then return false; end if;
  if v_effect = 'allow' then return true; end if;
  select allowed into v_allowed from public.role_permission_rules
    where role = v_profile.role and resource = p_resource and action = p_action;
  return coalesce(v_allowed, false);
end $$;
revoke all on function public.has_effective_permission(text, text, uuid) from public;
grant execute on function public.has_effective_permission(text, text, uuid) to anon, authenticated, service_role;

create or replace function public.guard_permission_management() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_target uuid; v_role public.app_role; v_resource text; v_action text; v_allowed boolean;
begin
  if auth.uid() is not null and not public.is_owner() then
    raise exception 'Only the protected owner may manage permissions';
  end if;
  if tg_table_name = 'role_permission_rules' then
    v_role := coalesce(new.role, old.role); v_resource := coalesce(new.resource, old.resource); v_action := coalesce(new.action, old.action);
    v_allowed := case when tg_op = 'DELETE' then false else new.allowed end;
    if v_role = 'SUPER_ADMIN' and v_resource = 'roles' and v_action = 'manage' and not v_allowed then
      raise exception 'SUPER_ADMIN role management cannot be disabled for the protected owner';
    end if;
  else
    v_target := coalesce(new.user_id, old.user_id);
    if exists(select 1 from public.profiles where id = v_target and is_owner) then
      raise exception 'The protected owner cannot receive permission overrides';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger guard_role_permission_rules before insert or update or delete on public.role_permission_rules
for each row execute function public.guard_permission_management();
create trigger guard_user_permission_overrides before insert or update or delete on public.user_permission_overrides
for each row execute function public.guard_permission_management();

create or replace function public.replace_role_permission_rules(
  p_role public.app_role,
  p_entries jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Only the protected owner may manage role permissions'; end if;
  if jsonb_typeof(p_entries) <> 'array' then raise exception 'Permission entries must be an array'; end if;
  if p_role = 'SUPER_ADMIN' and exists (
    select 1 from jsonb_to_recordset(p_entries) as x(resource text, action text, allowed boolean)
    where resource = 'roles' and action = 'manage' and not allowed
  ) then raise exception 'SUPER_ADMIN role management cannot be disabled'; end if;
  update public.role_permission_rules r
  set allowed = x.allowed, updated_by = auth.uid()
  from jsonb_to_recordset(p_entries) as x(resource text, action text, allowed boolean)
  where r.role = p_role and r.resource = x.resource and r.action = x.action;
end $$;
revoke all on function public.replace_role_permission_rules(public.app_role,jsonb) from public,anon;
grant execute on function public.replace_role_permission_rules(public.app_role,jsonb) to authenticated;

create or replace function public.replace_user_permission_overrides(
  p_user_id uuid,
  p_entries jsonb,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Only the protected owner may manage user permissions'; end if;
  if exists(select 1 from public.profiles where id = p_user_id and is_owner) then
    raise exception 'The protected owner cannot receive permission overrides';
  end if;
  if not exists(select 1 from public.profiles where id = p_user_id) then raise exception 'User profile not found'; end if;
  if jsonb_typeof(p_entries) <> 'array' then raise exception 'Permission entries must be an array'; end if;
  delete from public.user_permission_overrides where user_id = p_user_id;
  insert into public.user_permission_overrides(user_id,resource,action,effect,reason,created_by)
  select p_user_id,x.resource,x.action,x.effect::public.permission_effect,nullif(trim(p_reason),''),auth.uid()
  from jsonb_to_recordset(p_entries) as x(resource text, action text, effect text);
end $$;
revoke all on function public.replace_user_permission_overrides(uuid,jsonb,text) from public,anon;
grant execute on function public.replace_user_permission_overrides(uuid,jsonb,text) to authenticated;

create or replace function public.audit_permission_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare old_row jsonb; new_row jsonb; target_id uuid;
begin
  old_row := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  target_id := case when tg_table_name = 'user_permission_overrides'
    then coalesce((new_row->>'user_id')::uuid, (old_row->>'user_id')::uuid) else null end;
  insert into public.audit_logs(user_id,target_user_id,action,table_name,description,old_values,new_values,metadata)
  values(auth.uid(),target_id,
    case when tg_table_name = 'role_permission_rules' then 'ROLE_PERMISSION_CHANGED' else 'USER_PERMISSION_OVERRIDE_CHANGED' end,
    tg_table_name,'Cambio de permiso administrativo',old_row,new_row,
    jsonb_build_object('operation',tg_op));
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger audit_role_permission_rules after insert or update or delete on public.role_permission_rules
for each row execute function public.audit_permission_change();
create trigger audit_user_permission_overrides after insert or update or delete on public.user_permission_overrides
for each row execute function public.audit_permission_change();

alter table public.role_permission_rules enable row level security;
alter table public.user_permission_overrides enable row level security;
create policy role_permission_rules_read on public.role_permission_rules for select to authenticated using (public.is_active_internal());
create policy role_permission_rules_owner_write on public.role_permission_rules for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy user_permission_overrides_read on public.user_permission_overrides for select to authenticated using (user_id = auth.uid() or public.is_owner());
create policy user_permission_overrides_owner_write on public.user_permission_overrides for all to authenticated using (public.is_owner()) with check (public.is_owner());
revoke all on public.role_permission_rules, public.user_permission_overrides from anon;
grant select on public.role_permission_rules to authenticated;
grant select on public.user_permission_overrides to authenticated;
grant insert,update,delete on public.role_permission_rules, public.user_permission_overrides to authenticated;

-- El alcance institucional continúa siendo obligatorio además del permiso editable.
create or replace function public.can_access_case(p_case_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_effective_permission('expedientes','view',auth.uid()) and exists (
    select 1 from public.cases c
    join public.profiles p on p.id = auth.uid() and p.is_active
    where c.id = p_case_id and (
      (p.is_owner and p.role = 'SUPER_ADMIN')
      or p.role in ('SUPER_ADMIN','SECRETARIO_GENERAL','RADICADOR','REPARTO','ARCHIVO')
      or (p.role = 'ADMIN_INSTITUCIONAL' and c.dependency_id = p.dependency_id)
      or (p.role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL') and c.assigned_judge_id = p.id)
      or (p.role in ('SECRETARIO_DESPACHO','OFICIAL_MAYOR') and c.dependency_id = p.dependency_id)
      or public.has_active_case_share(c.id)
    )
  )
$$;

-- Ciclo de vida: el permiso editable se valida dentro de la función SECURITY DEFINER.
create or replace function public.block_non_owner_hard_delete() returns trigger
language plpgsql set search_path = public as $$
declare v_resource text;
begin
  v_resource := case tg_table_name
    when 'cases' then 'expedientes' when 'radications' then 'expedientes'
    when 'case_actions' then 'actuaciones' when 'documents' then 'documentos'
    when 'hearings' then 'audiencias' when 'proceedings' then 'providencias'
    when 'public_notices' then 'comunicados' when 'judicial_states' then 'estados'
    when 'dependencies' then 'configuracion' else null end;
  if current_user not in ('postgres','supabase_admin','service_role')
    and (v_resource is null or not public.has_effective_permission(v_resource,'hard_delete',auth.uid())) then
    raise exception 'No tiene permiso para eliminar definitivamente este registro';
  end if;
  return old;
end $$;

create or replace function public.manage_record_lifecycle(
  p_resource text, p_record_id uuid, p_operation text, p_confirmation text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table text; v_status_column boolean := false; v_exists boolean := false; v_error text;
  v_permission_resource text; v_permission_action text;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','Autenticación requerida'); end if;
  if p_resource not in ('cases','radications','case_actions','documents','hearings','proceedings','public_notices','judicial_states','dependencies') then
    perform public.log_security_event('LIFECYCLE_DENIED',p_resource,p_record_id,'Tipo de registro no permitido',jsonb_build_object('operation',p_operation));
    return jsonb_build_object('ok',false,'error','Tipo de registro no permitido');
  end if;
  if p_operation not in ('archive','restore','delete') then return jsonb_build_object('ok',false,'error','Operación no permitida'); end if;
  v_table := p_resource;
  v_permission_resource := case p_resource
    when 'cases' then 'expedientes' when 'radications' then 'expedientes'
    when 'case_actions' then 'actuaciones' when 'documents' then 'documentos'
    when 'hearings' then 'audiencias' when 'proceedings' then 'providencias'
    when 'public_notices' then 'comunicados' when 'judicial_states' then 'estados'
    when 'dependencies' then 'configuracion' end;
  v_permission_action := case p_operation when 'delete' then 'hard_delete' else p_operation end;
  if not public.has_effective_permission(v_permission_resource,v_permission_action,auth.uid()) then
    perform public.log_security_event('PERMISSION_DENIED',v_table,p_record_id,'Intento de ciclo de vida sin permiso',jsonb_build_object('operation',p_operation));
    return jsonb_build_object('ok',false,'error','No tiene permiso para realizar esta operación');
  end if;
  v_status_column := p_resource in ('cases','hearings','proceedings','public_notices','judicial_states');
  execute format('select exists(select 1 from public.%I where id = $1)',v_table) into v_exists using p_record_id;
  if not v_exists then return jsonb_build_object('ok',false,'error','Registro no encontrado'); end if;
  if p_operation = 'delete' and p_confirmation is distinct from 'ELIMINAR DEFINITIVAMENTE' then
    perform public.log_security_event('HARD_DELETE_DENIED',v_table,p_record_id,'Confirmación escrita incorrecta','{}'::jsonb);
    return jsonb_build_object('ok',false,'error','Escriba ELIMINAR DEFINITIVAMENTE para confirmar');
  end if;
  begin
    if p_operation = 'archive' then
      if v_status_column then
        execute format('update public.%I set archived_status = status, archived_at = now(), archived_by = auth.uid(), status = %L where id = $1 and archived_at is null',v_table,'Archivado') using p_record_id;
      elsif p_resource = 'dependencies' then
        execute 'update public.dependencies set archived_status = case when is_active then ''Activa'' else ''Inactiva'' end, archived_at = now(), archived_by = auth.uid(), is_active = false where id = $1 and archived_at is null' using p_record_id;
      else
        execute format('update public.%I set archived_at = now(), archived_by = auth.uid() where id = $1 and archived_at is null',v_table) using p_record_id;
      end if;
    elsif p_operation = 'restore' then
      if v_status_column then
        execute format('update public.%I set status = coalesce(archived_status, %L), archived_status = null, archived_at = null, archived_by = null where id = $1 and archived_at is not null',v_table,'Borrador') using p_record_id;
      elsif p_resource = 'dependencies' then
        execute 'update public.dependencies set is_active = true, archived_status = null, archived_at = null, archived_by = null where id = $1 and archived_at is not null' using p_record_id;
      else
        execute format('update public.%I set archived_at = null, archived_by = null where id = $1 and archived_at is not null',v_table) using p_record_id;
      end if;
    else
      if p_resource = 'cases' and exists(select 1 from public.documents where case_id = p_record_id) then
        return jsonb_build_object('ok',false,'error','El expediente conserva documentos; archívelo para preservar la integridad judicial');
      end if;
      execute format('delete from public.%I where id = $1',v_table) using p_record_id;
    end if;
  exception when others then
    v_error := sqlerrm;
    perform public.log_security_event('LIFECYCLE_FAILED',v_table,p_record_id,'La operación no pudo completarse',jsonb_build_object('operation',p_operation,'error',v_error));
    return jsonb_build_object('ok',false,'error',v_error);
  end;
  perform public.log_security_event(
    case p_operation when 'archive' then 'RECORD_ARCHIVED' when 'restore' then 'RECORD_RESTORED' else 'RECORD_HARD_DELETED' end,
    v_table,p_record_id,
    case p_operation when 'archive' then 'Registro archivado' when 'restore' then 'Registro restaurado' else 'Registro eliminado definitivamente' end,
    jsonb_build_object('operation',p_operation));
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.manage_record_lifecycle(text,uuid,text,text) from public,anon;
grant execute on function public.manage_record_lifecycle(text,uuid,text,text) to authenticated;

-- Escritura de los recursos principales: permiso efectivo + alcance/RLS existente.
drop policy if exists cases_create on public.cases;
create policy cases_create on public.cases for insert to authenticated with check (public.has_effective_permission('expedientes','create') and created_by = auth.uid());
drop policy if exists cases_update on public.cases;
create policy cases_update on public.cases for update to authenticated using (public.can_access_case(id) and archived_at is null and public.has_effective_permission('expedientes','edit')) with check (public.can_access_case(id));

drop policy if exists actions_write on public.case_actions;
create policy actions_write on public.case_actions for all to authenticated using (public.can_access_case(case_id) and public.has_effective_permission('actuaciones','edit')) with check (public.can_access_case(case_id) and (public.has_effective_permission('actuaciones','create') or public.has_effective_permission('actuaciones','edit')));
drop policy if exists documents_upload on public.documents;
create policy documents_upload on public.documents for insert to authenticated with check (public.can_access_case(case_id) and public.has_effective_permission('documentos','create') and uploaded_by = auth.uid());
drop policy if exists hearings_write on public.hearings;
create policy hearings_write on public.hearings for all to authenticated using (public.can_access_case(case_id) and public.has_effective_permission('audiencias','edit')) with check (public.can_access_case(case_id) and (public.has_effective_permission('audiencias','create') or public.has_effective_permission('audiencias','edit')));
drop policy if exists proceedings_write on public.proceedings;
create policy proceedings_write on public.proceedings for all to authenticated using (public.can_access_case(case_id) and (public.has_effective_permission('providencias','edit') or public.has_effective_permission('providencias','publish'))) with check (public.can_access_case(case_id) and (public.has_effective_permission('providencias','create') or public.has_effective_permission('providencias','edit') or public.has_effective_permission('providencias','publish')));
drop policy if exists notices_write on public.public_notices;
create policy notices_write on public.public_notices for all to authenticated using (public.has_effective_permission('comunicados','edit') or public.has_effective_permission('comunicados','publish')) with check (public.has_effective_permission('comunicados','create') or public.has_effective_permission('comunicados','edit') or public.has_effective_permission('comunicados','publish'));
drop policy if exists states_write on public.judicial_states;
create policy states_write on public.judicial_states for all to authenticated using (public.has_effective_permission('estados','edit') or public.has_effective_permission('estados','publish')) with check (public.has_effective_permission('estados','create') or public.has_effective_permission('estados','edit') or public.has_effective_permission('estados','publish'));
drop policy if exists state_items_write on public.judicial_state_items;
create policy state_items_write on public.judicial_state_items for all to authenticated using (public.has_effective_permission('estados','edit')) with check (public.has_effective_permission('estados','edit'));

drop policy if exists actions_read on public.case_actions;
create policy actions_read on public.case_actions for select to authenticated using (public.can_access_case(case_id) and public.has_effective_permission('actuaciones','view'));
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated using (case_id is not null and public.can_access_case(case_id) and public.has_effective_permission('documentos','view'));
drop policy if exists hearings_read on public.hearings;
create policy hearings_read on public.hearings for select to authenticated using (public.can_access_case(case_id) and public.has_effective_permission('audiencias','view'));
drop policy if exists proceedings_public_read on public.proceedings;
create policy proceedings_public_read on public.proceedings for select to anon,authenticated using (
  (status = 'Publicado' and visibility = 'public')
  or (public.can_access_case(case_id) and public.has_effective_permission('providencias','view'))
);
drop policy if exists notices_public_read on public.public_notices;
create policy notices_public_read on public.public_notices for select using (
  status = 'Publicado' or (public.is_active_internal() and public.has_effective_permission('comunicados','view'))
);
drop policy if exists states_public_read on public.judicial_states;
create policy states_public_read on public.judicial_states for select using (
  status = 'Publicado' or (public.is_active_internal() and public.has_effective_permission('estados','view'))
);

drop policy if exists hearing_minutes_write on public.hearing_minutes;
create policy hearing_minutes_write on public.hearing_minutes for all to authenticated using (public.can_access_case(case_id) and (public.has_effective_permission('actas','edit') or public.has_effective_permission('actas','publish'))) with check (public.can_access_case(case_id) and (public.has_effective_permission('actas','create') or public.has_effective_permission('actas','edit') or public.has_effective_permission('actas','publish')));
drop policy if exists hearing_minutes_read on public.hearing_minutes;
create policy hearing_minutes_read on public.hearing_minutes for select to authenticated using (public.can_access_case(case_id) and public.has_effective_permission('actas','view'));
drop policy if exists signature_requests_write on public.signature_requests;
create policy signature_requests_write on public.signature_requests for all to authenticated using (public.can_access_case(case_id) and public.has_effective_permission('firmas','manage')) with check (public.can_access_case(case_id) and public.has_effective_permission('firmas','manage') and requested_by = auth.uid());
drop policy if exists signature_requests_read on public.signature_requests;
create policy signature_requests_read on public.signature_requests for select to authenticated using (public.can_access_case(case_id) and public.has_effective_permission('firmas','view'));
drop policy if exists signatures_read on public.signatures;
create policy signatures_read on public.signatures for select to authenticated using (public.can_access_case(case_id) and public.has_effective_permission('firmas','view'));
drop policy if exists record_shares_read on public.record_shares;
create policy record_shares_read on public.record_shares for select to authenticated using (
  public.has_effective_permission('enlaces','view') and (
    public.is_owner() or shared_by = auth.uid() or target_user_id = auth.uid()
    or target_role = public.current_role() or target_dependency_id = public.current_dependency_id()
  )
);
drop policy if exists share_links_read on public.share_links;
create policy share_links_read on public.share_links for select to authenticated using (public.can_access_case(case_id) and public.has_effective_permission('enlaces','view') and (public.is_owner() or created_by = auth.uid()));
drop policy if exists share_links_write on public.share_links;
create policy share_links_write on public.share_links for all to authenticated using (public.can_access_case(case_id) and (public.is_owner() or created_by = auth.uid()) and public.has_effective_permission('enlaces','manage')) with check (public.can_access_case(case_id) and created_by = auth.uid() and public.has_effective_permission('enlaces','share'));
drop policy if exists record_shares_insert on public.record_shares;
create policy record_shares_insert on public.record_shares for insert to authenticated with check (shared_by = auth.uid() and public.can_access_case(case_id) and public.has_effective_permission('enlaces','share'));
