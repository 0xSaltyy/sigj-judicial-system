-- Alinea el catálogo editable con la autorización efectiva de PostgREST, RPC y Storage.

alter table public.role_permission_rules
  drop constraint if exists role_permission_rules_action_check;
alter table public.role_permission_rules
  add constraint role_permission_rules_action_check check (action in (
    'view','create','edit','upload','preview','download','archive','restore',
    'hard_delete','publish','finalize','reopen','sign','print','share',
    'repartition','assign_ponente','reschedule','cancel','deactivate',
    'reactivate','assign_role','request','revoke','manage'
  ));

alter table public.user_permission_overrides
  drop constraint if exists user_permission_overrides_action_check;
alter table public.user_permission_overrides
  add constraint user_permission_overrides_action_check check (action in (
    'view','create','edit','upload','preview','download','archive','restore',
    'hard_delete','publish','finalize','reopen','sign','print','share',
    'repartition','assign_ponente','reschedule','cancel','deactivate',
    'reactivate','assign_role','request','revoke','manage'
  ));

with catalog(resource, action) as (values
  ('expedientes','view'),('expedientes','create'),('expedientes','edit'),('expedientes','archive'),('expedientes','restore'),('expedientes','hard_delete'),('expedientes','share'),('expedientes','repartition'),('expedientes','assign_ponente'),
  ('providencias','view'),('providencias','create'),('providencias','edit'),('providencias','publish'),('providencias','archive'),('providencias','restore'),('providencias','hard_delete'),('providencias','sign'),('providencias','share'),('providencias','print'),
  ('actuaciones','view'),('actuaciones','create'),('actuaciones','edit'),('actuaciones','archive'),('actuaciones','restore'),('actuaciones','hard_delete'),
  ('audiencias','view'),('audiencias','create'),('audiencias','edit'),('audiencias','reschedule'),('audiencias','cancel'),('audiencias','archive'),('audiencias','restore'),('audiencias','hard_delete'),
  ('actas','view'),('actas','create'),('actas','edit'),('actas','finalize'),('actas','reopen'),('actas','sign'),('actas','print'),('actas','archive'),
  ('documentos','view'),('documentos','upload'),('documentos','preview'),('documentos','download'),('documentos','archive'),('documentos','restore'),('documentos','hard_delete'),('documentos','share'),
  ('comunicados','view'),('comunicados','create'),('comunicados','edit'),('comunicados','publish'),('comunicados','archive'),('comunicados','restore'),('comunicados','hard_delete'),
  ('estados','view'),('estados','create'),('estados','edit'),('estados','publish'),('estados','archive'),('estados','restore'),('estados','hard_delete'),
  ('usuarios','view'),('usuarios','create'),('usuarios','edit'),('usuarios','deactivate'),('usuarios','reactivate'),('usuarios','assign_role'),
  ('roles','view'),('roles','manage'),('firmas','view'),('firmas','request'),('firmas','sign'),('firmas','revoke'),
  ('enlaces','create'),('enlaces','view'),('enlaces','revoke'),('auditoria','view'),
  ('configuracion','view'),('configuracion','manage')
), roles(role) as (
  select unnest(enum_range(null::public.app_role))
)
insert into public.role_permission_rules(role, resource, action, allowed)
select role, resource, action, role = 'SUPER_ADMIN'::public.app_role from roles cross join catalog
on conflict (role, resource, action) do nothing;

