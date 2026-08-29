-- Functional completion for complaint relationships, editable participants,
-- evidence upload MIME support and administrative form drafts.
-- Additive only: no data deletion and no destructive history rewrite.

set check_function_bodies = off;

alter table public.participants
  add column if not exists aliases text[] not null default '{}',
  add column if not exists date_of_birth date,
  add column if not exists internal_identifier text,
  add column if not exists organization text,
  add column if not exists agency text,
  add column if not exists attorney_information text,
  add column if not exists record_status text not null default 'active';

alter table public.matter_participants
  add column if not exists relationship_description text,
  add column if not exists lead_designation boolean not null default false,
  add column if not exists representation text,
  add column if not exists service_status text,
  add column if not exists witness_status text,
  add column if not exists confidentiality text not null default 'Internal DOJ only',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.profiles(id),
  add column if not exists removed_by uuid references public.profiles(id),
  add column if not exists removal_reason text;

alter table public.case_participants
  add column if not exists relationship_description text,
  add column if not exists lead_designation boolean not null default false,
  add column if not exists representation text,
  add column if not exists service_status text,
  add column if not exists witness_status text,
  add column if not exists confidentiality text not null default 'Internal DOJ only',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.profiles(id),
  add column if not exists removed_by uuid references public.profiles(id),
  add column if not exists removal_reason text;

create table if not exists public.form_drafts (
  id uuid primary key default gen_random_uuid(),
  draft_key text not null,
  record_type text not null,
  record_id uuid,
  form_name text not null,
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  status text not null default 'active' check (status in ('active','discarded','submitted','conflict')),
  last_editor uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_key, created_by)
);

alter table public.form_drafts enable row level security;
drop policy if exists form_drafts_owner_access on public.form_drafts;
create policy form_drafts_owner_access on public.form_drafts
for all to authenticated
using (created_by = auth.uid() or public.is_super_admin())
with check (created_by = auth.uid() or public.is_super_admin());

insert into public.participant_role_catalog (code, role_scope, official_label, display_label_es, sort_order)
values
  ('person_of_interest','universal','Person of Interest','Persona de interés',410),
  ('suspect','criminal','Suspect','Sospechoso',420),
  ('defendant','criminal','Defendant','Defendant',430),
  ('government_attorney','universal','Government Attorney','Government Attorney',440),
  ('defense_attorney','universal','Defense Attorney','Defense Attorney',450),
  ('investigator','universal','Investigator','Investigador',460),
  ('expert_witness','universal','Expert Witness','Perito / Expert Witness',470),
  ('custodian_of_records','universal','Custodian of Records','Custodian of Records',480),
  ('organization','universal','Organization','Organización',490),
  ('other','universal','Other','Otro',500)
on conflict (code) do update
set role_scope = excluded.role_scope,
    official_label = excluded.official_label,
    display_label_es = excluded.display_label_es,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence-files',
  'evidence-files',
  false,
  104857600,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v',
    'audio/mpeg',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mp4',
    'audio/aac',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.assert_relationship_type(p_relationship_type text)
returns text language plpgsql immutable as $$
declare
  v_type text := lower(trim(coalesce(p_relationship_type, 'related complaint')));
begin
  if v_type in ('originating complaint','originating_complaint','originating_public_complaint','source_complaint') then return 'originating_complaint'; end if;
  if v_type in ('related complaint','related_complaint','related_public_complaint') then return 'related_complaint'; end if;
  if v_type in ('supplemental complaint','supplemental_complaint') then return 'supplemental_complaint'; end if;
  if v_type in ('evidence source','evidence_source') then return 'evidence_source'; end if;
  if v_type = 'referral' then return 'referral'; end if;
  if v_type in ('consolidated matter','consolidated_matter') then return 'consolidated_matter'; end if;
  if v_type = 'other' then return 'other'; end if;
  return 'related_complaint';
end $$;

create or replace function public.assert_doj_relationship_permission(p_resource text, p_action text default 'edit')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.is_owner() then return; end if;
  if public.has_effective_permission(p_resource, p_action) or public.has_effective_permission('expedientes', p_action) then return; end if;
  if public.is_federal_staff() and p_resource in ('matters','cases','evidence','complaints','participants') then return; end if;
  raise exception 'Unauthorized DOJ relationship operation';
end $$;

