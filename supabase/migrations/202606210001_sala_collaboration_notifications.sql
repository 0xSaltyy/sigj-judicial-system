-- Edición colaborativa, decisiones de Sala, votos particulares y avisos internos.

alter table public.role_permission_rules drop constraint if exists role_permission_rules_resource_check;
alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_resource_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;

alter table public.role_permission_rules add constraint role_permission_rules_resource_check
  check (resource in ('expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones'));
alter table public.role_permission_rules add constraint role_permission_rules_action_check
  check (action in ('view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return'));
alter table public.user_permission_overrides add constraint user_permission_overrides_resource_check
  check (resource in ('expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones'));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check
  check (action in ('view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return'));

alter table public.signature_requests drop constraint if exists signature_requests_target_type_check;
alter table public.signatures drop constraint if exists signatures_target_type_check;
alter table public.signature_requests add constraint signature_requests_target_type_check check(target_type in ('proceeding','hearing_minute','certificate','document','vote_document'));
alter table public.signatures add constraint signatures_target_type_check check(target_type in ('proceeding','hearing_minute','certificate','document','vote_document'));

with catalog(resource, action) as (values
  ('edicion','take_control'),
  ('votos','view'),('votos','create'),('votos','edit'),('votos','sign'),('votos','publish'),('votos','print'),
  ('sala','view'),('sala','send'),('sala','register_session'),('sala','register_vote'),('sala','approve'),('sala','return'),('sala','publish'),
  ('notificaciones','view'),('notificaciones','manage')
), roles(role) as (select unnest(enum_range(null::public.app_role)))
insert into public.role_permission_rules(role,resource,action,allowed)
select role,resource,action,
  case
    when role='SUPER_ADMIN' then true
    when resource='notificaciones' and action='view' and role <> 'CONSULTA_PUBLICA' then true
    when resource='edicion' and action='take_control' and role in ('SECRETARIO_GENERAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL') then true
    when resource='votos' and action in ('view','create','edit','sign','publish','print') and role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL') then true
    when resource='votos' and action in ('view','print') and role in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR') then true
    when resource='sala' and action in ('view','send','register_session','register_vote','approve','return','publish') and role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL') then true
    when resource='sala' and action in ('view','register_session','register_vote') and role in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO') then true
    else false
  end
from roles cross join catalog on conflict (role,resource,action) do nothing;

create table public.edit_locks (
  record_type text not null check (record_type in ('proceeding','hearing_minute','case','case_action','document')),
  record_id uuid not null,
  locked_by uuid not null references public.profiles(id) on delete cascade,
  locked_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 minutes'),
  primary key(record_type,record_id)
);
create index edit_locks_expiry_idx on public.edit_locks(expires_at);
alter table public.edit_locks enable row level security;
create policy edit_locks_read on public.edit_locks for select to authenticated using (public.is_active_internal());
revoke all on public.edit_locks from anon, authenticated;
grant select on public.edit_locks to authenticated;

