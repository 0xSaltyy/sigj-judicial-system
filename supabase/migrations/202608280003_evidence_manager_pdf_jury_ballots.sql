-- Evidence Manager, Electronic Trial Exhibit numbering, PDF audit and secret jury ballots.
-- Additive only; no existing data is deleted.

alter type public.app_role add value if not exists 'DOJ_ATTORNEY';
alter type public.app_role add value if not exists 'CASE_AGENT';
alter type public.app_role add value if not exists 'EVIDENCE_CUSTODIAN';
alter type public.app_role add value if not exists 'CLERK';
alter type public.app_role add value if not exists 'JUDGE';
alter type public.app_role add value if not exists 'GRAND_JUROR';
alter type public.app_role add value if not exists 'TRIAL_JUROR';
alter type public.app_role add value if not exists 'FOREPERSON';

alter table public.evidence_items add column if not exists exhibit_designation text not null default 'Investigative Exhibit';
alter table public.evidence_items add column if not exists ete_prefix text;
alter table public.evidence_items add column if not exists ete_sequence integer;
alter table public.evidence_items add column if not exists ete_id text;
alter table public.evidence_items add column if not exists formal_title text;
alter table public.evidence_items add column if not exists original_filename text;
alter table public.evidence_items add column if not exists mime_type text;
alter table public.evidence_items add column if not exists file_size_bytes bigint;
alter table public.evidence_items add column if not exists uploaded_by uuid references public.profiles(id);
alter table public.evidence_items add column if not exists uploaded_at timestamptz not null default now();
alter table public.evidence_items add column if not exists upload_method text not null default 'server-side upload';
alter table public.evidence_items add column if not exists obtained_from text;
alter table public.evidence_items add column if not exists collection_method text;
alter table public.evidence_items add column if not exists contains_sensitive_information boolean not null default false;
alter table public.evidence_items add column if not exists evidence_status text not null default 'received';
alter table public.evidence_items add column if not exists integrity_status text not null default 'hash recorded';
alter table public.evidence_items add column if not exists deleted_at timestamptz;
alter table public.evidence_items add column if not exists deleted_by uuid references public.profiles(id);
alter table public.evidence_items add column if not exists deletion_reason text;