-- Las acciones nuevas conservan el alcance funcional anterior, pero quedan separadas.
update public.role_permission_rules target set allowed = source.allowed
from public.role_permission_rules source
where target.role = source.role and (
  (target.resource = 'documentos' and target.action = 'upload' and source.resource = 'documentos' and source.action = 'create') or
  (target.resource = 'documentos' and target.action in ('preview','download') and source.resource = 'documentos' and source.action = 'view') or
  (target.resource = 'providencias' and target.action = 'print' and source.resource = 'providencias' and source.action = 'view') or
  (target.resource = 'audiencias' and target.action in ('reschedule','cancel') and source.resource = 'audiencias' and source.action = 'edit') or
  (target.resource = 'actas' and target.action in ('finalize','reopen') and source.resource = 'actas' and source.action = 'publish') or
  (target.resource = 'actas' and target.action = 'print' and source.resource = 'actas' and source.action = 'view') or
  (target.resource = 'firmas' and target.action in ('request','revoke') and source.resource = 'firmas' and source.action = 'manage') or
  (target.resource = 'enlaces' and target.action = 'create' and source.resource = 'enlaces' and source.action = 'share') or
  (target.resource = 'enlaces' and target.action = 'revoke' and source.resource = 'enlaces' and source.action = 'manage')
);

update public.role_permission_rules set allowed = true
where resource = 'actas' and action = 'sign' and role in (
  'MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO',
  'JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO'
);
update public.role_permission_rules set allowed = true
where resource = 'expedientes' and action in ('repartition','assign_ponente')
  and role in ('ADMIN_INSTITUCIONAL','SECRETARIO_GENERAL','REPARTO');
update public.role_permission_rules set allowed = true where role = 'SUPER_ADMIN';

-- Migra excepciones existentes hacia su acción granular equivalente.
with aliases(resource, old_action, new_action) as (values
  ('documentos','create','upload'),('documentos','view','preview'),('documentos','view','download'),
  ('providencias','view','print'),('audiencias','edit','reschedule'),('audiencias','edit','cancel'),
  ('actas','publish','finalize'),('actas','publish','reopen'),('actas','view','print'),
  ('firmas','manage','request'),('firmas','manage','revoke'),
  ('enlaces','share','create'),('enlaces','manage','revoke'),
  ('expedientes','edit','repartition'),('expedientes','edit','assign_ponente')
)
insert into public.user_permission_overrides(user_id, resource, action, effect, reason, created_by, created_at, updated_at)
select override.user_id, override.resource, aliases.new_action, override.effect,
       coalesce(override.reason, 'Migrado desde el permiso granular anterior'),
       override.created_by, override.created_at, override.updated_at
from public.user_permission_overrides override
join aliases on aliases.resource = override.resource and aliases.old_action = override.action
on conflict (user_id, resource, action) do nothing;

-- Compatibilidad acotada para RPC anteriores mientras todas las llamadas migran a upload.
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
  if v_profile.is_owner and v_profile.role = 'SUPER_ADMIN' then return true; end if;
  select effect into v_effect from public.user_permission_overrides
    where user_id = p_user_id and resource = p_resource and action = v_action;
  if v_effect = 'deny' then return false; end if;
  if v_effect = 'allow' then return true; end if;
  select allowed into v_allowed from public.role_permission_rules
    where role = v_profile.role and resource = p_resource and action = v_action;
  return coalesce(v_allowed, false);
end $$;
revoke all on function public.has_effective_permission(text,text,uuid) from public;
grant execute on function public.has_effective_permission(text,text,uuid) to anon, authenticated, service_role;

