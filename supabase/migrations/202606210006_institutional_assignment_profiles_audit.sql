-- Perfiles institucionales, alcance jerárquico, firma predeterminada y asunto breve.
alter table public.profiles
  add column if not exists institution_id uuid references public.dependencies(id) on delete restrict,
  add column if not exists supervisor_id uuid references public.profiles(id) on delete set null,
  add column if not exists avatar_path text,
  add column if not exists default_signature_path text,
  add column if not exists public_profile boolean not null default false;

alter table public.cases
  add column if not exists ticket_name varchar(120);

alter table public.dependencies
  add column if not exists description text,
  add column if not exists logo_path text,
  add column if not exists contact_info jsonb not null default '{}'::jsonb,
  add column if not exists public_visible boolean not null default true;

create index if not exists profiles_institution_idx on public.profiles(institution_id, dependency_id);
create index if not exists profiles_supervisor_idx on public.profiles(supervisor_id);
create index if not exists cases_ticket_name_idx on public.cases(ticket_name);

alter table public.role_permission_rules drop constraint if exists role_permission_rules_resource_check;
alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_resource_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;

alter table public.role_permission_rules add constraint role_permission_rules_resource_check check (resource in (
  'expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados',
  'usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones',
  'instituciones','dependencias'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_resource_check check (resource in (
  'expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados',
  'usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones',
  'instituciones','dependencias'
));
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize',
  'reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate',
  'assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return',
  'create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','export'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize',
  'reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate',
  'assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return',
  'create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','export'
));

with catalog(resource, action) as (values
  ('usuarios','create_in_institution'),('usuarios','create_in_dependency'),('usuarios','assign_dependency'),
  ('usuarios','view_all'),('usuarios','view_dependency'),('auditoria','export'),
  ('instituciones','view'),('instituciones','manage'),('dependencias','view'),('dependencias','manage')
), roles(role) as (select unnest(enum_range(null::public.app_role)))
insert into public.role_permission_rules(role,resource,action,allowed)
select role,resource,action,false from roles cross join catalog
on conflict (role,resource,action) do nothing;

update public.role_permission_rules set allowed=true
where role='SUPER_ADMIN' and ((resource='usuarios' and action in ('create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency'))
  or (resource='auditoria' and action='export') or resource in ('instituciones','dependencias'));
update public.role_permission_rules set allowed=true
where role='ADMIN_INSTITUCIONAL' and ((resource='usuarios' and action in ('view','create','edit','create_in_institution','create_in_dependency','assign_dependency','assign_role','view_dependency'))
  or (resource in ('instituciones','dependencias') and action='view'));
update public.role_permission_rules set allowed=true
where role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL')
  and resource='usuarios' and action in ('view','create','create_in_dependency','view_dependency');

create or replace function public.dependency_is_within(p_child uuid, p_parent uuid)
returns boolean language sql stable security definer set search_path=public as $$
  with recursive tree as (
    select id,parent_id from public.dependencies where id=p_child
    union all select d.id,d.parent_id from public.dependencies d join tree t on t.parent_id=d.id
  ) select exists(select 1 from tree where id=p_parent);
$$;
revoke all on function public.dependency_is_within(uuid,uuid) from public;
grant execute on function public.dependency_is_within(uuid,uuid) to authenticated, service_role;

-- El bucket es privado. La firma guardada nunca se publica ni se aplica sin una acción de firma confirmada.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-assets','profile-assets',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists profile_assets_self_read on storage.objects;
drop policy if exists profile_assets_self_insert on storage.objects;
drop policy if exists profile_assets_self_update on storage.objects;
drop policy if exists profile_assets_self_delete on storage.objects;
create policy profile_assets_self_read on storage.objects for select to authenticated
  using (bucket_id='profile-assets' and (storage.foldername(name))[1]=auth.uid()::text);
create policy profile_assets_self_insert on storage.objects for insert to authenticated
  with check (bucket_id='profile-assets' and (storage.foldername(name))[1]=auth.uid()::text);
create policy profile_assets_self_update on storage.objects for update to authenticated
  using (bucket_id='profile-assets' and (storage.foldername(name))[1]=auth.uid()::text)
  with check (bucket_id='profile-assets' and (storage.foldername(name))[1]=auth.uid()::text);