create or replace function public.link_complaint_to_matter(
  p_complaint_id uuid,
  p_matter_id uuid,
  p_relationship_type text default 'related_complaint',
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_type text := public.assert_relationship_type(p_relationship_type);
  v_link_id uuid;
begin
  perform public.assert_doj_relationship_permission('complaints','edit');
  if not exists(select 1 from public.complaints where id = p_complaint_id) then raise exception 'Complaint not found'; end if;
  if not exists(select 1 from public.matters where id = p_matter_id and archived_at is null) then raise exception 'DOJ Matter not found'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Relationship note is required'; end if;
  if exists(
    select 1
      from public.complaint_matter_links
     where complaint_id = p_complaint_id
       and matter_id = p_matter_id
       and relationship_type = v_type
       and active
  ) then
    raise exception 'This complaint is already linked to this DOJ Matter with that relationship type';
  end if;

  insert into public.complaint_matter_links(complaint_id, matter_id, relationship_type, reason, active, created_by, inactive_at, inactive_by, inactive_reason)
  values (p_complaint_id, p_matter_id, v_type, p_reason, true, auth.uid(), null, null, null)
  on conflict (complaint_id, matter_id, relationship_type) do update
  set active = true,
      reason = excluded.reason,
      inactive_at = null,
      inactive_by = null,
      inactive_reason = null
  returning id into v_link_id;

  insert into public.related_records(source_type, source_id, target_type, target_id, relationship_type, reason, created_by, active)
  values ('complaint', p_complaint_id, 'matter', p_matter_id, v_type, p_reason, auth.uid(), true)
  on conflict do nothing;

  update public.complaints
     set primary_matter_id = coalesce(primary_matter_id, p_matter_id),
         status = case when status in ('Recibida','En revisión') then 'Referred to Matter' else status end,
         updated_at = now()
   where id = p_complaint_id;

  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'complaint_linked_to_matter', 'complaint_matter_links', v_link_id, 'Existing public complaint linked to existing DOJ Matter.', jsonb_build_object('complaint_id', p_complaint_id, 'matter_id', p_matter_id, 'relationship_type', v_type, 'reason', p_reason));
  return jsonb_build_object('ok', true, 'link_id', v_link_id, 'relationship_type', v_type);
end $$;

create or replace function public.link_complaint_to_case(
  p_complaint_id uuid,
  p_case_id uuid,
  p_relationship_type text default 'related_complaint',
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_type text := public.assert_relationship_type(p_relationship_type);
  v_link_id uuid;
begin
  perform public.assert_doj_relationship_permission('complaints','edit');
  if not exists(select 1 from public.complaints where id = p_complaint_id) then raise exception 'Complaint not found'; end if;
  if not exists(select 1 from public.cases where id = p_case_id and archived_at is null) then raise exception 'Federal Case not found'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Relationship note is required'; end if;
  if exists(
    select 1
      from public.complaint_case_links
     where complaint_id = p_complaint_id
       and case_id = p_case_id
       and relationship_type = v_type
       and active
  ) then
    raise exception 'This complaint is already linked to this Federal Case with that relationship type';
  end if;

  insert into public.complaint_case_links(complaint_id, case_id, relationship_type, reason, active, created_by, inactive_at, inactive_by, inactive_reason)
  values (p_complaint_id, p_case_id, v_type, p_reason, true, auth.uid(), null, null, null)
  on conflict (complaint_id, case_id, relationship_type) do update
  set active = true,
      reason = excluded.reason,
      inactive_at = null,
      inactive_by = null,
      inactive_reason = null
  returning id into v_link_id;

  insert into public.related_records(source_type, source_id, target_type, target_id, relationship_type, reason, created_by, active)
  values ('complaint', p_complaint_id, 'case', p_case_id, v_type, p_reason, auth.uid(), true)
  on conflict do nothing;

  update public.complaints
     set primary_case_id = coalesce(primary_case_id, p_case_id),
         status = case when status in ('Recibida','En revisión','Referred to Matter','Under Investigation') then 'Linked to Case' else status end,
         updated_at = now()
   where id = p_complaint_id;

  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'complaint_linked_to_case', 'complaint_case_links', v_link_id, 'Existing public complaint linked to existing Federal Case.', jsonb_build_object('complaint_id', p_complaint_id, 'case_id', p_case_id, 'relationship_type', v_type, 'reason', p_reason));
  return jsonb_build_object('ok', true, 'link_id', v_link_id, 'relationship_type', v_type);
end $$;

