-- Agenda completa y procesos de selección con aislamiento por institución/despacho.

alter table public.role_permission_rules drop constraint if exists role_permission_rules_resource_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_resource_check;
alter table public.role_permission_rules add constraint role_permission_rules_resource_check check (resource in (
  'expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones','instituciones','dependencias','perfil','seleccion'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_resource_check check (resource in (
  'expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones','instituciones','dependencias','perfil','seleccion'
));

alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close'
));

with permissions(resource,action) as (values
  ('audiencias','mark_completed'),('audiencias','create_minutes'),('audiencias','view_all'),('audiencias','view_dependency'),('audiencias','view_institution'),
  ('seleccion','view'),('seleccion','create'),('seleccion','edit'),('seleccion','publish'),('seleccion','close'),('seleccion','cancel'),
  ('seleccion','view_applications'),('seleccion','edit_applications'),('seleccion','evaluate_applications'),
  ('seleccion','view_all'),('seleccion','view_institution'),('seleccion','view_dependency')
), roles(role) as (select unnest(enum_range(null::public.app_role)))
insert into public.role_permission_rules(role,resource,action,allowed)
select role,resource,action,
  case
    when role='SUPER_ADMIN' then true
    when resource='audiencias' and action in ('mark_completed','create_minutes','view_dependency') and role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO') then true
    when resource='audiencias' and action='view_institution' and role='ADMIN_INSTITUCIONAL' then true
    when resource='seleccion' and action in ('view','create','edit','publish','close','cancel','view_applications','edit_applications','evaluate_applications','view_dependency') and role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO') then true
    when resource='seleccion' and action in ('view','create','edit','publish','close','cancel','view_applications','edit_applications','evaluate_applications','view_institution') and role='ADMIN_INSTITUCIONAL' then true
    when resource='seleccion' and action in ('view','view_applications','edit_applications','view_dependency') and role in ('OFICIAL_MAYOR','AUXILIAR') then true
    else false
  end
from roles cross join permissions
on conflict(role,resource,action) do nothing;

create table public.selection_processes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  institution_id uuid not null references public.dependencies(id) on delete restrict,
  dependency_id uuid not null references public.dependencies(id) on delete restrict,
  title varchar(180) not null,
  position_title varchar(160) not null,
  description text not null,
  requirements text not null,
  responsibilities text,
  opening_at timestamptz not null,
  closing_at timestamptz not null,
  status text not null default 'borrador' check(status in ('borrador','abierto','cerrado','en_revision','preseleccion','entrevistas','finalizado','cancelado','archivado')),
  vacancies integer not null default 1 check(vacancies between 1 and 100),
  visibility text not null default 'interno' check(visibility in ('interno','publico')),
  application_instructions text,
  created_by uuid not null references auth.users(id) on delete restrict,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint selection_process_dates check(closing_at > opening_at)
);
create index selection_process_scope_idx on public.selection_processes(institution_id,dependency_id,status,closing_at desc);