-- Reparto y ponente se validan incluso si se llama el RPC directamente.
create or replace function public.update_case_secure(
  p_case_id uuid,
  p_payload jsonb,
  p_declassification_confirmation text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_old public.cases%rowtype;
  v_new_level text;
  v_new_dependency uuid;
  v_new_judge uuid;
begin
  if auth.uid() is null or not public.can_access_case(p_case_id) then raise exception 'Acceso no autorizado'; end if;
  if not public.has_effective_permission('expedientes','edit') then raise exception 'No tiene permiso para editar el expediente'; end if;
  select * into v_old from public.cases where id = p_case_id for update;
  if not found then raise exception 'Expediente no encontrado'; end if;
  if v_old.archived_at is not null and not public.is_owner() then raise exception 'Solo el propietario puede editar expedientes archivados'; end if;

  v_new_dependency := case when p_payload ? 'dependency_id' then nullif(p_payload->>'dependency_id','')::uuid else v_old.dependency_id end;
  v_new_judge := case when p_payload ? 'assigned_judge_id' then nullif(p_payload->>'assigned_judge_id','')::uuid else v_old.assigned_judge_id end;
  if v_new_dependency is distinct from v_old.dependency_id
     and not public.has_effective_permission('expedientes','repartition') then
    raise exception 'No tiene permiso para cambiar el reparto del expediente';
  end if;
  if v_new_judge is distinct from v_old.assigned_judge_id
     and not public.has_effective_permission('expedientes','assign_ponente') then
    raise exception 'No tiene permiso para asignar ponente';
  end if;

  v_new_level := coalesce(p_payload->>'confidentiality_level',v_old.confidentiality_level);
  if v_old.confidentiality_level in ('Reservado','Confidencial') and v_new_level = 'Público' then
    if p_declassification_confirmation is distinct from 'CONFIRMAR PUBLICACIÓN' then
      raise exception 'Escriba CONFIRMAR PUBLICACIÓN para reducir el nivel de reserva';
    end if;
    perform set_config('sigj.declassification_confirmed', 'yes', true);
  end if;

  update public.cases set
    title=coalesce(nullif(p_payload->>'title',''),title), authority_type=coalesce(nullif(p_payload->>'authority_type',''),authority_type),
    chamber=coalesce(nullif(p_payload->>'chamber',''),chamber), process_type=coalesce(nullif(p_payload->>'process_type',''),process_type),
    process_subtype=coalesce(nullif(p_payload->>'process_subtype',''),process_subtype), claimant_name=coalesce(nullif(p_payload->>'claimant_name',''),claimant_name),
    defendant_name=coalesce(nullif(p_payload->>'defendant_name',''),defendant_name), summary=coalesce(nullif(p_payload->>'summary',''),summary),
    claims=coalesce(nullif(p_payload->>'claims',''),claims), department=coalesce(nullif(p_payload->>'department',''),department),
    municipality=coalesce(nullif(p_payload->>'municipality',''),municipality), reception_method=coalesce(nullif(p_payload->>'reception_method',''),reception_method),
    confidentiality_level=v_new_level, public_visibility=coalesce((p_payload->>'public_visibility')::boolean,public_visibility),
    assigned_judge_id=v_new_judge, dependency_id=v_new_dependency,
    status=coalesce(nullif(p_payload->>'status',''),status),
    observations=case when p_payload ? 'observations' then nullif(p_payload->>'observations','') else observations end
  where id=p_case_id;

  if v_new_dependency is distinct from v_old.dependency_id then
    perform public.log_security_event('CASE_REPARTITIONED','cases',p_case_id,'Reparto del expediente actualizado',jsonb_build_object('old_dependency',v_old.dependency_id,'new_dependency',v_new_dependency));
  end if;
  if v_new_judge is distinct from v_old.assigned_judge_id then
    perform public.log_security_event('CASE_PONENTE_ASSIGNED','cases',p_case_id,'Ponente del expediente actualizado',jsonb_build_object('old_judge',v_old.assigned_judge_id,'new_judge',v_new_judge));
  end if;
  perform public.log_security_event('CASE_FULL_UPDATE','cases',p_case_id,'Expediente actualizado desde el flujo seguro',jsonb_build_object('old_confidentiality',v_old.confidentiality_level,'new_confidentiality',v_new_level,'old_status',v_old.status,'new_status',p_payload->>'status'));
end $$;
revoke all on function public.update_case_secure(uuid,jsonb,text) from public,anon;
grant execute on function public.update_case_secure(uuid,jsonb,text) to authenticated;

create or replace function public.guard_case_assignment_permissions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(auth.role(),'') = 'service_role' then return new; end if;
  if new.dependency_id is distinct from old.dependency_id
     and not public.has_effective_permission('expedientes','repartition') then
    raise exception 'No tiene permiso para cambiar el reparto del expediente';
  end if;
  if new.assigned_judge_id is distinct from old.assigned_judge_id
     and not public.has_effective_permission('expedientes','assign_ponente') then
    raise exception 'No tiene permiso para asignar ponente';
  end if;
  return new;
end $$;
drop trigger if exists cases_assignment_permission_guard on public.cases;
create trigger cases_assignment_permission_guard before update of dependency_id, assigned_judge_id on public.cases
for each row execute function public.guard_case_assignment_permissions();

-- El RPC de ciclo de vida vuelve a comprobar permiso y alcance del registro.
alter table public.hearing_minutes add column if not exists archived_status text;

create or replace function public.manage_record_lifecycle(
  p_resource text, p_record_id uuid, p_operation text, p_confirmation text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table text; v_status_column boolean := false; v_exists boolean := false; v_scope boolean := false; v_error text;
  v_permission_resource text; v_permission_action text;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','Autenticación requerida'); end if;
  if p_resource not in ('cases','radications','case_actions','documents','hearings','proceedings','public_notices','judicial_states','hearing_minutes','dependencies') then
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
    when 'hearing_minutes' then 'actas' when 'dependencies' then 'configuracion' end;
  v_permission_action := case p_operation when 'delete' then 'hard_delete' else p_operation end;
  if not public.has_effective_permission(v_permission_resource,v_permission_action) then
    perform public.log_security_event('PERMISSION_DENIED',v_table,p_record_id,'Intento de ciclo de vida sin permiso',jsonb_build_object('operation',p_operation));
    return jsonb_build_object('ok',false,'error','No tiene permiso para realizar esta operación');
  end if;

  v_scope := case p_resource
    when 'cases' then public.can_access_case(p_record_id)
    when 'radications' then exists(select 1 from public.radications r where r.id=p_record_id and public.can_access_case(r.case_id))
    when 'case_actions' then exists(select 1 from public.case_actions a where a.id=p_record_id and public.can_access_case(a.case_id))
    when 'documents' then exists(select 1 from public.documents d where d.id=p_record_id and d.case_id is not null and public.can_access_case(d.case_id))
    when 'hearings' then exists(select 1 from public.hearings h where h.id=p_record_id and public.can_access_case(h.case_id))
    when 'proceedings' then exists(select 1 from public.proceedings p where p.id=p_record_id and public.can_access_case(p.case_id))
    when 'hearing_minutes' then exists(select 1 from public.hearing_minutes m where m.id=p_record_id and public.can_access_case(m.case_id))
    when 'public_notices' then exists(select 1 from public.public_notices n where n.id=p_record_id)
    when 'judicial_states' then exists(select 1 from public.judicial_states s where s.id=p_record_id and (public.is_owner() or public.current_role()='SECRETARIO_GENERAL' or s.dependency_id=public.current_dependency_id()))
    when 'dependencies' then public.is_owner() and exists(select 1 from public.dependencies d where d.id=p_record_id)
    else false end;
  if not v_scope then
    perform public.log_security_event('LIFECYCLE_SCOPE_DENIED',v_table,p_record_id,'Registro fuera del alcance institucional',jsonb_build_object('operation',p_operation));
    return jsonb_build_object('ok',false,'error','Registro no encontrado o fuera de su alcance');
  end if;

  v_status_column := p_resource in ('cases','hearings','proceedings','public_notices','judicial_states','hearing_minutes');
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
  perform public.log_security_event(case p_operation when 'archive' then 'RECORD_ARCHIVED' when 'restore' then 'RECORD_RESTORED' else 'RECORD_HARD_DELETED' end,v_table,p_record_id,case p_operation when 'archive' then 'Registro archivado' when 'restore' then 'Registro restaurado' else 'Registro eliminado definitivamente' end,jsonb_build_object('operation',p_operation));
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.manage_record_lifecycle(text,uuid,text,text) from public,anon;
grant execute on function public.manage_record_lifecycle(text,uuid,text,text) to authenticated;

-- Guardas de transición: una regla amplia de UPDATE no equivale a un permiso preciso.
create or replace function public.guard_hearing_permissions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(auth.role(),'')='service_role' then return new; end if;
  if tg_op='INSERT' then
    if not public.has_effective_permission('audiencias','create') then raise exception 'No tiene permiso para crear audiencias'; end if;
    return new;
  end if;
  if new.archived_at is distinct from old.archived_at then
    if new.archived_at is not null and not public.has_effective_permission('audiencias','archive') then raise exception 'No tiene permiso para archivar audiencias'; end if;
    if new.archived_at is null and not public.has_effective_permission('audiencias','restore') then raise exception 'No tiene permiso para restaurar audiencias'; end if;
    return new;
  end if;
  if not public.has_effective_permission('audiencias','edit') then raise exception 'No tiene permiso para editar audiencias'; end if;
  if (new.scheduled_at,new.end_at) is distinct from (old.scheduled_at,old.end_at)
     and not public.has_effective_permission('audiencias','reschedule') then raise exception 'No tiene permiso para reprogramar audiencias'; end if;
  if new.status='Cancelada' and old.status is distinct from 'Cancelada'
     and not public.has_effective_permission('audiencias','cancel') then raise exception 'No tiene permiso para cancelar audiencias'; end if;
  return new;
end $$;
drop trigger if exists hearings_permission_guard on public.hearings;
create trigger hearings_permission_guard before insert or update on public.hearings for each row execute function public.guard_hearing_permissions();

create or replace function public.guard_proceeding_permissions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(auth.role(),'')='service_role' then return new; end if;
  if tg_op='INSERT' then
    if not public.has_effective_permission('providencias','create') then raise exception 'No tiene permiso para crear providencias'; end if;
    return new;
  end if;
  if new.archived_at is distinct from old.archived_at then
    if new.archived_at is not null and not public.has_effective_permission('providencias','archive') then raise exception 'No tiene permiso para archivar providencias'; end if;
    if new.archived_at is null and not public.has_effective_permission('providencias','restore') then raise exception 'No tiene permiso para restaurar providencias'; end if;
    return new;
  end if;
  if new.status='Publicado' and old.status is distinct from 'Publicado' then
    if not public.has_effective_permission('providencias','publish') then raise exception 'No tiene permiso para publicar providencias'; end if;
  elsif not public.has_effective_permission('providencias','edit') then
    raise exception 'No tiene permiso para editar providencias';
  end if;
  return new;
end $$;
drop trigger if exists proceedings_permission_guard on public.proceedings;
create trigger proceedings_permission_guard before insert or update on public.proceedings for each row execute function public.guard_proceeding_permissions();

create or replace function public.guard_publication_resource_permissions()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_resource text := case tg_table_name when 'public_notices' then 'comunicados' else 'estados' end;
begin
  if auth.uid() is null or coalesce(auth.role(),'')='service_role' then return new; end if;
  if tg_op='INSERT' then
    if not public.has_effective_permission(v_resource,'create') then raise exception 'No tiene permiso para crear este registro'; end if;
    if new.status='Publicado' and not public.has_effective_permission(v_resource,'publish') then raise exception 'No tiene permiso para publicar este registro'; end if;
    return new;
  end if;
  if new.archived_at is distinct from old.archived_at then
    if new.archived_at is not null and not public.has_effective_permission(v_resource,'archive') then raise exception 'No tiene permiso para archivar este registro'; end if;
    if new.archived_at is null and not public.has_effective_permission(v_resource,'restore') then raise exception 'No tiene permiso para restaurar este registro'; end if;
    return new;
  end if;
  if new.status='Publicado' and old.status is distinct from 'Publicado' then
    if not public.has_effective_permission(v_resource,'publish') then raise exception 'No tiene permiso para publicar este registro'; end if;
    if (to_jsonb(new)-array['status','published_at','updated_at']) is distinct from (to_jsonb(old)-array['status','published_at','updated_at'])
       and not public.has_effective_permission(v_resource,'edit') then raise exception 'No tiene permiso para editar este registro'; end if;
  elsif not public.has_effective_permission(v_resource,'edit') then
    raise exception 'No tiene permiso para editar este registro';
  end if;
  return new;
end $$;
drop trigger if exists notices_permission_guard on public.public_notices;
create trigger notices_permission_guard before insert or update on public.public_notices for each row execute function public.guard_publication_resource_permissions();
drop trigger if exists states_permission_guard on public.judicial_states;
create trigger states_permission_guard before insert or update on public.judicial_states for each row execute function public.guard_publication_resource_permissions();

create or replace function public.guard_hearing_minute_finalization()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_document_changed boolean;
begin
  if auth.uid() is null or coalesce(auth.role(),'')='service_role' then return new; end if;
  if tg_op='INSERT' then
    if new.status <> 'Borrador' then raise exception 'A hearing minute must begin as a draft'; end if;
    if not public.has_effective_permission('actas','create') then raise exception 'No tiene permiso para crear actas'; end if;
    return new;
  end if;
  v_document_changed := (to_jsonb(new)-array['status','finalized_at','finalized_by','reopened_at','reopened_by','reopen_reason','archived_at','archived_by','archived_status','updated_at']) is distinct from (to_jsonb(old)-array['status','finalized_at','finalized_by','reopened_at','reopened_by','reopen_reason','archived_at','archived_by','archived_status','updated_at']);
  if v_document_changed and (old.status <> 'Borrador' or not public.has_effective_permission('actas','edit')) then
    raise exception 'Finalized or signed hearing minutes are immutable until explicitly reopened';
  end if;
  if old.status='Borrador' and new.status='Borrador' then
    if not public.has_effective_permission('actas','edit') then raise exception 'No tiene permiso para editar actas'; end if;
    return new;
  end if;
  if old.status='Borrador' and new.status='Finalizada' then
    if not public.has_effective_permission('actas','finalize') then raise exception 'No tiene permiso para finalizar actas'; end if;
    if length(trim(new.development_markdown)) < 20 then raise exception 'Hearing minute development is incomplete'; end if;
    if new.started_at is null or new.ended_at is null or new.ended_at < new.started_at then raise exception 'Actual hearing start and end times are required'; end if;
    return new;
  end if;
  if old.status in ('Finalizada','Firmada') and new.status='Borrador' then
    if not public.has_effective_permission('actas','reopen') then raise exception 'No tiene permiso para reabrir actas'; end if;
    if exists(select 1 from public.signatures s where s.target_type='hearing_minute' and s.target_id=new.id and s.status='signed') then raise exception 'Revoke active signatures before reopening the hearing minute'; end if;
    return new;
  end if;
  if new.status='Archivada' and old.status is distinct from 'Archivada' then
    if not public.has_effective_permission('actas','archive') then raise exception 'No tiene permiso para archivar actas'; end if;
    return new;
  end if;
  if old.status='Finalizada' and new.status='Firmada' then
    if not public.has_effective_permission('actas','sign') or not public.has_effective_permission('firmas','sign') then raise exception 'No tiene permiso para firmar actas'; end if;
    if not public.hearing_minute_signatures_complete(new.id) then raise exception 'Required hearing minute signatures are incomplete'; end if;
    return new;
  end if;
  if old.status='Firmada' and new.status='Finalizada' and not public.hearing_minute_signatures_complete(new.id) then return new; end if;
  if new.status=old.status then return new; end if;
  raise exception 'Invalid hearing minute status transition: % -> %',old.status,new.status;
end $$;

-- RLS exacto por recurso y acción.
drop policy if exists documents_update_own on public.documents;
drop policy if exists documents_delete_own on public.documents;
drop policy if exists documents_upload on public.documents;
create policy documents_upload on public.documents for insert to authenticated
with check (case_id is not null and public.can_access_case(case_id) and public.has_effective_permission('documentos','upload') and uploaded_by=auth.uid());

drop policy if exists hearings_write on public.hearings;
create policy hearings_write on public.hearings for all to authenticated
using (public.can_access_case(case_id) and (public.has_effective_permission('audiencias','edit') or public.has_effective_permission('audiencias','reschedule') or public.has_effective_permission('audiencias','cancel')))
with check (public.can_access_case(case_id) and (public.has_effective_permission('audiencias','create') or public.has_effective_permission('audiencias','edit') or public.has_effective_permission('audiencias','reschedule') or public.has_effective_permission('audiencias','cancel')));

drop policy if exists proceedings_write on public.proceedings;
create policy proceedings_write on public.proceedings for all to authenticated
using (public.can_access_case(case_id) and (public.has_effective_permission('providencias','edit') or public.has_effective_permission('providencias','publish')))
with check (public.can_access_case(case_id) and (public.has_effective_permission('providencias','create') or public.has_effective_permission('providencias','edit') or public.has_effective_permission('providencias','publish')));

drop policy if exists notices_write on public.public_notices;
create policy notices_write on public.public_notices for all to authenticated
using (public.has_effective_permission('comunicados','edit') or public.has_effective_permission('comunicados','publish'))
with check (public.has_effective_permission('comunicados','create') or public.has_effective_permission('comunicados','edit') or public.has_effective_permission('comunicados','publish'));
drop policy if exists states_write on public.judicial_states;
create policy states_write on public.judicial_states for all to authenticated
using ((public.is_owner() or public.current_role()='SECRETARIO_GENERAL' or dependency_id=public.current_dependency_id()) and (public.has_effective_permission('estados','edit') or public.has_effective_permission('estados','publish')))
with check ((public.is_owner() or public.current_role()='SECRETARIO_GENERAL' or dependency_id=public.current_dependency_id()) and (public.has_effective_permission('estados','create') or public.has_effective_permission('estados','edit') or public.has_effective_permission('estados','publish')));

drop policy if exists hearing_minutes_write on public.hearing_minutes;
create policy hearing_minutes_write on public.hearing_minutes for all to authenticated
using (public.can_access_case(case_id) and (public.has_effective_permission('actas','edit') or public.has_effective_permission('actas','finalize') or public.has_effective_permission('actas','reopen') or public.has_effective_permission('actas','sign') or public.has_effective_permission('actas','archive')))
with check (public.can_access_case(case_id) and (public.has_effective_permission('actas','create') or public.has_effective_permission('actas','edit') or public.has_effective_permission('actas','finalize') or public.has_effective_permission('actas','reopen') or public.has_effective_permission('actas','sign') or public.has_effective_permission('actas','archive')));

drop policy if exists signature_requests_write on public.signature_requests;
create policy signature_requests_write on public.signature_requests for all to authenticated
using (public.can_access_case(case_id) and (public.has_effective_permission('firmas','request') or public.has_effective_permission('firmas','sign') or public.has_effective_permission('firmas','revoke')))
with check (public.can_access_case(case_id) and ((requested_by=auth.uid() and public.has_effective_permission('firmas','request')) or public.has_effective_permission('firmas','sign') or public.has_effective_permission('firmas','revoke')));

drop policy if exists share_links_write on public.share_links;
create policy share_links_write on public.share_links for all to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or created_by=auth.uid()) and public.has_effective_permission('enlaces','revoke'))
with check (public.can_access_case(case_id) and created_by=auth.uid() and (public.has_effective_permission('enlaces','create') or public.has_effective_permission('enlaces','revoke')));
drop policy if exists record_shares_insert on public.record_shares;
create policy record_shares_insert on public.record_shares for insert to authenticated with check (
  shared_by=auth.uid() and public.can_access_case(case_id) and (
    (resource_type='case' and resource_id=case_id and public.has_effective_permission('expedientes','share')) or
    (resource_type='proceeding' and public.has_effective_permission('providencias','share') and exists(select 1 from public.proceedings p where p.id=resource_id and p.case_id=case_id)) or
    (resource_type='document' and public.has_effective_permission('documentos','share') and exists(select 1 from public.documents d where d.id=resource_id and d.case_id=case_id and d.archived_at is null))
  )
);
drop policy if exists record_shares_revoke on public.record_shares;
create policy record_shares_revoke on public.record_shares for update to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or shared_by=auth.uid()) and (
  (resource_type='case' and public.has_effective_permission('expedientes','share')) or
  (resource_type='proceeding' and public.has_effective_permission('providencias','share')) or
  (resource_type='document' and public.has_effective_permission('documentos','share'))
)) with check (public.can_access_case(case_id) and (public.is_owner() or shared_by=auth.uid()));