create or replace function public.unlink_complaint_matter_link(p_link_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old public.complaint_matter_links%rowtype;
begin
  perform public.assert_doj_relationship_permission('complaints','edit');
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Unlink reason is required'; end if;
  select * into v_old from public.complaint_matter_links where id = p_link_id and active for update;
  if not found then raise exception 'Active complaint/Matter link not found'; end if;
  update public.complaint_matter_links set active = false, inactive_at = now(), inactive_by = auth.uid(), inactive_reason = p_reason where id = p_link_id;
  update public.related_records set active = false, inactive_at = now(), inactive_by = auth.uid(), inactive_reason = p_reason
  where source_type = 'complaint' and source_id = v_old.complaint_id and target_type = 'matter' and target_id = v_old.matter_id and relationship_type = v_old.relationship_type and active;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'complaint_unlinked_from_matter', 'complaint_matter_links', p_link_id, 'Complaint/Matter relationship soft-unlinked.', jsonb_build_object('old', to_jsonb(v_old), 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.unlink_complaint_case_link(p_link_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old public.complaint_case_links%rowtype;
begin
  perform public.assert_doj_relationship_permission('complaints','edit');
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Unlink reason is required'; end if;
  select * into v_old from public.complaint_case_links where id = p_link_id and active for update;
  if not found then raise exception 'Active complaint/Case link not found'; end if;
  update public.complaint_case_links set active = false, inactive_at = now(), inactive_by = auth.uid(), inactive_reason = p_reason where id = p_link_id;
  update public.related_records set active = false, inactive_at = now(), inactive_by = auth.uid(), inactive_reason = p_reason
  where source_type = 'complaint' and source_id = v_old.complaint_id and target_type = 'case' and target_id = v_old.case_id and relationship_type = v_old.relationship_type and active;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'complaint_unlinked_from_case', 'complaint_case_links', p_link_id, 'Complaint/Case relationship soft-unlinked.', jsonb_build_object('old', to_jsonb(v_old), 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.update_participant_master(p_participant_id uuid, p_payload jsonb, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_old public.participants%rowtype;
  v_aliases text[];
begin
  perform public.assert_doj_relationship_permission('participants','edit');
  select * into v_old from public.participants where id = p_participant_id for update;
  if not found then raise exception 'Participant not found'; end if;
  v_aliases := coalesce((select array_agg(value) from jsonb_array_elements_text(coalesce(p_payload->'aliases','[]'::jsonb))), v_old.aliases, '{}');
  update public.participants
     set person_or_organization = coalesce(nullif(p_payload->>'person_or_organization',''), person_or_organization),
         legal_name = coalesce(nullif(trim(p_payload->>'legal_name'), ''), legal_name),
         display_name = nullif(trim(coalesce(p_payload->>'display_name', display_name, '')), ''),
         aliases = v_aliases,
         date_of_birth = nullif(p_payload->>'date_of_birth','')::date,
         internal_identifier = nullif(trim(coalesce(p_payload->>'internal_identifier', internal_identifier, '')), ''),
         contact_info = nullif(trim(coalesce(p_payload->>'contact_info', contact_info, '')), ''),
         address = nullif(trim(coalesce(p_payload->>'address', address, '')), ''),
         organization = nullif(trim(coalesce(p_payload->>'organization', organization, '')), ''),
         agency = nullif(trim(coalesce(p_payload->>'agency', agency, government_agency, '')), ''),
         government_agency = nullif(trim(coalesce(p_payload->>'agency', government_agency, '')), ''),
         attorney_information = nullif(trim(coalesce(p_payload->>'attorney_information', attorney_information, '')), ''),
         notes = nullif(trim(coalesce(p_payload->>'notes', notes, '')), ''),
         record_status = coalesce(nullif(p_payload->>'record_status',''), record_status),
         sealed = coalesce((p_payload->>'sealed')::boolean, sealed),
         minor = coalesce((p_payload->>'minor')::boolean, minor),
         pseudonym = coalesce((p_payload->>'pseudonym')::boolean, pseudonym),
         updated_at = now()
   where id = p_participant_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'participant_master_updated', 'participants', p_participant_id, 'Master person/participant record updated.', jsonb_build_object('old', to_jsonb(v_old), 'new', p_payload, 'reason', p_reason));
  return jsonb_build_object('ok', true, 'participant_id', p_participant_id);
end $$;

create or replace function public.update_matter_participant_role(p_link_id uuid, p_payload jsonb, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old public.matter_participants%rowtype;
begin
  perform public.assert_doj_relationship_permission('participants','edit');
  select * into v_old from public.matter_participants where id = p_link_id for update;
  if not found then raise exception 'Matter participant relationship not found'; end if;
  update public.matter_participants
     set role_code = coalesce(nullif(p_payload->>'role_code',''), role_code),
         side = nullif(trim(coalesce(p_payload->>'side', side, '')), ''),
         relationship_description = nullif(trim(coalesce(p_payload->>'relationship_description', relationship_description, '')), ''),
         start_date = coalesce(nullif(p_payload->>'start_date','')::date, start_date),
         end_date = nullif(p_payload->>'end_date','')::date,
         lead_designation = coalesce((p_payload->>'lead_designation')::boolean, lead_designation),
         representation = nullif(trim(coalesce(p_payload->>'representation', representation, '')), ''),
         service_status = nullif(trim(coalesce(p_payload->>'service_status', service_status, '')), ''),
         witness_status = nullif(trim(coalesce(p_payload->>'witness_status', witness_status, '')), ''),
         confidentiality = coalesce(nullif(p_payload->>'confidentiality',''), confidentiality),
         notes = nullif(trim(coalesce(p_payload->>'notes', notes, '')), ''),
         active = coalesce((p_payload->>'active')::boolean, active),
         updated_at = now(),
         updated_by = auth.uid()
   where id = p_link_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'matter_participant_role_updated', 'matter_participants', p_link_id, 'Participant role in DOJ Matter updated.', jsonb_build_object('old', to_jsonb(v_old), 'new', p_payload, 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.update_case_participant_role(p_link_id uuid, p_payload jsonb, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old public.case_participants%rowtype;
begin
  perform public.assert_doj_relationship_permission('participants','edit');
  select * into v_old from public.case_participants where id = p_link_id for update;
  if not found then raise exception 'Case participant relationship not found'; end if;
  update public.case_participants
     set role_code = coalesce(nullif(p_payload->>'role_code',''), role_code),
         side = nullif(trim(coalesce(p_payload->>'side', side, '')), ''),
         counsel = nullif(trim(coalesce(p_payload->>'counsel', counsel, '')), ''),
         relationship_description = nullif(trim(coalesce(p_payload->>'relationship_description', relationship_description, '')), ''),
         start_date = coalesce(nullif(p_payload->>'start_date','')::date, start_date),
         end_date = nullif(p_payload->>'end_date','')::date,
         lead_designation = coalesce((p_payload->>'lead_designation')::boolean, lead_designation),
         representation = nullif(trim(coalesce(p_payload->>'representation', representation, '')), ''),
         service_status = nullif(trim(coalesce(p_payload->>'service_status', service_status, '')), ''),
         witness_status = nullif(trim(coalesce(p_payload->>'witness_status', witness_status, '')), ''),
         confidentiality = coalesce(nullif(p_payload->>'confidentiality',''), confidentiality),
         notes = nullif(trim(coalesce(p_payload->>'notes', notes, '')), ''),
         active = coalesce((p_payload->>'active')::boolean, active),
         updated_at = now(),
         updated_by = auth.uid()
   where id = p_link_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'case_participant_role_updated', 'case_participants', p_link_id, 'Participant role in Federal Case updated.', jsonb_build_object('old', to_jsonb(v_old), 'new', p_payload, 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.add_existing_participant_to_matter(p_matter_id uuid, p_participant_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_doj_relationship_permission('participants','edit');
  if exists(select 1 from public.matter_participants where matter_id = p_matter_id and participant_id = p_participant_id and role_code = coalesce(nullif(p_payload->>'role_code',''), 'witness') and active) then
    raise exception 'This participant already has that active role in this Matter';
  end if;
  insert into public.matter_participants(matter_id, participant_id, role_code, side, notes, relationship_description, lead_designation, representation, service_status, witness_status, confidentiality, updated_by)
  values (p_matter_id, p_participant_id, coalesce(nullif(p_payload->>'role_code',''), 'witness'), nullif(p_payload->>'side',''), nullif(p_payload->>'notes',''), nullif(p_payload->>'relationship_description',''), coalesce((p_payload->>'lead_designation')::boolean,false), nullif(p_payload->>'representation',''), nullif(p_payload->>'service_status',''), nullif(p_payload->>'witness_status',''), coalesce(nullif(p_payload->>'confidentiality',''), 'Internal DOJ only'), auth.uid())
  returning id into v_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata) values (auth.uid(), 'matter_participant_added', 'matter_participants', v_id, 'Existing participant linked to DOJ Matter.', p_payload);
  return jsonb_build_object('ok', true, 'relationship_id', v_id);
end $$;

create or replace function public.add_existing_participant_to_case(p_case_id uuid, p_participant_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_doj_relationship_permission('participants','edit');
  if exists(select 1 from public.case_participants where case_id = p_case_id and participant_id = p_participant_id and role_code = coalesce(nullif(p_payload->>'role_code',''), 'witness') and active) then
    raise exception 'This participant already has that active role in this Case';
  end if;
  insert into public.case_participants(case_id, participant_id, role_code, side, counsel, notes, relationship_description, lead_designation, representation, service_status, witness_status, confidentiality, updated_by)
  values (p_case_id, p_participant_id, coalesce(nullif(p_payload->>'role_code',''), 'witness'), nullif(p_payload->>'side',''), nullif(p_payload->>'counsel',''), nullif(p_payload->>'notes',''), nullif(p_payload->>'relationship_description',''), coalesce((p_payload->>'lead_designation')::boolean,false), nullif(p_payload->>'representation',''), nullif(p_payload->>'service_status',''), nullif(p_payload->>'witness_status',''), coalesce(nullif(p_payload->>'confidentiality',''), 'Internal DOJ only'), auth.uid())
  returning id into v_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata) values (auth.uid(), 'case_participant_added', 'case_participants', v_id, 'Existing participant linked to Federal Case.', p_payload);
  return jsonb_build_object('ok', true, 'relationship_id', v_id);
end $$;

create or replace function public.remove_matter_participant_link(p_link_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_doj_relationship_permission('participants','edit');
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Removal reason is required'; end if;
  update public.matter_participants set active = false, end_date = coalesce(end_date, current_date), removed_by = auth.uid(), removal_reason = p_reason, updated_at = now(), updated_by = auth.uid() where id = p_link_id and active;
  if not found then raise exception 'Active Matter participant relationship not found'; end if;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata) values (auth.uid(), 'matter_participant_removed', 'matter_participants', p_link_id, 'Participant relationship removed from Matter without deleting the person.', jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.remove_case_participant_link(p_link_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_doj_relationship_permission('participants','edit');
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Removal reason is required'; end if;
  update public.case_participants set active = false, end_date = coalesce(end_date, current_date), removed_by = auth.uid(), removal_reason = p_reason, updated_at = now(), updated_by = auth.uid() where id = p_link_id and active;
  if not found then raise exception 'Active Case participant relationship not found'; end if;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata) values (auth.uid(), 'case_participant_removed', 'case_participants', p_link_id, 'Participant relationship removed from Case without deleting the person.', jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.upsert_form_draft(p_draft_key text, p_record_type text, p_record_id uuid, p_form_name text, p_payload jsonb, p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_existing public.form_drafts%rowtype; v_id uuid; v_version integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_existing from public.form_drafts where draft_key = p_draft_key and created_by = auth.uid() for update;
  if found and p_expected_version is not null and v_existing.version <> p_expected_version then
    update public.form_drafts set status = 'conflict', updated_at = now() where id = v_existing.id;
    return jsonb_build_object('ok', false, 'status', 'conflict', 'server_version', v_existing.version, 'payload', v_existing.payload);
  end if;
  insert into public.form_drafts(draft_key, record_type, record_id, form_name, payload, version, created_by, last_editor, updated_at)
  values (p_draft_key, p_record_type, p_record_id, p_form_name, p_payload, 1, auth.uid(), auth.uid(), now())
  on conflict (draft_key, created_by) do update
  set payload = excluded.payload,
      record_type = excluded.record_type,
      record_id = excluded.record_id,
      form_name = excluded.form_name,
      version = public.form_drafts.version + 1,
      status = 'active',
      last_editor = auth.uid(),
      updated_at = now()
  returning id, version into v_id, v_version;
  return jsonb_build_object('ok', true, 'draft_id', v_id, 'version', v_version);
end $$;

grant execute on function public.assert_relationship_type(text) to authenticated, service_role;
grant execute on function public.assert_doj_relationship_permission(text,text) to authenticated, service_role;
grant execute on function public.link_complaint_to_matter(uuid,uuid,text,text) to authenticated, service_role;
grant execute on function public.link_complaint_to_case(uuid,uuid,text,text) to authenticated, service_role;
grant execute on function public.unlink_complaint_matter_link(uuid,text) to authenticated, service_role;
grant execute on function public.unlink_complaint_case_link(uuid,text) to authenticated, service_role;
grant execute on function public.update_participant_master(uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.update_matter_participant_role(uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.update_case_participant_role(uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.add_existing_participant_to_matter(uuid,uuid,jsonb) to authenticated, service_role;
grant execute on function public.add_existing_participant_to_case(uuid,uuid,jsonb) to authenticated, service_role;
grant execute on function public.remove_matter_participant_link(uuid,text) to authenticated, service_role;
grant execute on function public.remove_case_participant_link(uuid,text) to authenticated, service_role;
grant execute on function public.upsert_form_draft(text,text,uuid,text,jsonb,integer) to authenticated, service_role;

notify pgrst, 'reload schema';