create table public.selection_applications (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.selection_processes(id) on delete restrict,
  applicant_name varchar(180) not null,
  applicant_email varchar(320) not null,
  applicant_identifier varchar(160),
  phone varchar(80),
  statement text not null,
  experience text,
  status text not null default 'recibida' check(status in ('recibida','en_revision','preseleccionada','rechazada','entrevista','aceptada','archivada')),
  internal_notes text,
  score numeric(5,2) check(score is null or (score between 0 and 100)),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  source text not null default 'interno' check(source in ('interno','publico')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index selection_application_process_idx on public.selection_applications(process_id,status,created_at desc);
create unique index selection_application_email_unique on public.selection_applications(process_id,lower(applicant_email));

create trigger selection_processes_updated before update on public.selection_processes for each row execute function public.set_updated_at();
create trigger selection_applications_updated before update on public.selection_applications for each row execute function public.set_updated_at();
create trigger audit_selection_processes after insert or update or delete on public.selection_processes for each row execute function public.audit_change();
create or replace function public.audit_selection_application_safe() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_row public.selection_applications%rowtype;
begin
  if tg_op='DELETE' then v_row:=old; else v_row:=new; end if;
  insert into public.audit_logs(user_id,action,table_name,record_id,description,old_values,new_values,metadata)
  values(auth.uid(),case when tg_op='INSERT' then 'SELECTION_APPLICATION_RECEIVED' when tg_op='UPDATE' then 'SELECTION_APPLICATION_UPDATED' else 'SELECTION_APPLICATION_DELETED' end,
    'selection_applications',v_row.id,case when tg_op='INSERT' then 'Postulación recibida' when tg_op='UPDATE' then 'Estado o evaluación de postulación actualizado' else 'Postulación eliminada' end,
    case when tg_op='UPDATE' then jsonb_build_object('status',old.status,'score',old.score) else null end,
    case when tg_op<>'DELETE' then jsonb_build_object('status',new.status,'score',new.score) else null end,
    jsonb_build_object('process_id',v_row.process_id,'source',v_row.source));
  return v_row;
end $$;
create trigger audit_selection_applications after insert or update or delete on public.selection_applications for each row execute function public.audit_selection_application_safe();

create or replace function public.notify_selection_application() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_process public.selection_processes%rowtype; v_recipient uuid;
begin
  select * into v_process from public.selection_processes where id=new.process_id;
  select coalesce(v_process.responsible_user_id,(select id from public.profiles where dependency_id=v_process.dependency_id and is_active and is_dependency_leader order by created_at limit 1),v_process.created_by) into v_recipient;
  if v_recipient is not null then
    insert into public.internal_notifications(recipient_user_id,title,message,type,link_url,priority,related_record_type,related_record_id)
    values(v_recipient,'Nueva postulación recibida','Un proceso de selección de su despacho tiene una nueva postulación pendiente de revisión.','seleccion_postulacion',format('/admin/seleccion/%s',v_process.id),'normal','selection_application',new.id);
  end if;
  return new;
end $$;
create trigger notify_selection_application after insert on public.selection_applications for each row execute function public.notify_selection_application();

create or replace function public.can_access_selection_scope(p_institution uuid,p_dependency uuid,p_action text default 'view')
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.is_active
      and public.has_effective_permission('seleccion',p_action,p.id)
      and (
        (p.is_owner and p.role='SUPER_ADMIN')
        or public.has_effective_permission('seleccion','view_all',p.id)
        or (public.has_effective_permission('seleccion','view_institution',p.id) and p.institution_id=p_institution)
        or (public.has_effective_permission('seleccion','view_dependency',p.id) and p.dependency_id=p_dependency)
      )
  )
$$;
revoke all on function public.can_access_selection_scope(uuid,uuid,text) from public,anon;
grant execute on function public.can_access_selection_scope(uuid,uuid,text) to authenticated,service_role;

alter table public.selection_processes enable row level security;
alter table public.selection_applications enable row level security;
create policy selection_process_read on public.selection_processes for select to authenticated
using(public.can_access_selection_scope(institution_id,dependency_id,'view'));
create policy selection_process_insert on public.selection_processes for insert to authenticated
with check(created_by=auth.uid() and public.can_access_selection_scope(institution_id,dependency_id,'create'));
create policy selection_process_update on public.selection_processes for update to authenticated
using(public.can_access_selection_scope(institution_id,dependency_id,'edit'))
with check(public.can_access_selection_scope(institution_id,dependency_id,'edit'));
create policy selection_application_read on public.selection_applications for select to authenticated
using(exists(select 1 from public.selection_processes p where p.id=process_id and public.can_access_selection_scope(p.institution_id,p.dependency_id,'view_applications')));
create policy selection_application_update on public.selection_applications for update to authenticated
using(exists(select 1 from public.selection_processes p where p.id=process_id and public.can_access_selection_scope(p.institution_id,p.dependency_id,'edit_applications')))
with check(exists(select 1 from public.selection_processes p where p.id=process_id and public.can_access_selection_scope(p.institution_id,p.dependency_id,'edit_applications')));

create or replace function public.guard_selection_process() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or coalesce(auth.role(),'')='service_role' then return new; end if;
  if tg_op='INSERT' then
    if new.created_by<>auth.uid() or not public.can_access_selection_scope(new.institution_id,new.dependency_id,'create') then raise exception 'No tiene permiso para crear el proceso en este despacho'; end if;
  else
    if new.institution_id is distinct from old.institution_id or new.dependency_id is distinct from old.dependency_id then raise exception 'El alcance del proceso no puede cambiarse'; end if;
    if new.status='abierto' and old.status is distinct from 'abierto' and not public.has_effective_permission('seleccion','publish') then raise exception 'No tiene permiso para publicar procesos'; end if;
    if new.status in ('cerrado','finalizado') and old.status is distinct from new.status and not public.has_effective_permission('seleccion','close') then raise exception 'No tiene permiso para cerrar procesos'; end if;
    if new.status='cancelado' and old.status is distinct from 'cancelado' and not public.has_effective_permission('seleccion','cancel') then raise exception 'No tiene permiso para cancelar procesos'; end if;
  end if;
  return new;
end $$;
create trigger selection_process_guard before insert or update on public.selection_processes for each row execute function public.guard_selection_process();

create or replace function public.guard_selection_application() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or coalesce(auth.role(),'')='service_role' then return new; end if;
  if new.process_id is distinct from old.process_id then raise exception 'La postulación no puede trasladarse a otro proceso'; end if;
  if (new.score,new.reviewed_by,new.internal_notes) is distinct from (old.score,old.reviewed_by,old.internal_notes)
     and not public.has_effective_permission('seleccion','evaluate_applications') then raise exception 'No tiene permiso para evaluar postulaciones'; end if;
  if new.status is distinct from old.status and not public.has_effective_permission('seleccion','edit_applications') then raise exception 'No tiene permiso para cambiar el estado'; end if;
  return new;
end $$;
create trigger selection_application_guard before update on public.selection_applications for each row execute function public.guard_selection_application();

create or replace function public.can_access_hearing(p_hearing_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_effective_permission('audiencias','view',auth.uid()) and exists(
    select 1 from public.hearings h join public.cases c on c.id=h.case_id join public.profiles p on p.id=auth.uid() and p.is_active
    where h.id=p_hearing_id and (
      (p.is_owner and p.role='SUPER_ADMIN')
      or public.has_effective_permission('audiencias','view_all',p.id)
      or (public.has_effective_permission('audiencias','view_institution',p.id) and p.institution_id is not null and public.dependency_is_within(c.dependency_id,p.institution_id))
      or (public.has_effective_permission('audiencias','view_dependency',p.id) and c.dependency_id=p.dependency_id)
      or c.assigned_judge_id=p.id or h.created_by=p.id or public.can_access_case(c.id)
    )
  )
$$;
revoke all on function public.can_access_hearing(uuid) from public,anon;
grant execute on function public.can_access_hearing(uuid) to authenticated,service_role;

drop policy if exists hearings_read on public.hearings;
drop policy if exists hearings_write on public.hearings;
create policy hearings_read on public.hearings for select to authenticated using(public.can_access_hearing(id));
create policy hearings_write on public.hearings for all to authenticated
using(public.can_access_hearing(id) and (public.has_effective_permission('audiencias','edit') or public.has_effective_permission('audiencias','reschedule') or public.has_effective_permission('audiencias','cancel') or public.has_effective_permission('audiencias','mark_completed')))
with check((public.has_effective_permission('audiencias','create') and public.can_access_case(case_id)) or public.can_access_hearing(id));

drop policy if exists hearing_minutes_read on public.hearing_minutes;
drop policy if exists hearing_minutes_write on public.hearing_minutes;
create policy hearing_minutes_read on public.hearing_minutes for select to authenticated
using(public.can_access_hearing(hearing_id) and public.has_effective_permission('actas','view'));
create policy hearing_minutes_write on public.hearing_minutes for all to authenticated
using(public.can_access_hearing(hearing_id) and (public.has_effective_permission('actas','edit') or public.has_effective_permission('actas','finalize') or public.has_effective_permission('actas','reopen') or public.has_effective_permission('actas','sign') or public.has_effective_permission('actas','archive')))
with check(public.can_access_hearing(hearing_id) and (public.has_effective_permission('actas','create') or public.has_effective_permission('actas','edit') or public.has_effective_permission('actas','finalize') or public.has_effective_permission('actas','reopen') or public.has_effective_permission('actas','sign') or public.has_effective_permission('actas','archive')));

create or replace view public.hearing_agenda_secure with (security_barrier=true) as
select h.id,h.case_id,h.title,h.hearing_type,h.scheduled_at,h.end_at,h.room,h.virtual_link,h.status,h.is_public,h.participants,h.notes,h.created_by,h.archived_at,
  c.internal_number,c.judicial_number,c.title case_title,c.ticket_name,c.chamber,c.authority_type,c.dependency_id,c.assigned_judge_id,
  d.name dependency_name,j.full_name judge_name,j.is_owner judge_is_owner,m.id minute_id,m.status minute_status
from public.hearings h join public.cases c on c.id=h.case_id
left join public.dependencies d on d.id=c.dependency_id left join public.profiles j on j.id=c.assigned_judge_id
left join public.hearing_minutes m on m.hearing_id=h.id
where public.can_access_hearing(h.id);
revoke all on public.hearing_agenda_secure from anon;
grant select on public.hearing_agenda_secure to authenticated;

create or replace function public.guard_hearing_permissions()
returns trigger language plpgsql security definer set search_path=public as $$
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
  if new.status='Realizada' and old.status is distinct from 'Realizada' then
    if not public.has_effective_permission('audiencias','mark_completed') then raise exception 'No tiene permiso para marcar la audiencia como realizada'; end if;
    return new;
  end if;
  if not public.has_effective_permission('audiencias','edit') then raise exception 'No tiene permiso para editar audiencias'; end if;
  if (new.scheduled_at,new.end_at) is distinct from (old.scheduled_at,old.end_at)
     and not public.has_effective_permission('audiencias','reschedule') then raise exception 'No tiene permiso para reprogramar audiencias'; end if;
  if new.status='Cancelada' and old.status is distinct from 'Cancelada'
     and not public.has_effective_permission('audiencias','cancel') then raise exception 'No tiene permiso para cancelar audiencias'; end if;
  return new;
end $$;

create or replace view public.public_selection_processes with (security_barrier=true) as
select p.id,p.slug,p.title,p.position_title,p.description,p.requirements,p.responsibilities,p.opening_at,p.closing_at,p.vacancies,p.application_instructions,
  d.name dependency_name,i.name institution_name
from public.selection_processes p
join public.dependencies d on d.id=p.dependency_id
join public.dependencies i on i.id=p.institution_id
where p.visibility='publico' and p.status='abierto' and now() between p.opening_at and p.closing_at;
grant select on public.public_selection_processes to anon,authenticated;

create or replace function public.submit_selection_application(
  p_process_id uuid,p_name text,p_email text,p_identifier text,p_phone text,p_statement text,p_experience text,p_website text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_process public.selection_processes%rowtype; v_id uuid;
begin
  if nullif(trim(coalesce(p_website,'')),'') is not null then raise exception 'Solicitud no válida'; end if;
  select * into v_process from public.selection_processes where id=p_process_id and visibility='publico' and status='abierto' and now() between opening_at and closing_at;
  if not found then raise exception 'La convocatoria no está recibiendo postulaciones'; end if;
  if length(trim(p_name))<3 or length(trim(p_name))>180 or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(trim(p_statement))<20 then raise exception 'Revise los datos obligatorios'; end if;
  insert into public.selection_applications(process_id,applicant_name,applicant_email,applicant_identifier,phone,statement,experience,source)
  values(p_process_id,trim(p_name),lower(trim(p_email)),nullif(trim(p_identifier),''),nullif(trim(p_phone),''),trim(p_statement),nullif(trim(p_experience),''),'publico') returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'Ya existe una postulación para este correo en la convocatoria';
end $$;
revoke all on function public.submit_selection_application(uuid,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_selection_application(uuid,text,text,text,text,text,text,text) to anon,authenticated;

grant select,insert,update on public.selection_processes to authenticated;
grant select,update on public.selection_applications to authenticated;
revoke all on public.selection_processes,public.selection_applications from anon;
notify pgrst,'reload schema';