-- Un registro publicado deja de ser público al archivarse y nunca salta la reserva del expediente.
drop policy if exists proceedings_public_read on public.proceedings;
create policy proceedings_public_read on public.proceedings for select to anon,authenticated using (
  (status='Publicado' and visibility='public' and archived_at is null and exists(
    select 1 from public.cases c where c.id=case_id and c.archived_at is null and c.public_visibility and c.confidentiality_level='Público'
  )) or (public.can_access_case(case_id) and public.has_effective_permission('providencias','view'))
);
drop policy if exists notices_public_read on public.public_notices;
create policy notices_public_read on public.public_notices for select using (
  (status='Publicado' and archived_at is null) or (public.is_active_internal() and public.has_effective_permission('comunicados','view'))
);
drop policy if exists states_public_read on public.judicial_states;
create policy states_public_read on public.judicial_states for select using (
  (status='Publicado' and archived_at is null) or (public.is_active_internal() and public.has_effective_permission('estados','view'))
);

-- Admite rutas antiguas sin bits de versión UUID, manteniendo carpeta de expediente obligatoria.
create or replace function public.storage_case_id(p_name text)
returns uuid language plpgsql immutable strict set search_path = public as $$
declare v_part text;
begin
  v_part := case when split_part(p_name,'/',1)='cases' then split_part(p_name,'/',2) else split_part(p_name,'/',1) end;
  if v_part !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  return v_part::uuid;