create policy profile_assets_self_delete on storage.objects for delete to authenticated
  using (bucket_id='profile-assets' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace view public.public_institutions with (security_barrier=true) as
select id,parent_id,name,code,type,level,competence,jurisdiction,route_slug,description,logo_path,contact_info
from public.dependencies where is_active and archived_at is null and public_visible;

create or replace view public.public_institution_members with (security_barrier=true) as
select p.id,p.full_name,p.position_title,p.institution_id,p.dependency_id,p.avatar_path
from public.profiles p
join public.dependencies d on d.id=coalesce(p.dependency_id,p.institution_id)
where p.is_active and p.public_profile and not p.is_owner and d.is_active and d.archived_at is null and d.public_visible;

grant select on public.public_institutions,public.public_institution_members to anon,authenticated;

drop policy if exists audit_permission_read on public.audit_logs;
create policy audit_permission_read on public.audit_logs for select to authenticated
using (public.has_effective_permission('auditoria','view'));

create or replace function public.update_case_secure(
  p_case_id uuid,p_payload jsonb,p_declassification_confirmation text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_old public.cases%rowtype; v_new_level text; v_new_dependency uuid; v_new_judge uuid;
begin
  if auth.uid() is null or not public.can_access_case(p_case_id) then raise exception 'Acceso no autorizado'; end if;
  if not public.has_effective_permission('expedientes','edit') then raise exception 'No tiene permiso para editar el expediente'; end if;
  select * into v_old from public.cases where id=p_case_id for update;
  if not found then raise exception 'Expediente no encontrado'; end if;
  if v_old.archived_at is not null and not public.is_owner() then raise exception 'Solo el propietario puede editar expedientes archivados'; end if;
  v_new_dependency:=case when p_payload?'dependency_id' then nullif(p_payload->>'dependency_id','')::uuid else v_old.dependency_id end;
  v_new_judge:=case when p_payload?'assigned_judge_id' then nullif(p_payload->>'assigned_judge_id','')::uuid else v_old.assigned_judge_id end;
  if v_new_dependency is distinct from v_old.dependency_id and not public.has_effective_permission('expedientes','repartition') then raise exception 'No tiene permiso para cambiar el reparto del expediente'; end if;
  if v_new_judge is distinct from v_old.assigned_judge_id and not public.has_effective_permission('expedientes','assign_ponente') then raise exception 'No tiene permiso para asignar ponente'; end if;
  v_new_level:=coalesce(p_payload->>'confidentiality_level',v_old.confidentiality_level);
  if v_old.confidentiality_level in ('Reservado','Confidencial') and v_new_level='Público' and p_declassification_confirmation is distinct from 'CONFIRMAR PUBLICACIÓN' then raise exception 'Escriba CONFIRMAR PUBLICACIÓN para reducir el nivel de reserva'; end if;
  if v_old.confidentiality_level in ('Reservado','Confidencial') and v_new_level='Público' then perform set_config('sigj.declassification_confirmed','yes',true); end if;
  update public.cases set
    ticket_name=case when p_payload?'ticket_name' then nullif(trim(p_payload->>'ticket_name'),'') else ticket_name end,
    title=coalesce(nullif(p_payload->>'title',''),title),authority_type=coalesce(nullif(p_payload->>'authority_type',''),authority_type),
    chamber=coalesce(nullif(p_payload->>'chamber',''),chamber),process_type=coalesce(nullif(p_payload->>'process_type',''),process_type),
    process_subtype=coalesce(nullif(p_payload->>'process_subtype',''),process_subtype),claimant_name=coalesce(nullif(p_payload->>'claimant_name',''),claimant_name),
    defendant_name=coalesce(nullif(p_payload->>'defendant_name',''),defendant_name),summary=coalesce(nullif(p_payload->>'summary',''),summary),
    claims=coalesce(nullif(p_payload->>'claims',''),claims),department=coalesce(nullif(p_payload->>'department',''),department),
    municipality=coalesce(nullif(p_payload->>'municipality',''),municipality),reception_method=coalesce(nullif(p_payload->>'reception_method',''),reception_method),
    confidentiality_level=v_new_level,public_visibility=coalesce((p_payload->>'public_visibility')::boolean,public_visibility),
    assigned_judge_id=v_new_judge,dependency_id=v_new_dependency,status=coalesce(nullif(p_payload->>'status',''),status),
    observations=case when p_payload?'observations' then nullif(p_payload->>'observations','') else observations end
  where id=p_case_id;
  if v_new_dependency is distinct from v_old.dependency_id then perform public.log_security_event('CASE_REPARTITIONED','cases',p_case_id,'Reparto del expediente actualizado',jsonb_build_object('old_dependency',v_old.dependency_id,'new_dependency',v_new_dependency)); end if;
  if v_new_judge is distinct from v_old.assigned_judge_id then perform public.log_security_event('CASE_PONENTE_ASSIGNED','cases',p_case_id,'Ponente del expediente actualizado',jsonb_build_object('old_judge',v_old.assigned_judge_id,'new_judge',v_new_judge)); end if;
  perform public.log_security_event('CASE_FULL_UPDATE','cases',p_case_id,'Expediente actualizado desde el flujo seguro',jsonb_build_object('old_ticket_name',v_old.ticket_name,'new_ticket_name',p_payload->>'ticket_name','old_status',v_old.status,'new_status',p_payload->>'status'));
end $$;

notify pgrst,'reload schema';