create or replace function public.acquire_edit_lock(p_record_type text,p_record_id uuid,p_force boolean default false)
returns table(acquired boolean,locked_by uuid,locked_by_name text,locked_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_lock public.edit_locks%rowtype; v_can_force boolean;
begin
  if not public.is_active_internal() then raise exception 'Sesión institucional requerida'; end if;
  if p_record_type not in ('proceeding','hearing_minute','case','case_action','document') then raise exception 'Tipo de registro no válido'; end if;
  v_can_force := public.has_effective_permission('edicion','take_control');
  delete from public.edit_locks where expires_at <= now();
  select * into v_lock from public.edit_locks where record_type=p_record_type and record_id=p_record_id for update;
  if found and v_lock.locked_by <> auth.uid() and not (p_force and v_can_force) then
    return query select false,v_lock.locked_by,p.full_name,v_lock.locked_at,v_lock.expires_at from public.profiles p where p.id=v_lock.locked_by;
    return;
  end if;
  if found and v_lock.locked_by <> auth.uid() and p_force then
    perform public.log_security_event('EDIT_LOCK_TAKEN_OVER','edit_locks',p_record_id,'Control de edición asumido por usuario autorizado',jsonb_build_object('record_type',p_record_type,'previous_user_id',v_lock.locked_by));
  end if;
  insert into public.edit_locks(record_type,record_id,locked_by,locked_at,last_seen_at,expires_at)
  values(p_record_type,p_record_id,auth.uid(),now(),now(),now()+interval '4 minutes')
  on conflict(record_type,record_id) do update set locked_by=auth.uid(),locked_at=case when edit_locks.locked_by=auth.uid() then edit_locks.locked_at else now() end,last_seen_at=now(),expires_at=now()+interval '4 minutes';
  return query select true,e.locked_by,p.full_name,e.locked_at,e.expires_at from public.edit_locks e join public.profiles p on p.id=e.locked_by where e.record_type=p_record_type and e.record_id=p_record_id;
end $$;

create or replace function public.heartbeat_edit_lock(p_record_type text,p_record_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  update public.edit_locks set last_seen_at=now(),expires_at=now()+interval '4 minutes'
  where record_type=p_record_type and record_id=p_record_id and locked_by=auth.uid() and expires_at>now();
  return found;
end $$;

create or replace function public.release_edit_lock(p_record_type text,p_record_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  delete from public.edit_locks where record_type=p_record_type and record_id=p_record_id and (locked_by=auth.uid() or public.has_effective_permission('edicion','take_control'));
  return found;
end $$;

create or replace function public.assert_edit_lock(p_record_type text,p_record_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.edit_locks where record_type=p_record_type and record_id=p_record_id and locked_by=auth.uid() and expires_at>now()) then
    raise exception 'El bloqueo de edición no está vigente. Actualice la vista antes de guardar.';
  end if;
end $$;
revoke all on function public.acquire_edit_lock(text,uuid,boolean),public.heartbeat_edit_lock(text,uuid),public.release_edit_lock(text,uuid),public.assert_edit_lock(text,uuid) from public,anon;
grant execute on function public.acquire_edit_lock(text,uuid,boolean),public.heartbeat_edit_lock(text,uuid),public.release_edit_lock(text,uuid),public.assert_edit_lock(text,uuid) to authenticated;

create table public.sala_sessions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null unique references public.proceedings(id) on delete cascade,
  institution_style text not null check (institution_style in ('corte_suprema','tribunal_superior')),
  chamber text not null,
  session_type text not null default 'Sala ordinaria',
  act_number text,
  session_date date,
  rapporteur_id uuid references public.profiles(id) on delete set null,
  vote_result text,
  quorum integer check (quorum is null or quorum >= 0),
  status text not null default 'En estudio' check(status in ('En estudio','En sala','Aprobado en sala','Con salvamento/aclaración','Devuelto a ponente','Publicado','Archivado')),
  observations text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.sala_participants (
  sala_session_id uuid not null references public.sala_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  participation text not null default 'Participó',
  vote text check(vote is null or vote in ('A favor','En contra','Se abstiene','Impedido','Ausente')),
  primary key(sala_session_id,profile_id)
);
create table public.vote_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  institution_style text not null check(institution_style in ('corte_suprema','tribunal_superior')),
  vote_type text not null check(vote_type in ('Salvamento de voto','Aclaración de voto','Aclaración parcial','Salvamento parcial','Voto concurrente')),
  title text not null,
  content_markdown text not null,
  status text not null default 'Borrador' check(status in ('Borrador','Presentado','Firmado','Publicado')),
  visibility public.visibility_level not null default 'internal',
  signed_at timestamptz,
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vote_documents_parent_idx on public.vote_documents(proceeding_id,created_at);

create table public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_role public.app_role,
  recipient_dependency_id uuid references public.dependencies(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  link_url text,
  read_at timestamptz,
  priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  related_record_type text,
  related_record_id uuid,
  created_at timestamptz not null default now()
);
create index internal_notifications_recipient_idx on public.internal_notifications(recipient_user_id,read_at,created_at desc);

alter table public.sala_sessions enable row level security;
alter table public.sala_participants enable row level security;
alter table public.vote_documents enable row level security;
alter table public.internal_notifications enable row level security;
create policy sala_read on public.sala_sessions for select to authenticated using(public.can_access_case(case_id) and public.has_effective_permission('sala','view'));
create policy sala_write on public.sala_sessions for all to authenticated using(public.can_access_case(case_id) and (public.has_effective_permission('sala','register_session') or public.has_effective_permission('sala','register_vote') or public.has_effective_permission('sala','approve') or public.has_effective_permission('sala','publish'))) with check(public.can_access_case(case_id) and (public.has_effective_permission('sala','register_session') or public.has_effective_permission('sala','register_vote') or public.has_effective_permission('sala','approve') or public.has_effective_permission('sala','publish')));
create policy sala_participants_read on public.sala_participants for select to authenticated using(exists(select 1 from public.sala_sessions s where s.id=sala_session_id and public.can_access_case(s.case_id) and public.has_effective_permission('sala','view')));
create policy sala_participants_write on public.sala_participants for all to authenticated using(exists(select 1 from public.sala_sessions s where s.id=sala_session_id and public.can_access_case(s.case_id) and (public.has_effective_permission('sala','register_session') or public.has_effective_permission('sala','register_vote')))) with check(exists(select 1 from public.sala_sessions s where s.id=sala_session_id and public.can_access_case(s.case_id) and (public.has_effective_permission('sala','register_session') or public.has_effective_permission('sala','register_vote'))));
create policy votes_read on public.vote_documents for select to authenticated using(public.can_access_case(case_id) and public.has_effective_permission('votos','view'));
create policy votes_write on public.vote_documents for all to authenticated using(public.can_access_case(case_id) and public.has_effective_permission('votos','edit') and (author_id=auth.uid() or public.is_owner())) with check(public.can_access_case(case_id) and public.has_effective_permission('votos','create') and created_by=auth.uid());
create policy notifications_own_read on public.internal_notifications for select to authenticated using(recipient_user_id=auth.uid());
create policy notifications_own_update on public.internal_notifications for update to authenticated using(recipient_user_id=auth.uid()) with check(recipient_user_id=auth.uid());
revoke all on public.sala_sessions,public.sala_participants,public.vote_documents,public.internal_notifications from anon;
grant select,insert,update,delete on public.sala_sessions,public.sala_participants,public.vote_documents to authenticated;
grant select,update on public.internal_notifications to authenticated;

create or replace function public.create_internal_notification(p_recipient uuid,p_title text,p_message text,p_type text,p_link_url text default null,p_priority text default 'normal',p_record_type text default null,p_record_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_active_internal() then raise exception 'Sesión institucional requerida'; end if;
  if not exists(select 1 from public.profiles where id=p_recipient and is_active) then return null; end if;
  insert into public.internal_notifications(recipient_user_id,title,message,type,link_url,priority,related_record_type,related_record_id)
  values(p_recipient,left(p_title,180),left(p_message,500),left(p_type,80),case when p_link_url like '/admin/%' then p_link_url else null end,p_priority,p_record_type,p_record_id)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_internal_notification(uuid,text,text,text,text,text,text,uuid) from public,anon;
grant execute on function public.create_internal_notification(uuid,text,text,text,text,text,text,uuid) to authenticated;

create or replace function public.list_sala_eligible_profiles(p_case_id uuid)
returns table(id uuid,full_name text,position_title text,role public.app_role)
language sql stable security definer set search_path=public as $$
  select p.id,p.full_name,p.position_title,p.role from public.profiles p
  join public.cases c on c.id=p_case_id
  where public.can_access_case(c.id) and p.is_active
    and p.role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL')
    and (public.is_owner() or p.dependency_id=c.dependency_id or p.id=c.assigned_judge_id)
  order by p.full_name
$$;
revoke all on function public.list_sala_eligible_profiles(uuid) from public,anon;
grant execute on function public.list_sala_eligible_profiles(uuid) to authenticated;

create or replace function public.notify_case_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_case public.cases%rowtype; v_recipient uuid; v_type text; v_title text; v_message text; v_link text; v_record uuid;
begin
  if tg_table_name='cases' then
    if tg_op='UPDATE' and new.assigned_judge_id is distinct from old.assigned_judge_id and new.assigned_judge_id is not null then
      v_recipient:=new.assigned_judge_id; v_type:='ponente_asignado'; v_title:='Nueva asignación como ponente'; v_message:='Se le asignó un expediente. Consulte el registro para conocer los detalles autorizados.'; v_link:='/admin/expedientes/'||new.id; v_record:=new.id;
    else return new; end if;
  elsif tg_table_name='documents' then
    select * into v_case from public.cases where id=new.case_id;
    v_recipient:=coalesce(v_case.assigned_judge_id,v_case.created_by); v_type:='documento_agregado'; v_title:='Documento agregado'; v_message:=case when new.visibility::text in ('reserved','internal') then 'Se agregó un documento reservado o interno a un expediente.' else 'Se agregó un documento a un expediente.' end; v_link:='/admin/expedientes/'||new.case_id; v_record:=new.id;
  elsif tg_table_name='proceedings' then
    if tg_op='UPDATE' and new.status='Publicado' and old.status is distinct from new.status then
      select * into v_case from public.cases where id=new.case_id; v_recipient:=coalesce(v_case.assigned_judge_id,new.created_by); v_type:='providencia_publicada'; v_title:='Providencia publicada'; v_message:='Una providencia del expediente fue publicada.'; v_link:='/admin/providencias/'||new.id; v_record:=new.id;
    else return new; end if;
  elsif tg_table_name='hearings' then
    select * into v_case from public.cases where id=new.case_id; v_recipient:=coalesce(v_case.assigned_judge_id,new.created_by); v_type:=case when tg_op='INSERT' then 'audiencia_programada' else 'audiencia_reprogramada' end; v_title:=case when tg_op='INSERT' then 'Audiencia programada' else 'Audiencia actualizada' end; v_message:='Consulte la agenda para revisar fecha, sala y estado.'; v_link:='/admin/audiencias'; v_record:=new.id;
  else return new; end if;
  if v_recipient is not null and v_recipient is distinct from auth.uid() then insert into public.internal_notifications(recipient_user_id,title,message,type,link_url,priority,related_record_type,related_record_id) values(v_recipient,v_title,v_message,v_type,v_link,'normal',tg_table_name,v_record); end if;
  return new;
end $$;
create trigger notify_case_assignment after update of assigned_judge_id on public.cases for each row execute function public.notify_case_activity();
create trigger notify_document_added after insert on public.documents for each row execute function public.notify_case_activity();
create trigger notify_providence_published after update of status on public.proceedings for each row execute function public.notify_case_activity();
create trigger notify_hearing_scheduled after insert or update of scheduled_at,status on public.hearings for each row execute function public.notify_case_activity();

create or replace function public.notify_permission_target() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.user_id is distinct from auth.uid() and not exists(select 1 from public.internal_notifications where recipient_user_id=new.user_id and type='permiso_actualizado' and created_at>now()-interval '1 minute') then insert into public.internal_notifications(recipient_user_id,title,message,type,link_url,priority,related_record_type,related_record_id) values(new.user_id,'Permisos actualizados','Sus permisos personalizados fueron actualizados.','permiso_actualizado','/admin/dashboard','high','user_permission_override',new.user_id); end if;
  return new;
end $$;
create trigger notify_permission_override after insert or update on public.user_permission_overrides for each row execute function public.notify_permission_target();

create trigger sala_sessions_updated before update on public.sala_sessions for each row execute function public.set_updated_at();
create trigger vote_documents_updated before update on public.vote_documents for each row execute function public.set_updated_at();

do $$ begin
  alter publication supabase_realtime add table public.edit_locks;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.sala_sessions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.vote_documents;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.internal_notifications;
exception when duplicate_object then null; end $$;

notify pgrst,'reload schema';