create table if not exists public.electronic_exhibit_counters (
  prefix text primary key,
  last_value integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.next_electronic_trial_exhibit_id(p_prefix text default 'ETE')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := upper(regexp_replace(coalesce(nullif(trim(p_prefix), ''), 'ETE'), '[^A-Z0-9]', '', 'g'));
  v_value integer;
begin
  if v_prefix = '' then v_prefix := 'ETE'; end if;
  insert into public.electronic_exhibit_counters(prefix, last_value, updated_at)
  values (v_prefix, 1, now())
  on conflict (prefix) do update set last_value = public.electronic_exhibit_counters.last_value + 1, updated_at = now()
  returning last_value into v_value;
  return jsonb_build_object(
    'prefix', v_prefix,
    'sequence', v_value,
    'ete_id', v_prefix || '-' || lpad(v_value::text, 3, '0'),
    'formal_title', 'Electronic Trial Exhibit ' || lpad(v_value::text, 3, '0')
  );
end $$;

create table if not exists public.evidence_file_versions (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence_items(id) on delete cascade,
  version_number integer not null,
  storage_bucket text not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  sha256_hash text not null,
  integrity_status text not null default 'hash recorded',
  malware_scan_status text not null default 'Pending',
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  notes text,
  unique(evidence_id, version_number)
);

create table if not exists public.evidence_record_links (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence_items(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  relationship_type text not null default 'related evidence',
  reason text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  inactive_at timestamptz,
  inactive_by uuid references public.profiles(id),
  inactive_reason text,
  unique(evidence_id, record_type, record_id, relationship_type)
);

create table if not exists public.evidence_access_logs (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence_items(id) on delete cascade,
  action text not null,
  actor_id uuid references public.profiles(id),
  storage_bucket text,
  storage_path text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.pdf_export_audit (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_id uuid not null,
  export_kind text not null default 'summary',
  actor_id uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  included_sections text[] not null default '{}',
  excluded_restricted boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.grand_jury_counts (
  id uuid primary key default gen_random_uuid(),
  grand_jury_id uuid not null references public.grand_juries(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  count_number integer not null,
  person_or_entity text not null,
  statute text,
  offense_title text,
  allegation_summary text,
  status text not null default 'Presented',
  approved_for_indictment boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(grand_jury_id, count_number)
);

create table if not exists public.grand_jury_voting_rounds (
  id uuid primary key default gen_random_uuid(),
  grand_jury_id uuid not null references public.grand_juries(id) on delete cascade,
  title text not null default 'Grand Jury vote',
  status text not null default 'Open',
  opened_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  foreperson_certification text,
  sealed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.grand_jury_secret_ballots (
  id uuid primary key default gen_random_uuid(),
  voting_round_id uuid not null references public.grand_jury_voting_rounds(id) on delete cascade,
  count_id uuid not null references public.grand_jury_counts(id) on delete cascade,
  juror_member_id uuid not null references public.grand_jury_members(id) on delete cascade,
  ballot_value text not null check (ballot_value in ('True Bill','No Bill','Abstain','Recused')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sealed_integrity_hash text,
  unique(voting_round_id, count_id, juror_member_id)
);

create table if not exists public.grand_jury_vote_results (
  id uuid primary key default gen_random_uuid(),
  voting_round_id uuid not null references public.grand_jury_voting_rounds(id) on delete cascade,
  count_id uuid not null references public.grand_jury_counts(id) on delete cascade,
  true_bill_votes integer not null default 0,
  no_bill_votes integer not null default 0,
  abstain_or_recused integer not null default 0,
  concurrence_required integer not null default 12,
  result text not null,
  certified_at timestamptz not null default now(),
  unique(voting_round_id, count_id)
);

create table if not exists public.trial_verdict_questions (
  id uuid primary key default gen_random_uuid(),
  trial_jury_id uuid not null references public.trial_juries(id) on delete cascade,
  question_number integer not null,
  defendant_or_party text not null,
  count_or_claim text not null,
  question_text text,
  status text not null default 'Presented',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(trial_jury_id, question_number)
);

create table if not exists public.trial_jury_voting_rounds (
  id uuid primary key default gen_random_uuid(),
  trial_jury_id uuid not null references public.trial_juries(id) on delete cascade,
  title text not null default 'Trial Jury deliberation vote',
  status text not null default 'Open',
  opened_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  verdict_form_submitted boolean not null default false,
  foreperson_certification text,
  polling_status text,
  sealed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.trial_jury_secret_ballots (
  id uuid primary key default gen_random_uuid(),
  voting_round_id uuid not null references public.trial_jury_voting_rounds(id) on delete cascade,
  question_id uuid not null references public.trial_verdict_questions(id) on delete cascade,
  juror_panel_id uuid not null references public.trial_jury_panels(id) on delete cascade,
  ballot_value text not null check (ballot_value in ('Guilty','Not Guilty')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sealed_integrity_hash text,
  unique(voting_round_id, question_id, juror_panel_id)
);

create table if not exists public.trial_jury_vote_results (
  id uuid primary key default gen_random_uuid(),
  voting_round_id uuid not null references public.trial_jury_voting_rounds(id) on delete cascade,
  question_id uuid not null references public.trial_verdict_questions(id) on delete cascade,
  guilty_votes integer not null default 0,
  not_guilty_votes integer not null default 0,
  required_unanimity boolean not null default true,
  result text not null,
  certified_at timestamptz not null default now(),
  unique(voting_round_id, question_id)
);

create table if not exists public.jury_polling_records (
  id uuid primary key default gen_random_uuid(),
  trial_jury_id uuid not null references public.trial_juries(id) on delete cascade,
  voting_round_id uuid references public.trial_jury_voting_rounds(id) on delete set null,
  poll_requested_by text,
  poll_completed boolean not null default false,
  unanimity_confirmed boolean,
  judge_action text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.evidence_prefix_for_designation(p_designation text)
returns text language sql immutable as $$
  select case lower(coalesce(p_designation, ''))
    when 'government exhibit' then 'GOV-ETE'
    when 'defense exhibit' then 'DEF-ETE'
    when 'joint exhibit' then 'JOINT-ETE'
    when 'court exhibit' then 'COURT-ETE'
    when 'grand jury exhibit' then 'GJ-ETE'
    when 'investigative exhibit' then 'INV-ETE'
    else 'ETE'
  end
$$;

create or replace function public.register_evidence_upload(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exhibit jsonb;
  v_id uuid;
  v_designation text := coalesce(nullif(trim(p_payload->>'exhibit_designation'), ''), 'Investigative Exhibit');
  v_prefix text;
begin
  perform public.assert_doj_relationship_permission('evidence','create');
  if nullif(trim(coalesce(p_payload->>'storage_path','')), '') is null then raise exception 'Storage path is required'; end if;
  if nullif(trim(coalesce(p_payload->>'sha256_hash','')), '') is null then raise exception 'SHA-256 hash is required'; end if;
  v_prefix := public.evidence_prefix_for_designation(v_designation);
  v_exhibit := public.next_electronic_trial_exhibit_id(v_prefix);

  insert into public.evidence_items(
    matter_id, case_id, complaint_id, warrant_id, title, description, evidence_type, source,
    collection_at, collection_location, received_at, custodian, original_copy_status, sha256_hash,
    storage_bucket, storage_path, storage_location, access_classification, privilege_status,
    grand_jury_status, sealed, relevance, authenticity_status, admissibility_status, tags, notes,
    malware_scan_status, version, created_by, uploaded_by, uploaded_at, exhibit_designation,
    ete_prefix, ete_sequence, ete_id, formal_title, original_filename, mime_type, file_size_bytes,
    obtained_from, collection_method, contains_sensitive_information, evidence_status, integrity_status
  ) values (
    nullif(p_payload->>'matter_id','')::uuid, nullif(p_payload->>'case_id','')::uuid, nullif(p_payload->>'complaint_id','')::uuid, nullif(p_payload->>'warrant_id','')::uuid,
    coalesce(nullif(trim(p_payload->>'title'), ''), v_exhibit->>'formal_title'), p_payload->>'description', coalesce(nullif(p_payload->>'evidence_type',''), 'Electronic Trial Exhibit'), p_payload->>'source',
    nullif(p_payload->>'collection_at','')::timestamptz, p_payload->>'collection_location', now(), p_payload->>'custodian', coalesce(nullif(p_payload->>'original_copy_status',''), 'Digital copy'),
    p_payload->>'sha256_hash', coalesce(nullif(p_payload->>'storage_bucket',''), 'evidence-files'), p_payload->>'storage_path', p_payload->>'storage_location',
    coalesce(nullif(p_payload->>'access_classification',''), 'Internal DOJ only'), coalesce(nullif(p_payload->>'privilege_status',''), 'Not privileged'), coalesce(nullif(p_payload->>'grand_jury_status',''), 'Not grand-jury material'),
    coalesce((p_payload->>'sealed')::boolean, false), p_payload->>'relevance', coalesce(nullif(p_payload->>'authenticity_status',''), 'Unverified'), coalesce(nullif(p_payload->>'admissibility_status',''), 'Pending review'),
    coalesce((select array_agg(value) from jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb))), '{}'), p_payload->>'notes',
    coalesce(nullif(p_payload->>'malware_scan_status',''), 'Pending'), 1, auth.uid(), auth.uid(), now(), v_designation,
    v_exhibit->>'prefix', (v_exhibit->>'sequence')::integer, v_exhibit->>'ete_id', v_exhibit->>'formal_title',
    p_payload->>'original_filename', p_payload->>'mime_type', coalesce((p_payload->>'file_size_bytes')::bigint, 0),
    p_payload->>'obtained_from', p_payload->>'collection_method', coalesce((p_payload->>'contains_sensitive_information')::boolean, false),
    coalesce(nullif(p_payload->>'evidence_status',''), 'received'), 'hash recorded'
  ) returning id into v_id;

  insert into public.evidence_file_versions(evidence_id, version_number, storage_bucket, storage_path, original_filename, mime_type, file_size_bytes, sha256_hash, uploaded_by, notes)
  values (v_id, 1, coalesce(nullif(p_payload->>'storage_bucket',''), 'evidence-files'), p_payload->>'storage_path', coalesce(nullif(p_payload->>'original_filename',''), 'evidence.bin'), coalesce(nullif(p_payload->>'mime_type',''), 'application/octet-stream'), coalesce((p_payload->>'file_size_bytes')::bigint, 0), p_payload->>'sha256_hash', auth.uid(), 'Initial server-side upload');

  insert into public.evidence_chain_of_custody(evidence_id, action, to_custodian, event_at, location, purpose, condition, acknowledgment, notes, created_by)
  values (v_id, 'Uploaded', p_payload->>'custodian', now(), p_payload->>'collection_location', 'Initial secure evidence upload', p_payload->>'condition', 'Server recorded SHA-256 integrity hash', p_payload->>'notes', auth.uid());

  insert into public.evidence_record_links(evidence_id, record_type, record_id, relationship_type, reason, created_by)
  select v_id, 'matter', nullif(p_payload->>'matter_id','')::uuid, 'attached to Matter', p_payload->>'reason', auth.uid()
  where nullif(p_payload->>'matter_id','') is not null
  on conflict do nothing;
  insert into public.evidence_record_links(evidence_id, record_type, record_id, relationship_type, reason, created_by)
  select v_id, 'case', nullif(p_payload->>'case_id','')::uuid, 'attached to Federal Case', p_payload->>'reason', auth.uid()
  where nullif(p_payload->>'case_id','') is not null
  on conflict do nothing;
  insert into public.evidence_record_links(evidence_id, record_type, record_id, relationship_type, reason, created_by)
  select v_id, 'complaint', nullif(p_payload->>'complaint_id','')::uuid, 'derived from Public Complaint', p_payload->>'reason', auth.uid()
  where nullif(p_payload->>'complaint_id','') is not null
  on conflict do nothing;

  insert into public.evidence_access_logs(evidence_id, action, actor_id, storage_bucket, storage_path, metadata)
  values (v_id, 'upload', auth.uid(), coalesce(nullif(p_payload->>'storage_bucket',''), 'evidence-files'), p_payload->>'storage_path', p_payload);
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'evidence_uploaded', 'evidence_items', v_id, 'Electronic Trial Exhibit uploaded with immutable ETE identifier and SHA-256 hash.', jsonb_build_object('ete_id', v_exhibit->>'ete_id', 'formal_title', v_exhibit->>'formal_title'));
  return jsonb_build_object('ok', true, 'evidence_id', v_id, 'ete_id', v_exhibit->>'ete_id', 'formal_title', v_exhibit->>'formal_title');
end $$;

create or replace function public.update_evidence_metadata(p_evidence_id uuid, p_payload jsonb, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old public.evidence_items%rowtype;
begin
  perform public.assert_doj_relationship_permission('evidence','edit');
  select * into v_old from public.evidence_items where id = p_evidence_id and deleted_at is null;
  if not found then raise exception 'Evidence item not found'; end if;
  update public.evidence_items set
    title = coalesce(nullif(trim(p_payload->>'title'), ''), title),
    description = coalesce(p_payload->>'description', description),
    evidence_type = coalesce(nullif(p_payload->>'evidence_type',''), evidence_type),
    source = coalesce(p_payload->>'source', source),
    custodian = coalesce(p_payload->>'custodian', custodian),
    access_classification = coalesce(nullif(p_payload->>'access_classification',''), access_classification),
    privilege_status = coalesce(nullif(p_payload->>'privilege_status',''), privilege_status),
    grand_jury_status = coalesce(nullif(p_payload->>'grand_jury_status',''), grand_jury_status),
    evidence_status = coalesce(nullif(p_payload->>'evidence_status',''), evidence_status),
    contains_sensitive_information = coalesce((p_payload->>'contains_sensitive_information')::boolean, contains_sensitive_information),
    relevance = coalesce(p_payload->>'relevance', relevance),
    notes = coalesce(p_payload->>'notes', notes),
    updated_at = now()
  where id = p_evidence_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, old_values, new_values, metadata)
  values (auth.uid(), 'evidence_metadata_updated', 'evidence_items', p_evidence_id, 'Evidence metadata updated without changing immutable ETE identifier or file hash.', to_jsonb(v_old), p_payload, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.archive_evidence_item(p_evidence_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_doj_relationship_permission('evidence','archive');
  update public.evidence_items set archived_at = now(), evidence_status = 'archived', updated_at = now() where id = p_evidence_id and archived_at is null;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'evidence_archived', 'evidence_items', p_evidence_id, 'Evidence item archived with reason.', jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mark_evidence_deleted(p_evidence_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_doj_relationship_permission('evidence','hard_delete');
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Deletion reason is required'; end if;
  update public.evidence_items set deleted_at = now(), deleted_by = auth.uid(), deletion_reason = p_reason, evidence_status = 'deleted', updated_at = now() where id = p_evidence_id and deleted_at is null;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'evidence_deleted', 'evidence_items', p_evidence_id, 'Evidence item marked deleted; storage removal must be performed server-side.', jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.link_evidence_to_record(p_evidence_id uuid, p_record_type text, p_record_id uuid, p_relationship_type text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_doj_relationship_permission('evidence','edit');
  insert into public.evidence_record_links(evidence_id, record_type, record_id, relationship_type, reason, created_by)
  values (p_evidence_id, p_record_type, p_record_id, coalesce(nullif(p_relationship_type,''),'related evidence'), p_reason, auth.uid())
  on conflict do update set active = true, reason = excluded.reason, inactive_at = null, inactive_by = null, inactive_reason = null;
  if p_record_type = 'case' then update public.evidence_items set case_id = coalesce(case_id, p_record_id), updated_at = now() where id = p_evidence_id; end if;
  if p_record_type = 'matter' then update public.evidence_items set matter_id = coalesce(matter_id, p_record_id), updated_at = now() where id = p_evidence_id; end if;
  if p_record_type = 'complaint' then update public.evidence_items set complaint_id = coalesce(complaint_id, p_record_id), updated_at = now() where id = p_evidence_id; end if;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'evidence_linked', 'evidence_items', p_evidence_id, 'Evidence linked to another record without duplicating the file.', jsonb_build_object('record_type', p_record_type, 'record_id', p_record_id, 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.open_grand_jury_vote_round(p_grand_jury_id uuid, p_title text default 'Grand Jury vote')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  insert into public.grand_jury_voting_rounds(grand_jury_id, title, opened_by) values (p_grand_jury_id, coalesce(nullif(p_title,''),'Grand Jury vote'), auth.uid()) returning id into v_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description) values (auth.uid(), 'grand_jury_vote_opened', 'grand_jury_voting_rounds', v_id, 'Grand Jury voting round opened. No vote tally is exposed while open.');
  return jsonb_build_object('ok', true, 'voting_round_id', v_id);
end $$;

create or replace function public.add_grand_jury_count(p_grand_jury_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  insert into public.grand_jury_counts(grand_jury_id, matter_id, count_number, person_or_entity, statute, offense_title, allegation_summary, created_by)
  values (
    p_grand_jury_id,
    (select primary_matter_id from public.grand_juries where id = p_grand_jury_id),
    coalesce((p_payload->>'count_number')::integer, (select coalesce(max(count_number),0)+1 from public.grand_jury_counts where grand_jury_id = p_grand_jury_id)),
    coalesce(nullif(p_payload->>'person_or_entity',''), 'Person or entity pending'),
    p_payload->>'statute',
    p_payload->>'offense_title',
    p_payload->>'allegation_summary',
    auth.uid()
  ) returning id into v_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'grand_jury_count_added', 'grand_jury_counts', v_id, 'Proposed Grand Jury count added.', p_payload);
  return jsonb_build_object('ok', true, 'count_id', v_id);
end $$;

create or replace function public.submit_grand_jury_ballot(p_round_id uuid, p_count_id uuid, p_member_id uuid, p_ballot_value text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.grand_jury_voting_rounds where id = p_round_id;
  if v_status is distinct from 'Open' then raise exception 'Voting round is closed'; end if;
  if p_ballot_value not in ('True Bill','No Bill','Abstain','Recused') then raise exception 'Invalid Grand Jury ballot value'; end if;
  insert into public.grand_jury_secret_ballots(voting_round_id, count_id, juror_member_id, ballot_value, sealed_integrity_hash)
  values (p_round_id, p_count_id, p_member_id, p_ballot_value, encode(digest(p_round_id::text || p_count_id::text || p_member_id::text || p_ballot_value || now()::text, 'sha256'), 'hex'))
  on conflict (voting_round_id, count_id, juror_member_id) do update
     set ballot_value = excluded.ballot_value,
         updated_at = now(),
         sealed_integrity_hash = excluded.sealed_integrity_hash
   where exists(select 1 from public.grand_jury_voting_rounds where id = p_round_id and status = 'Open');
  insert into public.audit_logs(user_id, action, table_name, record_id, description)
  values (auth.uid(), 'grand_jury_ballot_submitted', 'grand_jury_secret_ballots', p_round_id, 'Sealed Grand Jury ballot submitted. Individual value is not exposed in UI.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.close_grand_jury_vote_round(p_round_id uuid, p_certification text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  if not exists(select 1 from public.grand_jury_voting_rounds where id = p_round_id and status = 'Open') then raise exception 'Voting round is not open'; end if;
  for r in
    select c.id as count_id,
           count(*) filter (where b.ballot_value = 'True Bill') as true_bill_votes,
           count(*) filter (where b.ballot_value = 'No Bill') as no_bill_votes,
           count(*) filter (where b.ballot_value in ('Abstain','Recused')) as abstain_or_recused
      from public.grand_jury_counts c
      left join public.grand_jury_secret_ballots b on b.count_id = c.id and b.voting_round_id = p_round_id
     where c.grand_jury_id = (select grand_jury_id from public.grand_jury_voting_rounds where id = p_round_id)
     group by c.id
  loop
    insert into public.grand_jury_vote_results(voting_round_id, count_id, true_bill_votes, no_bill_votes, abstain_or_recused, result)
    values (p_round_id, r.count_id, r.true_bill_votes, r.no_bill_votes, r.abstain_or_recused, case when r.true_bill_votes >= 12 then 'True Bill' else 'No Bill' end)
    on conflict (voting_round_id, count_id) do update set true_bill_votes = excluded.true_bill_votes, no_bill_votes = excluded.no_bill_votes, abstain_or_recused = excluded.abstain_or_recused, result = excluded.result, certified_at = now();
    update public.grand_jury_counts set approved_for_indictment = r.true_bill_votes >= 12, status = case when r.true_bill_votes >= 12 then 'True Bill' else 'No Bill' end where id = r.count_id;
  end loop;
  update public.grand_jury_voting_rounds set status = 'Certified', closed_by = auth.uid(), closed_at = now(), foreperson_certification = p_certification where id = p_round_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description) values (auth.uid(), 'grand_jury_vote_certified', 'grand_jury_voting_rounds', p_round_id, 'Grand Jury vote certified; sealed individual ballots remain protected.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.open_trial_jury_vote_round(p_trial_jury_id uuid, p_title text default 'Trial Jury vote')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  insert into public.trial_jury_voting_rounds(trial_jury_id, title, opened_by) values (p_trial_jury_id, coalesce(nullif(p_title,''),'Trial Jury vote'), auth.uid()) returning id into v_id;
  update public.trial_juries set deliberation_status = 'Deliberation started', updated_at = now() where id = p_trial_jury_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description) values (auth.uid(), 'trial_jury_vote_opened', 'trial_jury_voting_rounds', v_id, 'Trial Jury voting round opened. No vote tally is exposed while open.');
  return jsonb_build_object('ok', true, 'voting_round_id', v_id);
end $$;

create or replace function public.add_trial_verdict_question(p_trial_jury_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  insert into public.trial_verdict_questions(trial_jury_id, question_number, defendant_or_party, count_or_claim, question_text, created_by)
  values (
    p_trial_jury_id,
    coalesce((p_payload->>'question_number')::integer, (select coalesce(max(question_number),0)+1 from public.trial_verdict_questions where trial_jury_id = p_trial_jury_id)),
    coalesce(nullif(p_payload->>'defendant_or_party',''), 'Defendant or party pending'),
    coalesce(nullif(p_payload->>'count_or_claim',''), 'Count or claim pending'),
    p_payload->>'question_text',
    auth.uid()
  ) returning id into v_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'trial_verdict_question_added', 'trial_verdict_questions', v_id, 'Trial verdict question added.', p_payload);
  return jsonb_build_object('ok', true, 'question_id', v_id);
end $$;

create or replace function public.submit_trial_jury_ballot(p_round_id uuid, p_question_id uuid, p_panel_id uuid, p_ballot_value text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.trial_jury_voting_rounds where id = p_round_id;
  if v_status is distinct from 'Open' then raise exception 'Voting round is closed'; end if;
  if p_ballot_value not in ('Guilty','Not Guilty') then raise exception 'Invalid Trial Jury ballot value'; end if;
  insert into public.trial_jury_secret_ballots(voting_round_id, question_id, juror_panel_id, ballot_value, sealed_integrity_hash)
  values (p_round_id, p_question_id, p_panel_id, p_ballot_value, encode(digest(p_round_id::text || p_question_id::text || p_panel_id::text || p_ballot_value || now()::text, 'sha256'), 'hex'))
  on conflict (voting_round_id, question_id, juror_panel_id) do update
     set ballot_value = excluded.ballot_value,
         updated_at = now(),
         sealed_integrity_hash = excluded.sealed_integrity_hash
   where exists(select 1 from public.trial_jury_voting_rounds where id = p_round_id and status = 'Open');
  insert into public.audit_logs(user_id, action, table_name, record_id, description)
  values (auth.uid(), 'trial_jury_ballot_submitted', 'trial_jury_secret_ballots', p_round_id, 'Sealed Trial Jury ballot submitted. Individual value is not exposed in UI.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.close_trial_jury_vote_round(p_round_id uuid, p_certification text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  if not exists(select 1 from public.trial_jury_voting_rounds where id = p_round_id and status = 'Open') then raise exception 'Voting round is not open'; end if;
  for r in
    select q.id as question_id,
           count(*) filter (where b.ballot_value = 'Guilty') as guilty_votes,
           count(*) filter (where b.ballot_value = 'Not Guilty') as not_guilty_votes,
           count(b.id) as total_votes
      from public.trial_verdict_questions q
      left join public.trial_jury_secret_ballots b on b.question_id = q.id and b.voting_round_id = p_round_id
     where q.trial_jury_id = (select trial_jury_id from public.trial_jury_voting_rounds where id = p_round_id)
     group by q.id
  loop
    insert into public.trial_jury_vote_results(voting_round_id, question_id, guilty_votes, not_guilty_votes, result)
    values (p_round_id, r.question_id, r.guilty_votes, r.not_guilty_votes, case when r.guilty_votes = r.total_votes and r.total_votes > 0 then 'Guilty' when r.not_guilty_votes = r.total_votes and r.total_votes > 0 then 'Not Guilty' else 'No unanimous verdict / deliberations continue' end)
    on conflict (voting_round_id, question_id) do update set guilty_votes = excluded.guilty_votes, not_guilty_votes = excluded.not_guilty_votes, result = excluded.result, certified_at = now();
  end loop;
  update public.trial_jury_voting_rounds set status = 'Certified', closed_by = auth.uid(), closed_at = now(), verdict_form_submitted = true, foreperson_certification = p_certification where id = p_round_id;
  update public.trial_juries set deliberation_status = 'Verdict form submitted', updated_at = now() where id = (select trial_jury_id from public.trial_jury_voting_rounds where id = p_round_id);
  insert into public.audit_logs(user_id, action, table_name, record_id, description) values (auth.uid(), 'trial_jury_vote_certified', 'trial_jury_voting_rounds', p_round_id, 'Trial Jury vote certified; individual ballots remain sealed.');
  return jsonb_build_object('ok', true);
end $$;

alter table public.evidence_file_versions enable row level security;
alter table public.evidence_record_links enable row level security;
alter table public.evidence_access_logs enable row level security;
alter table public.pdf_export_audit enable row level security;
alter table public.grand_jury_counts enable row level security;
alter table public.grand_jury_voting_rounds enable row level security;
alter table public.grand_jury_secret_ballots enable row level security;
alter table public.grand_jury_vote_results enable row level security;
alter table public.trial_verdict_questions enable row level security;
alter table public.trial_jury_voting_rounds enable row level security;
alter table public.trial_jury_secret_ballots enable row level security;
alter table public.trial_jury_vote_results enable row level security;
alter table public.jury_polling_records enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'evidence_file_versions','evidence_record_links','evidence_access_logs','pdf_export_audit',
    'grand_jury_counts','grand_jury_voting_rounds','grand_jury_vote_results',
    'trial_verdict_questions','trial_jury_voting_rounds','trial_jury_vote_results','jury_polling_records'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_access', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff())', t || '_staff_access', t);
  end loop;
end $$;

drop policy if exists grand_jury_secret_ballots_self_or_certified on public.grand_jury_secret_ballots;
create policy grand_jury_secret_ballots_self_or_certified on public.grand_jury_secret_ballots
for all to authenticated
using (
  exists(select 1 from public.grand_jury_voting_rounds r where r.id = voting_round_id and r.status <> 'Open' and public.is_federal_staff())
  or exists(select 1 from public.grand_jury_members m where m.id = juror_member_id and m.created_by = auth.uid())
)
with check (
  exists(select 1 from public.grand_jury_voting_rounds r where r.id = voting_round_id and r.status = 'Open')
);

drop policy if exists trial_jury_secret_ballots_self_or_certified on public.trial_jury_secret_ballots;
create policy trial_jury_secret_ballots_self_or_certified on public.trial_jury_secret_ballots
for all to authenticated
using (
  exists(select 1 from public.trial_jury_voting_rounds r where r.id = voting_round_id and r.status <> 'Open' and public.is_federal_staff())
  or exists(select 1 from public.trial_jury_panels p where p.id = juror_panel_id and p.created_by = auth.uid())
)
with check (
  exists(select 1 from public.trial_jury_voting_rounds r where r.id = voting_round_id and r.status = 'Open')
);

do $$
begin
  insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('evidence-files','evidence-files',false,104857600,array['application/pdf','image/png','image/jpeg','image/webp','text/plain','video/mp4','audio/mpeg','audio/wav','application/octet-stream'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
exception when undefined_table then null;
end $$;

drop policy if exists evidence_files_staff_read on storage.objects;
create policy evidence_files_staff_read on storage.objects
for select to authenticated
using (bucket_id = 'evidence-files' and public.is_federal_staff());
drop policy if exists evidence_files_staff_insert on storage.objects;
create policy evidence_files_staff_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'evidence-files' and public.is_federal_staff());
drop policy if exists evidence_files_staff_update on storage.objects;
create policy evidence_files_staff_update on storage.objects
for update to authenticated
using (bucket_id = 'evidence-files' and public.is_federal_staff())
with check (bucket_id = 'evidence-files' and public.is_federal_staff());
drop policy if exists evidence_files_owner_delete on storage.objects;
create policy evidence_files_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'evidence-files' and (public.is_owner() or public.has_effective_permission('evidence','hard_delete')));

create index if not exists idx_evidence_items_ete_id on public.evidence_items(ete_id);
create index if not exists idx_evidence_items_deleted on public.evidence_items(deleted_at, archived_at);
create index if not exists idx_evidence_links_record on public.evidence_record_links(record_type, record_id) where active;
create index if not exists idx_evidence_versions_evidence on public.evidence_file_versions(evidence_id, version_number desc);
create index if not exists idx_gj_ballots_round_count on public.grand_jury_secret_ballots(voting_round_id, count_id);
create index if not exists idx_trial_ballots_round_question on public.trial_jury_secret_ballots(voting_round_id, question_id);

do $$
declare t text;
begin
  foreach t in array array[
    'evidence_items','evidence_file_versions','evidence_record_links','evidence_access_logs',
    'grand_jury_counts','grand_jury_voting_rounds','grand_jury_vote_results',
    'trial_verdict_questions','trial_jury_voting_rounds','trial_jury_vote_results','jury_polling_records'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

grant execute on function public.next_electronic_trial_exhibit_id(text) to authenticated, service_role;
grant execute on function public.register_evidence_upload(jsonb) to authenticated, service_role;
grant execute on function public.update_evidence_metadata(uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.archive_evidence_item(uuid,text) to authenticated, service_role;
grant execute on function public.mark_evidence_deleted(uuid,text) to authenticated, service_role;
grant execute on function public.link_evidence_to_record(uuid,text,uuid,text,text) to authenticated, service_role;
grant execute on function public.open_grand_jury_vote_round(uuid,text) to authenticated, service_role;
grant execute on function public.add_grand_jury_count(uuid,jsonb) to authenticated, service_role;
grant execute on function public.submit_grand_jury_ballot(uuid,uuid,uuid,text) to authenticated, service_role;
grant execute on function public.close_grand_jury_vote_round(uuid,text) to authenticated, service_role;
grant execute on function public.open_trial_jury_vote_round(uuid,text) to authenticated, service_role;
grant execute on function public.add_trial_verdict_question(uuid,jsonb) to authenticated, service_role;
grant execute on function public.submit_trial_jury_ballot(uuid,uuid,uuid,text) to authenticated, service_role;
grant execute on function public.close_trial_jury_vote_round(uuid,text) to authenticated, service_role;

notify pgrst, 'reload schema';
