-- Seguimiento público seguro de postulaciones sin exponer la tabla ni campos internos.
alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message'
));

insert into public.role_permission_rules(role,resource,action,allowed)
select role,'seleccion',new_action,allowed from public.role_permission_rules
cross join (values('update_application_status'),('edit_public_message')) actions(new_action)
where resource='seleccion' and action='edit_applications'
on conflict(role,resource,action) do nothing;

alter table public.selection_applications
  add column tracking_code varchar(40),
  add column public_message varchar(1000),
  add column public_updated_at timestamptz,
  add column receipt_token_hash text,
  add column receipt_expires_at timestamptz;

update public.selection_applications set
  tracking_code='POST-'||extract(year from created_at)::int||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20)),
  public_updated_at=created_at
where tracking_code is null;
alter table public.selection_applications alter column tracking_code set not null;
alter table public.selection_applications alter column public_updated_at set default now();
create unique index selection_applications_tracking_code_key on public.selection_applications(tracking_code);
create unique index selection_applications_receipt_hash_key on public.selection_applications(receipt_token_hash) where receipt_token_hash is not null;

create or replace function public.set_selection_application_public_update() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.status is distinct from old.status or new.public_message is distinct from old.public_message then new.public_updated_at:=now(); end if;
  return new;
end $$;
create trigger selection_application_public_update before update on public.selection_applications for each row execute function public.set_selection_application_public_update();

create or replace function public.guard_selection_application() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or coalesce(auth.role(),'')='service_role' then return new; end if;
  if new.process_id is distinct from old.process_id or new.tracking_code is distinct from old.tracking_code then raise exception 'La identidad de la postulación no puede cambiarse'; end if;
  if (new.score,new.reviewed_by,new.internal_notes) is distinct from (old.score,old.reviewed_by,old.internal_notes)
     and not public.has_effective_permission('seleccion','evaluate_applications') then raise exception 'No tiene permiso para evaluar postulaciones'; end if;
  if new.status is distinct from old.status and not public.has_effective_permission('seleccion','update_application_status') then raise exception 'No tiene permiso para actualizar el estado de la postulación'; end if;
  if new.public_message is distinct from old.public_message and not public.has_effective_permission('seleccion','edit_public_message') then raise exception 'No tiene permiso para editar el mensaje público'; end if;
  return new;
end $$;

create or replace function public.audit_selection_application_safe() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_row public.selection_applications%rowtype;
begin
  if tg_op='DELETE' then v_row:=old; else v_row:=new; end if;
  insert into public.audit_logs(user_id,action,table_name,record_id,description,old_values,new_values,metadata)
  values(auth.uid(),case when tg_op='INSERT' then 'SELECTION_APPLICATION_RECEIVED' when tg_op='UPDATE' then 'SELECTION_APPLICATION_UPDATED' else 'SELECTION_APPLICATION_DELETED' end,
    'selection_applications',v_row.id,case when tg_op='INSERT' then 'Postulación recibida' when tg_op='UPDATE' then 'Estado o comunicación pública de postulación actualizado' else 'Postulación eliminada' end,
    case when tg_op='UPDATE' then jsonb_build_object('status',old.status,'score',old.score,'public_message_present',old.public_message is not null) else null end,
    case when tg_op<>'DELETE' then jsonb_build_object('status',new.status,'score',new.score,'public_message_present',new.public_message is not null) else null end,
    jsonb_build_object('process_id',v_row.process_id,'source',v_row.source));
  return v_row;
end $$;

drop function if exists public.submit_selection_application(uuid,text,text,text,text,text,text,text);
create function public.submit_selection_application(
  p_process_id uuid,p_name text,p_email text,p_identifier text,p_phone text,p_statement text,p_experience text,p_website text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_process public.selection_processes%rowtype; v_id uuid; v_tracking text; v_receipt text;
begin
  if nullif(trim(coalesce(p_website,'')),'') is not null then raise exception 'Solicitud no válida'; end if;
  select * into v_process from public.selection_processes where id=p_process_id and visibility='publico' and status='abierto' and now() between opening_at and closing_at;
  if not found then raise exception 'La convocatoria no está recibiendo postulaciones'; end if;
  if length(trim(p_name))<3 or length(trim(p_name))>180 or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(trim(p_statement))<20 then raise exception 'Revise los datos obligatorios'; end if;
  v_tracking:='POST-'||extract(year from now())::int||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20));
  v_receipt:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.selection_applications(process_id,applicant_name,applicant_email,applicant_identifier,phone,statement,experience,source,tracking_code,public_updated_at,receipt_token_hash,receipt_expires_at)
  values(p_process_id,trim(p_name),lower(trim(p_email)),nullif(trim(p_identifier),''),nullif(trim(p_phone),''),trim(p_statement),nullif(trim(p_experience),''),'publico',v_tracking,now(),md5(v_receipt),now()+interval '30 minutes') returning id into v_id;
  return jsonb_build_object('receipt_token',v_receipt);
exception when unique_violation then raise exception 'Ya existe una postulación para este correo en la convocatoria';
end $$;
revoke all on function public.submit_selection_application(uuid,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_selection_application(uuid,text,text,text,text,text,text,text) to anon,authenticated;

create or replace function public.get_selection_application_receipt(p_receipt_token text)
returns table(tracking_code text,applicant_name text,submitted_at timestamptz,application_status text,process_title text,position_title text,dependency_name text,institution_name text)
language sql stable security definer set search_path=public as $$
  select a.tracking_code,a.applicant_name,a.created_at,a.status,p.title,p.position_title,d.name,i.name
  from public.selection_applications a join public.selection_processes p on p.id=a.process_id
  join public.dependencies d on d.id=p.dependency_id join public.dependencies i on i.id=p.institution_id
  where a.receipt_token_hash=md5(coalesce(p_receipt_token,'')) and a.receipt_expires_at>now()
  limit 1
$$;
revoke all on function public.get_selection_application_receipt(text) from public;
grant execute on function public.get_selection_application_receipt(text) to anon,authenticated;

create or replace function public.lookup_selection_application_status(p_tracking_code text,p_email text)
returns table(process_title text,position_title text,institution_name text,dependency_name text,applicant_name text,submitted_at timestamptz,public_status text,public_updated_at timestamptz,public_message text)
language plpgsql security definer set search_path=public as $$
begin
  perform pg_sleep(0.12);
  return query
  select p.title,p.position_title,i.name,d.name,a.applicant_name,a.created_at,
    case when p.status='cancelado' then 'proceso_cancelado' when p.status in ('cerrado','finalizado','archivado') and a.status not in ('aceptada','rechazada','archivada') then 'proceso_cerrado' else a.status end,
    greatest(coalesce(a.public_updated_at,a.created_at),case when p.status in ('cancelado','cerrado','finalizado','archivado') then p.updated_at else a.created_at end),a.public_message
  from public.selection_applications a join public.selection_processes p on p.id=a.process_id
  join public.dependencies d on d.id=p.dependency_id join public.dependencies i on i.id=p.institution_id
  where upper(a.tracking_code)=upper(trim(coalesce(p_tracking_code,''))) and lower(a.applicant_email)=lower(trim(coalesce(p_email,'')))
  limit 1;
end $$;
revoke all on function public.lookup_selection_application_status(text,text) from public;
grant execute on function public.lookup_selection_application_status(text,text) to anon,authenticated;
notify pgrst,'reload schema';