end $$;

drop policy if exists storage_internal_read on storage.objects;
create policy storage_internal_read on storage.objects for select to authenticated using (
  public.storage_case_id(name) is not null and public.can_access_case(public.storage_case_id(name)) and (
    (bucket_id='case-documents' and public.has_effective_permission('documentos','view') and (public.has_effective_permission('documentos','preview') or public.has_effective_permission('documentos','download'))) or
    (bucket_id='providence-files' and public.has_effective_permission('providencias','view')) or
    (bucket_id='signatures' and public.has_effective_permission('firmas','view'))
  )
);
drop policy if exists storage_internal_insert on storage.objects;
create policy storage_internal_insert on storage.objects for insert to authenticated with check (
  public.storage_case_id(name) is not null and public.can_access_case(public.storage_case_id(name)) and (
    (bucket_id='case-documents' and public.has_effective_permission('documentos','upload')) or
    (bucket_id='providence-files' and (public.has_effective_permission('providencias','create') or public.has_effective_permission('providencias','edit'))) or
    (bucket_id='signatures' and public.has_effective_permission('firmas','sign'))
  )
);
drop policy if exists storage_internal_delete on storage.objects;
create policy storage_internal_delete on storage.objects for delete to authenticated using (
  public.storage_case_id(name) is not null and public.can_access_case(public.storage_case_id(name)) and (
    (bucket_id='case-documents' and public.has_effective_permission('documentos','hard_delete')) or
    (bucket_id='providence-files' and (public.has_effective_permission('providencias','edit') or public.has_effective_permission('providencias','hard_delete'))) or
    (bucket_id='signatures' and public.has_effective_permission('firmas','revoke'))
  )
);

notify pgrst, 'reload schema';
