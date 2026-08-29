-- DOJ roleplay relationship reform: Public Complaints -> DOJ Matters -> Federal Cases -> Appeals
-- This migration extends the existing deployed schema without deleting legacy data.

create extension if not exists pgcrypto;

alter table public.federal_courts add column if not exists display_name text;
alter table public.federal_courts add column if not exists jurisdiction_description text;
alter table public.federal_courts add column if not exists appellate_court_id uuid references public.federal_courts(id);
alter table public.federal_courts add column if not exists sort_order integer not null default 1000;
alter table public.federal_courts add column if not exists effective_to date;
alter table public.federal_courts add column if not exists timezone text;

update public.federal_courts
   set display_name = coalesce(display_name, official_name),
       timezone = coalesce(timezone, time_zone, 'America/New_York');

insert into public.federal_courts (
  id, court_system, court_level, official_name, display_name, abbreviation, circuit, district,
  state_or_territory, jurisdiction_description, local_rules_url, time_zone, timezone,
  accepted_case_categories, active, configurable_by_owner, sort_order, effective_from
) values
('81000000-0000-0000-0000-000000000002','United States Court of Appeals','Court of Appeals','U.S. Court of Appeals for the District of Columbia Circuit','U.S. Court of Appeals for the D.C. Circuit','D.C. Cir.','District of Columbia Circuit',null,'District of Columbia','Apelaciones federales procedentes del District of Columbia y revisión de determinadas decisiones de agencias federales cuando corresponda.','https://www.cadc.uscourts.gov/internet/home.nsf/Content/Rules','America/New_York','America/New_York',array['Appeal','Petition for Review','Original proceeding'],true,true,10,current_date),
('81000000-0000-0000-0000-000000000009','United States Court of Appeals','Court of Appeals','U.S. Court of Appeals for the Ninth Circuit','U.S. Court of Appeals for the Ninth Circuit','9th Cir.','Ninth Circuit',null,'California','Apelaciones federales procedentes de los District Courts de California incluidos en este portal.','https://www.ca9.uscourts.gov/rules/','America/Los_Angeles','America/Los_Angeles',array['Appeal','Petition for Review','Original proceeding'],true,true,20,current_date),
('81000000-0000-0000-0000-000000000005','United States District Court','District Court','U.S. District Court for the District of Columbia','U.S. District Court for the District of Columbia','D.D.C.',null,'District of Columbia','District of Columbia','Washington, D.C.','https://www.dcd.uscourts.gov/court-info/local-rules-and-orders','America/New_York','America/New_York',array['Civil','Criminal','Miscellaneous','Magistrate Judge proceeding','Warrant-related proceeding'],true,true,30,current_date),
('81000000-0000-0000-0000-000000000010','United States District Court','District Court','U.S. District Court for the Northern District of California','U.S. District Court for the Northern District of California','N.D. Cal.',null,'Northern District of California','California','Northern California and the Bay Area','https://www.cand.uscourts.gov/rules/','America/Los_Angeles','America/Los_Angeles',array['Civil','Criminal','Miscellaneous','Magistrate Judge proceeding','Warrant-related proceeding'],true,true,40,current_date),
('81000000-0000-0000-0000-000000000011','United States District Court','District Court','U.S. District Court for the Eastern District of California','U.S. District Court for the Eastern District of California','E.D. Cal.',null,'Eastern District of California','California','Interior California, Sacramento and the Central Valley','https://www.caed.uscourts.gov/caednew/index.cfm/rules/local-rules/','America/Los_Angeles','America/Los_Angeles',array['Civil','Criminal','Miscellaneous','Magistrate Judge proceeding','Warrant-related proceeding'],true,true,50,current_date),
('81000000-0000-0000-0000-000000000012','United States District Court','District Court','U.S. District Court for the Central District of California','U.S. District Court for the Central District of California','C.D. Cal.',null,'Central District of California','California','Los Angeles and much of Southern California','https://www.cacd.uscourts.gov/court-procedures/local-rules','America/Los_Angeles','America/Los_Angeles',array['Civil','Criminal','Miscellaneous','Magistrate Judge proceeding','Warrant-related proceeding'],true,true,60,current_date),
('81000000-0000-0000-0000-000000000013','United States District Court','District Court','U.S. District Court for the Southern District of California','U.S. District Court for the Southern District of California','S.D. Cal.',null,'Southern District of California','California','San Diego and Imperial Counties','https://www.casd.uscourts.gov/rules/local-rules.aspx','America/Los_Angeles','America/Los_Angeles',array['Civil','Criminal','Miscellaneous','Magistrate Judge proceeding','Warrant-related proceeding'],true,true,70,current_date)
on conflict (id) do update set
  court_system = excluded.court_system,
  court_level = excluded.court_level,
  official_name = excluded.official_name,
  display_name = excluded.display_name,
  abbreviation = excluded.abbreviation,
  circuit = excluded.circuit,
  district = excluded.district,
  state_or_territory = excluded.state_or_territory,
  jurisdiction_description = excluded.jurisdiction_description,
  local_rules_url = excluded.local_rules_url,
  time_zone = excluded.time_zone,
  timezone = excluded.timezone,
  accepted_case_categories = excluded.accepted_case_categories,
  active = true,
  configurable_by_owner = true,
  sort_order = excluded.sort_order,
  effective_to = null,
  retired_at = null,
  updated_at = now();

update public.federal_courts
   set appellate_court_id = case
     when abbreviation = 'D.D.C.' then '81000000-0000-0000-0000-000000000002'::uuid
     when abbreviation in ('N.D. Cal.','E.D. Cal.','C.D. Cal.','S.D. Cal.') then '81000000-0000-0000-0000-000000000009'::uuid
     else appellate_court_id
   end;

update public.federal_courts
   set active = false,
       retired_at = coalesce(retired_at, now()),
       effective_to = coalesce(effective_to, current_date)
 where abbreviation not in ('D.C. Cir.','9th Cir.','D.D.C.','N.D. Cal.','E.D. Cal.','C.D. Cal.','S.D. Cal.')
   and active = true;

alter table public.complaints add column if not exists primary_matter_id uuid references public.matters(id);
alter table public.complaints add column if not exists primary_case_id uuid references public.cases(id);
alter table public.complaints add column if not exists decision_history jsonb not null default '[]'::jsonb;

alter table public.cases add column if not exists trial_type text;
alter table public.cases add column if not exists jury_demand text;
alter table public.cases add column if not exists related_cases jsonb not null default '[]'::jsonb;
alter table public.cases add column if not exists transferred_from_matter jsonb not null default '{}'::jsonb;

do $$
declare
  v_name text;
begin
  select conname into v_name
    from pg_constraint
   where conrelid = 'public.complaints'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%status%';
  if v_name is not null then
    execute format('alter table public.complaints drop constraint %I', v_name);
  end if;
end $$;

alter table public.complaints add constraint complaints_status_allowed check (
  status in (
    'Recibida','En revisión','Admitida','Información requerida','En investigación','Cerrada','Archivada',
    'Referred to Matter','Under Investigation','Linked to Case','No Action','Additional Information Requested','Closed','Archived'
  )
);

create table if not exists public.complaint_matter_links (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  relationship_type text not null default 'originating_public_complaint',
  reason text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  inactive_at timestamptz,
  inactive_by uuid references public.profiles(id),
  inactive_reason text,
  unique (complaint_id, matter_id, relationship_type)
);

create table if not exists public.complaint_case_links (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  relationship_type text not null default 'related_public_complaint',
  reason text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  inactive_at timestamptz,
  inactive_by uuid references public.profiles(id),
  inactive_reason text,
  unique (complaint_id, case_id, relationship_type)
);

create table if not exists public.related_records (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  relationship_type text not null,
  reason text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  inactive_at timestamptz,
  inactive_by uuid references public.profiles(id),
  inactive_reason text,
  metadata jsonb not null default '{}'::jsonb,
  unique (source_type, source_id, target_type, target_id, relationship_type)
);

create sequence if not exists public.evidence_number_seq start 100001;

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  evidence_number text not null unique default ('RP-EV-' || extract(year from now())::int || '-' || lpad(nextval('public.evidence_number_seq')::text, 6, '0')),
  matter_id uuid references public.matters(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  warrant_id uuid references public.roleplay_warrants(id) on delete set null,
  complaint_id uuid references public.complaints(id) on delete set null,
  title text not null,
  description text,
  evidence_type text not null default 'Document',
  source text,
  collected_by uuid references public.profiles(id),
  collection_at timestamptz,
  collection_location text,
  received_at timestamptz,
  custodian text,
  original_copy_status text not null default 'Original',
  sha256_hash text,
  storage_bucket text,
  storage_path text,
  storage_location text,
  access_classification text not null default 'Internal DOJ only',
  privilege_status text not null default 'Not privileged',
  grand_jury_status text not null default 'Not grand-jury material',
  sealed boolean not null default false,
  relevance text,
  authenticity_status text not null default 'Unverified',
  admissibility_status text not null default 'Internal evidence item',
  tags text[] not null default '{}',
  related_persons jsonb not null default '[]'::jsonb,
  related_statutes text[] not null default '{}',
  notes text,
  malware_scan_status text not null default 'Pending',
  version integer not null default 1,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.evidence_chain_of_custody (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence_items(id) on delete cascade,
  action text not null,
  from_custodian text,
  to_custodian text,
  event_at timestamptz not null default now(),
  location text,
  purpose text,
  condition text,
  acknowledgment text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  correction_of uuid references public.evidence_chain_of_custody(id),
  correction_reason text
);

create or replace function public.prevent_chain_of_custody_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Chain of custody events are immutable. Create a correction event instead.';
end $$;

drop trigger if exists evidence_chain_of_custody_no_update on public.evidence_chain_of_custody;
create trigger evidence_chain_of_custody_no_update before update or delete on public.evidence_chain_of_custody
for each row execute function public.prevent_chain_of_custody_mutation();

create table if not exists public.court_exhibits (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence_items(id) on delete restrict,
  case_id uuid not null references public.cases(id) on delete cascade,
  exhibit_number text not null,
  offering_party text,
  hearing_id uuid references public.hearings(id) on delete set null,
  trial_jury_id uuid,
  offered_at timestamptz,
  status text not null default 'Reserved',
  court_ruling text,
  public_visibility text not null default 'restricted',
  available_to_jury boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (case_id, exhibit_number)
);

create sequence if not exists public.subpoena_number_seq start 100001;
create table if not exists public.subpoenas (
  id uuid primary key default gen_random_uuid(),
  subpoena_number text not null unique default ('RP-SUB-' || extract(year from now())::int || '-' || lpad(nextval('public.subpoena_number_seq')::text, 6, '0')),
  matter_id uuid references public.matters(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  grand_jury_id uuid,
  subpoena_type text not null default 'Subpoena for Documents, Information or Objects',
  recipient text not null,
  issuing_authority text,
  issue_date date,
  service_date date,
  return_date date,
  compliance_status text not null default 'Pending',
  documents_produced text,
  objections text,
  motion_to_quash text,
  enforcement_proceeding text,
  sealed boolean not null default false,
  grand_jury_secret boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create sequence if not exists public.interview_number_seq start 100001;
create table if not exists public.interview_records (
  id uuid primary key default gen_random_uuid(),
  interview_number text not null unique default ('RP-INT-' || extract(year from now())::int || '-' || lpad(nextval('public.interview_number_seq')::text, 6, '0')),
  matter_id uuid references public.matters(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  record_type text not null default 'Interview record',
  interviewee text not null,
  role text,
  interviewers text[] not null default '{}',
  interview_at timestamptz,
  location text,
  counsel text,
  recording_status text,
  summary text,
  transcript text,
  access_classification text not null default 'Internal DOJ only',
  grand_jury_secret boolean not null default false,
  related_evidence_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matter_tasks (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references public.profiles(id),
  due_at timestamptz,
  priority text not null default 'Normal',
  status text not null default 'Open',
  related_record_type text,
  related_record_id uuid,
  completion_note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matter_deadlines (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  deadline_type text not null,
  due_at timestamptz not null,
  basis text,
  responsible_user_id uuid references public.profiles(id),
  reminder_at timestamptz,
  status text not null default 'Pending',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.grand_jury_number_seq start 1;
create table if not exists public.grand_juries (
  id uuid primary key default gen_random_uuid(),
  grand_jury_number text not null unique default ('RP-GJ-' || extract(year from now())::int || '-' || lpad(nextval('public.grand_jury_number_seq')::text, 3, '0')),
  primary_matter_id uuid references public.matters(id) on delete set null,
  court_id uuid not null references public.federal_courts(id),
  district text,
  jury_division text,
  supervising_judge text,
  foreperson text,
  deputy_foreperson text,
  active_grand_jurors integer not null default 16 check (active_grand_jurors between 16 and 23),
  term_start date,
  term_end date,
  extension_date date,
  expected_schedule text,
  status text not null default 'Draft',
  access_classification text not null default 'Grand-jury restricted',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grand_jury_matters (
  id uuid primary key default gen_random_uuid(),
  grand_jury_id uuid not null references public.grand_juries(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  relationship_type text not null default 'authorized_matter',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (grand_jury_id, matter_id)
);

create table if not exists public.grand_jury_members (
  id uuid primary key default gen_random_uuid(),
  grand_jury_id uuid not null references public.grand_juries(id) on delete cascade,
  juror_participant_number text not null,
  display_name text,
  seat_sequence integer,
  is_foreperson boolean not null default false,
  is_deputy_foreperson boolean not null default false,
  status text not null default 'Active',
  date_sworn date,
  date_discharged date,
  attendance jsonb not null default '[]'::jsonb,
  conflict_status text,
  secrecy_acknowledgment boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (grand_jury_id, juror_participant_number)
);

create table if not exists public.grand_jury_sessions (
  id uuid primary key default gen_random_uuid(),
  grand_jury_id uuid not null references public.grand_juries(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  session_number text not null,
  session_date date,
  start_time time,
  end_time time,
  court_location text,
  presenting_ausa text,
  court_reporter text,
  interpreter text,
  witnesses jsonb not null default '[]'::jsonb,
  exhibits jsonb not null default '[]'::jsonb,
  statutes_under_review text[] not null default '{}',
  proposed_counts jsonb not null default '[]'::jsonb,
  quorum_confirmed boolean not null default false,
  status text not null default 'Scheduled',
  restricted_minutes text,
  notes text,
  result text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.grand_jury_exhibits (
  id uuid primary key default gen_random_uuid(),
  grand_jury_id uuid not null references public.grand_juries(id) on delete cascade,
  session_id uuid references public.grand_jury_sessions(id) on delete set null,
  evidence_id uuid references public.evidence_items(id) on delete restrict,
  exhibit_number text not null,
  presenting_attorney text,
  witness text,
  presented_at timestamptz not null default now(),
  secrecy_status text not null default 'Grand-jury secret',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (grand_jury_id, exhibit_number)
);

create table if not exists public.grand_jury_proposed_charges (
  id uuid primary key default gen_random_uuid(),
  grand_jury_id uuid not null references public.grand_juries(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  person_or_entity text not null,
  proposed_count_number integer,
  statute text,
  offense_title text,
  offense_dates text,
  alleged_conduct_summary text,
  offense_level text,
  related_evidence_ids uuid[] not null default '{}',
  related_witnesses text[] not null default '{}',
  draft_charging_language text,
  ausa text,
  approval_status text not null default 'Draft',
  presentation_date date,
  grand_jury_result text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.grand_jury_returns (
  id uuid primary key default gen_random_uuid(),
  grand_jury_id uuid not null references public.grand_juries(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  return_type text not null,
  returned_at timestamptz not null default now(),
  quorum_confirmed boolean not null default false,
  concurrence_reached boolean not null default false,
  returned_counts jsonb not null default '[]'::jsonb,
  counts_not_returned jsonb not null default '[]'::jsonb,
  foreperson_certification text,
  receiving_judge text,
  sealed boolean not null default true,
  indictment_document_id uuid references public.documents(id) on delete set null,
  resulting_case_id uuid references public.cases(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create sequence if not exists public.trial_jury_number_seq start 1;
create table if not exists public.trial_juries (
  id uuid primary key default gen_random_uuid(),
  trial_jury_number text not null unique default ('RP-TJ-' || extract(year from now())::int || '-' || lpad(nextval('public.trial_jury_number_seq')::text, 6, '0')),
  case_id uuid not null references public.cases(id) on delete cascade,
  court_id uuid references public.federal_courts(id),
  judge text,
  jury_selection_date date,
  trial_start_date date,
  courtroom text,
  jury_type text not null default 'Criminal Petit Jury',
  required_jury_size integer,
  alternates_count integer not null default 0,
  prospective_panel_size integer,
  anonymous_jury boolean not null default false,
  special_protections text,
  deliberation_status text not null default 'Not started',
  status text not null default 'Draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trial_jury_panels (
  id uuid primary key default gen_random_uuid(),
  trial_jury_id uuid not null references public.trial_juries(id) on delete cascade,
  juror_participant_number text not null,
  panel_sequence integer not null,
  qualification_status text,
  summons_status text,
  reporting_status text,
  voir_dire_status text not null default 'Pending',
  conflict_indicator text,
  challenge_status text,
  final_seat integer,
  alternate_order integer,
  private_access_code_hash text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (trial_jury_id, juror_participant_number)
);

create table if not exists public.jury_instructions (
  id uuid primary key default gen_random_uuid(),
  trial_jury_id uuid not null references public.trial_juries(id) on delete cascade,
  instruction_type text not null,
  title text not null,
  body text not null,
  workflow_status text not null default 'Proposed',
  approved_by_judge boolean not null default false,
  public_to_jurors boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.juror_challenges (
  id uuid primary key default gen_random_uuid(),
  trial_jury_id uuid not null references public.trial_juries(id) on delete cascade,
  panel_member_id uuid references public.trial_jury_panels(id) on delete set null,
  challenge_type text not null,
  requesting_party text,
  basis text,
  response text,
  ruling text,
  sequence integer,
  authorized_limit integer,
  remaining_after integer,
  decided_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.jury_notes (
  id uuid primary key default gen_random_uuid(),
  trial_jury_id uuid not null references public.trial_juries(id) on delete cascade,
  note_number text not null,
  submitted_at timestamptz not null default now(),
  submitted_by_foreperson boolean not null default true,
  note_text text not null,
  judge_received boolean not null default false,
  parties_notified boolean not null default false,
  proposed_responses jsonb not null default '[]'::jsonb,
  court_response text,
  answered_at timestamptz,
  visibility text not null default 'sealed',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (trial_jury_id, note_number)
);

create table if not exists public.jury_verdicts (
  id uuid primary key default gen_random_uuid(),
  trial_jury_id uuid not null references public.trial_juries(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  verdict_type text not null,
  verdict_at timestamptz not null default now(),
  foreperson_confirmed boolean not null default false,
  jury_present boolean not null default true,
  poll_requested boolean not null default false,
  poll_completed boolean not null default false,
  court_accepted boolean not null default false,
  judge text,
  jury_discharged boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.jury_verdict_items (
  id uuid primary key default gen_random_uuid(),
  verdict_id uuid not null references public.jury_verdicts(id) on delete cascade,
  party_or_count text not null,
  result text not null,
  damages numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.jury_discharges (
  id uuid primary key default gen_random_uuid(),
  trial_jury_id uuid not null references public.trial_juries(id) on delete cascade,
  discharged_at timestamptz not null default now(),
  reason text not null,
  verdict_status text,
  mistrial_status text,
  court_order_reference text,
  restrictions_remaining text,
  judge text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.court_exhibits
  add constraint court_exhibits_trial_jury_fk foreign key (trial_jury_id) references public.trial_juries(id) on delete set null;
alter table public.subpoenas
  add constraint subpoenas_grand_jury_fk foreign key (grand_jury_id) references public.grand_juries(id) on delete set null;

create or replace function public.assert_doj_relationship_permission(p_resource text, p_action text default 'edit')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.is_owner() then return; end if;
  if public.has_effective_permission(p_resource, p_action) or public.has_effective_permission('expedientes', p_action) then return; end if;
  if public.is_federal_staff() and p_resource in ('matters','evidence','complaints') then return; end if;
  raise exception 'Unauthorized DOJ relationship operation';
end $$;

create or replace function public.active_federal_courts()
returns table (
  id uuid,
  official_name text,
  display_name text,
  abbreviation text,
  court_level text,
  circuit text,
  state_or_territory text,
  jurisdiction_description text,
  appellate_court_id uuid,
  accepted_case_categories text[],
  sort_order integer
) language sql stable security definer set search_path = public as $$
  select c.id, c.official_name, coalesce(c.display_name, c.official_name), c.abbreviation, c.court_level,
         c.circuit, c.state_or_territory, c.jurisdiction_description, c.appellate_court_id,
         c.accepted_case_categories, c.sort_order
    from public.federal_courts c
   where c.active
     and c.abbreviation in ('D.C. Cir.','9th Cir.','D.D.C.','N.D. Cal.','E.D. Cal.','C.D. Cal.','S.D. Cal.')
   order by c.sort_order, c.official_name;
$$;

create or replace function public.resolve_appeal_court(p_origin_case_id uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_court_id uuid;
begin
  select fc.appellate_court_id into v_court_id
    from public.cases c
    join public.federal_courts fc on fc.id = c.court_id
   where c.id = p_origin_case_id
     and fc.court_level = 'District Court';
  if v_court_id is null then
    raise exception 'Appeal requires an originating District Court case with an appellate court.';
  end if;
  return v_court_id;
end $$;

create or replace function public.create_federal_case_from_matter_v2(
  p_matter_id uuid,
  p_case_category text,
  p_court_id uuid,
  p_originating_case_id uuid default null,
  p_case_caption text default null,
  p_filing_type text default 'Initial filing',
  p_filed_at timestamptz default now(),
  p_docket_number text default null,
  p_federal_access_level text default 'Internal DOJ only',
  p_transfer jsonb default '{}'::jsonb,
  p_matter_next_status text default 'Mantener estado actual',
  p_closing_reason text default null,
  p_closing_date date default null,
  p_review_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_matter public.matters%rowtype;
  v_court public.federal_courts%rowtype;
  v_origin public.cases%rowtype;
  v_case_id uuid;
  v_case_number text;
  v_judicial_number text;
  v_category text := p_case_category;
  v_caption text;
  v_old_matter jsonb;
  v_new_status text;
begin
  perform public.assert_doj_relationship_permission('expedientes','create');
  select * into v_matter from public.matters where id = p_matter_id and archived_at is null;
  if not found then raise exception 'Matter not found'; end if;

  if v_category = 'Appeal' then
    if p_originating_case_id is null then raise exception 'Appeal requires an originating Case'; end if;
    select * into v_origin from public.cases where id = p_originating_case_id and archived_at is null;
    if not found then raise exception 'Originating Case not found'; end if;
    p_court_id := public.resolve_appeal_court(p_originating_case_id);
  end if;

  select * into v_court from public.federal_courts where id = p_court_id and active;
  if not found then raise exception 'Selected court is not active'; end if;
  if v_court.abbreviation not in ('D.C. Cir.','9th Cir.','D.D.C.','N.D. Cal.','E.D. Cal.','C.D. Cal.','S.D. Cal.') then
    raise exception 'Selected court is not authorized for this portal';
  end if;
  if not (v_category = any(v_court.accepted_case_categories)) then
    raise exception 'The selected court does not accept this Case category';
  end if;
  if v_court.court_level = 'Court of Appeals' and v_category not in ('Appeal','Petition for Review','Original proceeding') then
    raise exception 'Trial-level Cases cannot be opened directly in a Court of Appeals';
  end if;
  if v_court.court_level = 'District Court' and v_category = 'Appeal' then
    raise exception 'Appeals must be opened in the correct Court of Appeals';
  end if;
  if coalesce(v_matter.grand_jury_secret,false) and coalesce((p_transfer->>'confidentiality_reviewed')::boolean,false) is not true then
    raise exception 'Grand-jury material requires confidentiality review before creating a Case';
  end if;
  if p_matter_next_status = 'Cerrar con Case Filed' and nullif(trim(coalesce(p_closing_reason,'')), '') is null then
    raise exception 'Closing reason is required when closing a Matter after Case filing';
  end if;

  v_case_number := public.generate_case_number_for_date(v_category, coalesce(p_filed_at, now()));
  v_judicial_number := public.generate_judicial_case_number('001');
  v_caption := coalesce(nullif(trim(p_case_caption), ''), v_matter.title);

  insert into public.cases (
    internal_number, judicial_number, case_number, docket_number, docket_court, docket_district, filing_status,
    title, authority_type, chamber, process_type, process_subtype, claimant_name, defendant_name, summary, claims,
    department, municipality, reception_method, confidentiality_level, status, public_visibility, filed_at, created_by,
    matter_id, record_context, court_id, case_category, case_caption, originating_court_or_agency, originating_case_number,
    originating_docket_number, federal_access_level, sealed, grand_jury_restricted, transferred_from_matter,
    legacy_colombian_metadata
  ) values (
    v_case_number, v_judicial_number, v_case_number, nullif(trim(coalesce(p_docket_number,'')), ''), v_court.official_name,
    coalesce(v_court.district, v_court.state_or_territory), case when nullif(trim(coalesce(p_docket_number,'')), '') is null then 'Awaiting Clerk docketing' else 'Docketed by Clerk' end,
    v_caption, 'United States Federal Judiciary', v_court.official_name, v_category, coalesce(nullif(trim(p_filing_type), ''), v_category),
    coalesce(p_transfer->>'plaintiff', 'United States'), coalesce(p_transfer->>'defendant', 'To be added'),
    coalesce(v_matter.summary, 'Case opened from DOJ Matter. Internal notes, privileged material and grand-jury information were not automatically copied.'),
    coalesce(p_transfer->>'relief', 'Court filing opened from a DOJ Matter.'),
    'United States', coalesce(v_court.district, v_court.state_or_territory, 'Federal forum'), 'Matter-to-Case guided workflow',
    case when p_federal_access_level = 'Public' and not coalesce(v_matter.grand_jury_secret,false) then 'Público' else 'Reservado' end,
    case when v_category = 'Appeal' then 'Notice filed' else 'Intake' end,
    p_federal_access_level = 'Public' and not coalesce(v_matter.grand_jury_secret,false),
    coalesce(p_filed_at, now()), auth.uid(),
    p_matter_id, case when v_category = 'Appeal' then 'appeal' else 'case_from_matter' end, v_court.id, v_category, v_caption,
    case when p_originating_case_id is not null then coalesce(v_origin.docket_court, v_origin.chamber) else null end,
    case when p_originating_case_id is not null then coalesce(v_origin.case_number, v_origin.internal_number) else null end,
    case when p_originating_case_id is not null then v_origin.docket_number else null end,
    p_federal_access_level,
    p_federal_access_level = 'Sealed',
    coalesce(v_matter.grand_jury_secret,false) or p_federal_access_level = 'Grand-jury restricted',
    p_transfer,
    jsonb_build_object('source_matter_number', v_matter.matter_number, 'guided_matter_to_case', true, 'review_reason', p_review_reason)
  ) returning id into v_case_id;

  insert into public.matter_case_relationships(matter_id, case_id, relationship_type, copied_fields, confidentiality_reviewed, created_by)
  values (p_matter_id, v_case_id, 'originating_matter', coalesce(p_transfer->'selected_groups','[]'::jsonb), true, auth.uid())
  on conflict do nothing;

  insert into public.related_records(source_type, source_id, target_type, target_id, relationship_type, reason, created_by, metadata)
  values ('matter', p_matter_id, 'case', v_case_id, 'originating_matter', p_review_reason, auth.uid(), p_transfer)
  on conflict do nothing;

  if p_originating_case_id is not null then
    insert into public.related_records(source_type, source_id, target_type, target_id, relationship_type, reason, created_by)
    values ('case', p_originating_case_id, 'case', v_case_id, 'appeal', p_review_reason, auth.uid())
    on conflict do nothing;
  end if;

  v_old_matter := to_jsonb(v_matter);
  v_new_status := case p_matter_next_status
    when 'Permanecer abierto' then 'Open'
    when 'Cambiar a Litigation Support' then 'Litigation Support'
    when 'Cambiar a Charges Filed' then 'Charges Filed'
    when 'Cambiar a Referred for Litigation' then 'Referred for Litigation'
    when 'Cerrar con Case Filed' then 'Case Filed'
    else v_matter.status
  end;

  update public.matters
     set converted_case_id = coalesce(converted_case_id, v_case_id),
         status = v_new_status,
         closing_reason = case when p_matter_next_status = 'Cerrar con Case Filed' then p_closing_reason else closing_reason end,
         closing_date = case when p_matter_next_status = 'Cerrar con Case Filed' then coalesce(p_closing_date, current_date) else closing_date end,
         updated_at = now(),
         legacy_metadata = legacy_metadata || jsonb_build_object('last_case_opened_id', v_case_id, 'last_case_opened_at', now())
   where id = p_matter_id;

  insert into public.workflow_events(case_id, matter_id, event_scope, event_code, title, description, previous_status, new_status, metadata, created_by)
  values (v_case_id, p_matter_id, 'matter_to_case', 'case_opened_from_matter', 'Federal Case opened from DOJ Matter', 'The Matter was preserved and formally related to a new Federal Case. Restricted material was not copied automatically.', v_matter.status, v_new_status, p_transfer, auth.uid());

  insert into public.audit_logs(user_id, action, table_name, record_id, description, old_values, new_values, metadata)
  values (auth.uid(), 'case_opened_from_matter', 'cases', v_case_id, 'Opened Federal Case from DOJ Matter using controlled transfer workflow.', v_old_matter, jsonb_build_object('case_id', v_case_id, 'case_number', v_case_number), p_transfer);

  perform pg_notify('doj_realtime', json_build_object('event','case_opened_from_matter','matter_id',p_matter_id,'case_id',v_case_id)::text);

  return jsonb_build_object('ok', true, 'case_id', v_case_id, 'case_number', v_case_number, 'court_id', v_court.id, 'appellate_court_id', v_court.appellate_court_id);
end $$;

create or replace function public.open_matter_from_complaint(
  p_complaint_id uuid,
  p_title text default null,
  p_summary text default null,
  p_matter_type text default 'Preliminary inquiry',
  p_status text default 'Under Investigation',
  p_access_level text default 'Internal DOJ only',
  p_include_attachments boolean default false,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_complaint public.complaints%rowtype;
  v_matter_id uuid;
  v_matter_number text;
begin
  perform public.assert_doj_relationship_permission('complaints','edit');
  select * into v_complaint from public.complaints where id = p_complaint_id and archived_at is null;
  if not found then raise exception 'Public complaint not found'; end if;
  v_matter_number := public.generate_matter_number_for_date('MAT', now());
  insert into public.matters(matter_number, title, summary, matter_type, matter_category, lead_component, investigating_agency, status, access_level, opened_at, security_classification, subjects, created_by, legacy_metadata)
  values (
    v_matter_number,
    coalesce(nullif(trim(p_title), ''), coalesce(v_complaint.reported_subject, 'Public complaint review')),
    coalesce(nullif(trim(p_summary), ''), v_complaint.description),
    coalesce(nullif(trim(p_matter_type), ''), 'Preliminary inquiry'),
    'Public Complaint Review',
    'Office of the Attorney General',
    'DOJ Roleplay Intake',
    coalesce(nullif(trim(p_status), ''), 'Under Investigation'),
    case when p_access_level = 'Public' then 'Interno' else 'Reservado' end,
    now(),
    coalesce(nullif(trim(p_access_level), ''), 'Internal DOJ only'),
    jsonb_build_array(jsonb_build_object('name', v_complaint.reported_subject, 'role', 'reported_subject')),
    auth.uid(),
    jsonb_build_object('source_tracking_number', v_complaint.tracking_number, 'include_attachments_requested', p_include_attachments)
  ) returning id into v_matter_id;
  insert into public.complaint_matter_links(complaint_id, matter_id, relationship_type, reason, created_by)
  values (p_complaint_id, v_matter_id, 'originating_public_complaint', p_reason, auth.uid())
  on conflict do nothing;
  insert into public.related_records(source_type, source_id, target_type, target_id, relationship_type, reason, created_by)
  values ('complaint', p_complaint_id, 'matter', v_matter_id, 'originating_public_complaint', p_reason, auth.uid())
  on conflict do nothing;
  update public.complaints
     set status = 'Referred to Matter',
         primary_matter_id = coalesce(primary_matter_id, v_matter_id),
         decision_history = decision_history || jsonb_build_array(jsonb_build_object('action','opened_matter','matter_id',v_matter_id,'at',now(),'by',auth.uid(),'reason',p_reason)),
         public_updated_at = now()
   where id = p_complaint_id;
  insert into public.workflow_events(matter_id, event_scope, event_code, title, description, new_status, metadata, created_by)
  values (v_matter_id, 'complaint_to_matter', 'matter_opened_from_public_complaint', 'DOJ Matter opened from public complaint', 'The tracking number was preserved and private complaint details remain protected.', p_status, jsonb_build_object('tracking_number', v_complaint.tracking_number), auth.uid());
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'matter_opened_from_complaint', 'complaints', p_complaint_id, 'Opened DOJ Matter from public complaint.', jsonb_build_object('matter_id', v_matter_id, 'tracking_number', v_complaint.tracking_number, 'reason', p_reason));
  return jsonb_build_object('ok', true, 'matter_id', v_matter_id, 'matter_number', v_matter_number);
end $$;

create or replace function public.link_complaint_to_case(
  p_complaint_id uuid,
  p_case_id uuid,
  p_relationship_type text default 'related_public_complaint',
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_doj_relationship_permission('complaints','edit');
  if not exists(select 1 from public.complaints where id = p_complaint_id and archived_at is null) then raise exception 'Public complaint not found'; end if;
  if not exists(select 1 from public.cases where id = p_case_id and archived_at is null) then raise exception 'Federal Case not found'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Reason is required to link a public complaint to a Federal Case'; end if;
  insert into public.complaint_case_links(complaint_id, case_id, relationship_type, reason, created_by)
  values (p_complaint_id, p_case_id, coalesce(nullif(trim(p_relationship_type), ''), 'related_public_complaint'), p_reason, auth.uid())
  on conflict do update set active = true, reason = excluded.reason, inactive_at = null, inactive_by = null, inactive_reason = null;
  insert into public.related_records(source_type, source_id, target_type, target_id, relationship_type, reason, created_by)
  values ('complaint', p_complaint_id, 'case', p_case_id, coalesce(nullif(trim(p_relationship_type), ''), 'related_public_complaint'), p_reason, auth.uid())
  on conflict do update set active = true, reason = excluded.reason, inactive_at = null, inactive_by = null, inactive_reason = null;
  update public.complaints
     set status = 'Linked to Case',
         primary_case_id = coalesce(primary_case_id, p_case_id),
         decision_history = decision_history || jsonb_build_array(jsonb_build_object('action','linked_case','case_id',p_case_id,'at',now(),'by',auth.uid(),'reason',p_reason)),
         public_updated_at = now()
   where id = p_complaint_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'complaint_linked_to_case', 'complaints', p_complaint_id, 'Linked public complaint to a Federal Case without making it public evidence.', jsonb_build_object('case_id', p_case_id, 'relationship_type', p_relationship_type, 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.update_matter_controlled(p_matter_id uuid, p_payload jsonb, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_old public.matters%rowtype;
  v_sensitive boolean;
begin
  perform public.assert_doj_relationship_permission('matters','edit');
  select * into v_old from public.matters where id = p_matter_id and archived_at is null;
  if not found then raise exception 'Matter not found'; end if;
  v_sensitive := (p_payload ?| array['lead_component','lead_attorney_id','security_classification','access_level','closing_date','closing_reason']);
  if v_sensitive and nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'A reason is required for sensitive Matter changes'; end if;
  update public.matters set
    title = coalesce(nullif(trim(p_payload->>'title'), ''), title),
    summary = coalesce(p_payload->>'summary', summary),
    matter_type = coalesce(nullif(trim(p_payload->>'matter_type'), ''), matter_type),
    lead_component = coalesce(nullif(trim(p_payload->>'lead_component'), ''), lead_component),
    participating_components = coalesce((select array_agg(value) from jsonb_array_elements_text(coalesce(p_payload->'participating_components','[]'::jsonb))), participating_components),
    investigating_agency = coalesce(nullif(trim(p_payload->>'investigating_agency'), ''), investigating_agency),
    referring_agency = coalesce(nullif(trim(p_payload->>'referring_agency'), ''), referring_agency),
    referral_date = coalesce(nullif(p_payload->>'referral_date','')::date, referral_date),
    statutes_under_review = coalesce((select array_agg(value) from jsonb_array_elements_text(coalesce(p_payload->'statutes_under_review','[]'::jsonb))), statutes_under_review),
    status = coalesce(nullif(trim(p_payload->>'status'), ''), status),
    access_level = coalesce(nullif(trim(p_payload->>'access_level'), ''), access_level),
    security_classification = coalesce(nullif(trim(p_payload->>'security_classification'), ''), security_classification),
    closing_reason = coalesce(p_payload->>'closing_reason', closing_reason),
    closing_date = coalesce(nullif(p_payload->>'closing_date','')::date, closing_date),
    updated_at = now()
  where id = p_matter_id;
  insert into public.workflow_events(matter_id, event_scope, event_code, title, description, previous_status, new_status, metadata, created_by)
  values (p_matter_id, 'matter_edit', 'matter_edited', 'DOJ Matter updated', p_reason, v_old.status, coalesce(nullif(trim(p_payload->>'status'), ''), v_old.status), p_payload, auth.uid());
  insert into public.audit_logs(user_id, action, table_name, record_id, description, old_values, new_values, metadata)
  values (auth.uid(), 'matter_updated', 'matters', p_matter_id, 'Controlled DOJ Matter update.', to_jsonb(v_old), p_payload, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true, 'matter_id', p_matter_id);
end $$;

create or replace function public.update_federal_case_controlled(p_case_id uuid, p_payload jsonb, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_old public.cases%rowtype;
  v_court public.federal_courts%rowtype;
  v_new_category text;
  v_new_court uuid;
begin
  perform public.assert_doj_relationship_permission('expedientes','edit');
  select * into v_old from public.cases where id = p_case_id and archived_at is null;
  if not found then raise exception 'Federal Case not found'; end if;
  if p_payload ? 'case_number' and p_payload->>'case_number' is distinct from v_old.case_number then raise exception 'Case Number is immutable'; end if;
  v_new_category := coalesce(nullif(trim(p_payload->>'case_category'), ''), v_old.case_category);
  v_new_court := coalesce(nullif(p_payload->>'court_id','')::uuid, v_old.court_id);
  if v_new_court is not null then
    select * into v_court from public.federal_courts where id = v_new_court and active;
    if not found then raise exception 'Selected court is not active'; end if;
    if not (v_new_category = any(v_court.accepted_case_categories)) then raise exception 'The selected court does not accept this Case category'; end if;
    if v_court.court_level = 'Court of Appeals' and v_new_category not in ('Appeal','Petition for Review','Original proceeding') then raise exception 'Trial-level Cases cannot be moved to a Court of Appeals'; end if;
  end if;
  if (v_new_court is distinct from v_old.court_id or v_new_category is distinct from v_old.case_category or p_payload ? 'federal_access_level') and nullif(trim(coalesce(p_reason,'')), '') is null then
    raise exception 'A reason is required for court, category, or access changes';
  end if;
  update public.cases set
    title = coalesce(nullif(trim(p_payload->>'title'), ''), title),
    summary = coalesce(p_payload->>'summary', summary),
    claims = coalesce(p_payload->>'claims', claims),
    case_caption = coalesce(nullif(trim(p_payload->>'case_caption'), ''), case_caption),
    court_id = v_new_court,
    docket_court = coalesce(v_court.official_name, docket_court),
    docket_district = coalesce(v_court.district, v_court.state_or_territory, docket_district),
    case_category = v_new_category,
    process_type = v_new_category,
    process_subtype = coalesce(nullif(trim(p_payload->>'filing_type'), ''), process_subtype),
    docket_number = coalesce(nullif(trim(p_payload->>'docket_number'), ''), docket_number),
    filed_at = coalesce(nullif(p_payload->>'filed_at','')::timestamptz, filed_at),
    federal_access_level = coalesce(nullif(trim(p_payload->>'federal_access_level'), ''), federal_access_level),
    sealed = coalesce((p_payload->>'sealed')::boolean, sealed),
    public_visibility = coalesce((p_payload->>'public_visibility')::boolean, public_visibility),
    trial_type = coalesce(nullif(trim(p_payload->>'trial_type'), ''), trial_type),
    jury_demand = coalesce(nullif(trim(p_payload->>'jury_demand'), ''), jury_demand),
    observations = coalesce(p_payload->>'observations', observations),
    updated_at = now()
  where id = p_case_id;
  insert into public.workflow_events(case_id, event_scope, event_code, title, description, previous_status, new_status, metadata, created_by)
  values (p_case_id, 'case_edit', 'case_edited', 'Federal Case updated', p_reason, v_old.status, v_old.status, p_payload, auth.uid());
  insert into public.audit_logs(user_id, action, table_name, record_id, description, old_values, new_values, metadata)
  values (auth.uid(), 'case_updated', 'cases', p_case_id, 'Controlled Federal Case metadata update.', to_jsonb(v_old), p_payload, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true, 'case_id', p_case_id);
end $$;

create or replace function public.create_evidence_item(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_number text;
begin
  perform public.assert_doj_relationship_permission('evidence','create');
  insert into public.evidence_items(matter_id, case_id, warrant_id, complaint_id, title, description, evidence_type, source, collection_at, collection_location, custodian, sha256_hash, access_classification, privilege_status, grand_jury_status, sealed, relevance, authenticity_status, admissibility_status, tags, notes, created_by)
  values (
    nullif(p_payload->>'matter_id','')::uuid, nullif(p_payload->>'case_id','')::uuid, nullif(p_payload->>'warrant_id','')::uuid, nullif(p_payload->>'complaint_id','')::uuid,
    coalesce(nullif(trim(p_payload->>'title'), ''), 'Untitled evidence item'), p_payload->>'description', coalesce(nullif(trim(p_payload->>'evidence_type'), ''), 'Document'), p_payload->>'source',
    nullif(p_payload->>'collection_at','')::timestamptz, p_payload->>'collection_location', p_payload->>'custodian', p_payload->>'sha256_hash',
    coalesce(nullif(trim(p_payload->>'access_classification'), ''), 'Internal DOJ only'), coalesce(nullif(trim(p_payload->>'privilege_status'), ''), 'Not privileged'), coalesce(nullif(trim(p_payload->>'grand_jury_status'), ''), 'Not grand-jury material'), coalesce((p_payload->>'sealed')::boolean,false),
    p_payload->>'relevance', coalesce(nullif(trim(p_payload->>'authenticity_status'), ''), 'Unverified'), coalesce(nullif(trim(p_payload->>'admissibility_status'), ''), 'Internal evidence item'),
    coalesce((select array_agg(value) from jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb))), '{}'), p_payload->>'notes', auth.uid()
  ) returning id, evidence_number into v_id, v_number;
  insert into public.evidence_chain_of_custody(evidence_id, action, to_custodian, event_at, location, purpose, condition, notes, created_by)
  values (v_id, 'Collected', p_payload->>'custodian', now(), p_payload->>'collection_location', 'Initial evidence registration', p_payload->>'condition', p_payload->>'notes', auth.uid());
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'evidence_created', 'evidence_items', v_id, 'Evidence item created and initial chain-of-custody event recorded.', jsonb_build_object('evidence_number', v_number));
  return jsonb_build_object('ok', true, 'evidence_id', v_id, 'evidence_number', v_number);
end $$;

create or replace function public.add_evidence_custody_event(p_evidence_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_doj_relationship_permission('evidence','edit');
  if not exists(select 1 from public.evidence_items where id = p_evidence_id and archived_at is null) then raise exception 'Evidence item not found'; end if;
  insert into public.evidence_chain_of_custody(evidence_id, action, from_custodian, to_custodian, event_at, location, purpose, condition, acknowledgment, notes, created_by, correction_of, correction_reason)
  values (p_evidence_id, coalesce(nullif(trim(p_payload->>'action'), ''), 'Transferred'), p_payload->>'from_custodian', p_payload->>'to_custodian', coalesce(nullif(p_payload->>'event_at','')::timestamptz, now()), p_payload->>'location', p_payload->>'purpose', p_payload->>'condition', p_payload->>'acknowledgment', p_payload->>'notes', auth.uid(), nullif(p_payload->>'correction_of','')::uuid, p_payload->>'correction_reason')
  returning id into v_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'evidence_custody_event_added', 'evidence_chain_of_custody', v_id, 'Immutable chain-of-custody event added.', p_payload);
  return jsonb_build_object('ok', true, 'custody_event_id', v_id);
end $$;

create or replace function public.present_evidence_as_court_exhibit(p_evidence_id uuid, p_case_id uuid, p_exhibit_number text, p_offering_party text default null, p_status text default 'Reserved')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_doj_relationship_permission('evidence','edit');
  if nullif(trim(coalesce(p_exhibit_number,'')), '') is null then raise exception 'Exhibit Number is required'; end if;
  insert into public.court_exhibits(evidence_id, case_id, exhibit_number, offering_party, offered_at, status, created_by)
  values (p_evidence_id, p_case_id, p_exhibit_number, p_offering_party, now(), p_status, auth.uid())
  returning id into v_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'evidence_presented_as_exhibit', 'court_exhibits', v_id, 'Evidence item presented as Court Exhibit without duplicating or destroying the source Evidence Item.', jsonb_build_object('evidence_id', p_evidence_id, 'case_id', p_case_id, 'exhibit_number', p_exhibit_number));
  return jsonb_build_object('ok', true, 'court_exhibit_id', v_id);
end $$;

create or replace function public.create_grand_jury_for_matter(p_matter_id uuid, p_court_id uuid, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_court public.federal_courts%rowtype;
  v_id uuid;
  v_number text;
  v_count integer := coalesce((p_payload->>'active_grand_jurors')::integer, 16);
begin
  perform public.assert_doj_relationship_permission('juries','create');
  select * into v_court from public.federal_courts where id = p_court_id and active;
  if not found or v_court.court_level <> 'District Court' then raise exception 'Grand Jury must be created in an active District Court'; end if;
  if v_count < 16 or v_count > 23 then raise exception 'Grand Jury must have between 16 and 23 active jurors'; end if;
  insert into public.grand_juries(primary_matter_id, court_id, district, jury_division, supervising_judge, foreperson, deputy_foreperson, active_grand_jurors, term_start, term_end, expected_schedule, status, access_classification, notes, created_by)
  values (p_matter_id, p_court_id, v_court.district, p_payload->>'jury_division', p_payload->>'supervising_judge', p_payload->>'foreperson', p_payload->>'deputy_foreperson', v_count, nullif(p_payload->>'term_start','')::date, nullif(p_payload->>'term_end','')::date, p_payload->>'expected_schedule', coalesce(nullif(p_payload->>'status',''),'Requested'), 'Grand-jury restricted', p_payload->>'notes', auth.uid())
  returning id, grand_jury_number into v_id, v_number;
  insert into public.grand_jury_matters(grand_jury_id, matter_id, created_by) values (v_id, p_matter_id, auth.uid()) on conflict do nothing;
  insert into public.workflow_events(matter_id, event_scope, event_code, title, description, new_status, metadata, created_by)
  values (p_matter_id, 'grand_jury', 'grand_jury_created', 'Grand Jury created for Matter', 'Grand Jury details are grand-jury restricted and not exposed publicly.', coalesce(nullif(p_payload->>'status',''),'Requested'), jsonb_build_object('grand_jury_id', v_id, 'grand_jury_number', v_number), auth.uid());
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'grand_jury_created', 'grand_juries', v_id, 'Grand Jury created for DOJ Matter.', jsonb_build_object('matter_id', p_matter_id, 'court_id', p_court_id));
  return jsonb_build_object('ok', true, 'grand_jury_id', v_id, 'grand_jury_number', v_number);
end $$;

create or replace function public.create_trial_jury_for_case(p_case_id uuid, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_case public.cases%rowtype;
  v_court public.federal_courts%rowtype;
  v_id uuid;
  v_number text;
begin
  perform public.assert_doj_relationship_permission('juries','create');
  select * into v_case from public.cases where id = p_case_id and archived_at is null;
  if not found then raise exception 'Federal Case not found'; end if;
  if v_case.case_category not in ('Criminal','Civil') then raise exception 'Trial Jury is available only for Criminal and Civil Cases'; end if;
  select * into v_court from public.federal_courts where id = v_case.court_id and active;
  if not found or v_court.court_level <> 'District Court' then raise exception 'Trial Jury requires an active District Court Case'; end if;
  if exists(select 1 from public.trial_juries where case_id = p_case_id and status not in ('Discharged','Cancelled')) then raise exception 'An active Trial Jury already exists for this Case'; end if;
  insert into public.trial_juries(case_id, court_id, judge, jury_selection_date, trial_start_date, courtroom, jury_type, required_jury_size, alternates_count, prospective_panel_size, anonymous_jury, special_protections, status, created_by)
  values (p_case_id, v_case.court_id, p_payload->>'judge', nullif(p_payload->>'jury_selection_date','')::date, nullif(p_payload->>'trial_start_date','')::date, p_payload->>'courtroom', coalesce(nullif(p_payload->>'jury_type',''), case when v_case.case_category = 'Civil' then 'Civil Petit Jury' else 'Criminal Petit Jury' end), coalesce((p_payload->>'required_jury_size')::integer, case when v_case.case_category = 'Civil' then 8 else 12 end), coalesce((p_payload->>'alternates_count')::integer,0), nullif(p_payload->>'prospective_panel_size','')::integer, coalesce((p_payload->>'anonymous_jury')::boolean,false), p_payload->>'special_protections', coalesce(nullif(p_payload->>'status',''),'Draft'), auth.uid())
  returning id, trial_jury_number into v_id, v_number;
  insert into public.workflow_events(case_id, event_scope, event_code, title, description, new_status, metadata, created_by)
  values (p_case_id, 'trial_jury', 'trial_jury_created', 'Trial Jury created for Federal Case', 'Trial Jury workflow created with protected juror information.', coalesce(nullif(p_payload->>'status',''),'Draft'), jsonb_build_object('trial_jury_id', v_id, 'trial_jury_number', v_number), auth.uid());
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'trial_jury_created', 'trial_juries', v_id, 'Trial Jury created for Federal Case.', jsonb_build_object('case_id', p_case_id));
  return jsonb_build_object('ok', true, 'trial_jury_id', v_id, 'trial_jury_number', v_number);
end $$;

do $$
begin
  insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('evidence-files','evidence-files',false,52428800,array['application/pdf','image/png','image/jpeg','text/plain','video/mp4','audio/mpeg','audio/wav','application/octet-stream'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
exception when undefined_table then null;
end $$;

alter table public.complaint_matter_links enable row level security;
alter table public.complaint_case_links enable row level security;
alter table public.related_records enable row level security;
alter table public.evidence_items enable row level security;
alter table public.evidence_chain_of_custody enable row level security;
alter table public.court_exhibits enable row level security;
alter table public.subpoenas enable row level security;
alter table public.interview_records enable row level security;
alter table public.matter_tasks enable row level security;
alter table public.matter_deadlines enable row level security;
alter table public.grand_juries enable row level security;
alter table public.grand_jury_matters enable row level security;
alter table public.grand_jury_members enable row level security;
alter table public.grand_jury_sessions enable row level security;
alter table public.grand_jury_exhibits enable row level security;
alter table public.grand_jury_proposed_charges enable row level security;
alter table public.grand_jury_returns enable row level security;
alter table public.trial_juries enable row level security;
alter table public.trial_jury_panels enable row level security;
alter table public.jury_instructions enable row level security;
alter table public.juror_challenges enable row level security;
alter table public.jury_notes enable row level security;
alter table public.jury_verdicts enable row level security;
alter table public.jury_verdict_items enable row level security;
alter table public.jury_discharges enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'complaint_matter_links','complaint_case_links','related_records','evidence_items','evidence_chain_of_custody','court_exhibits',
    'subpoenas','interview_records','matter_tasks','matter_deadlines','grand_juries','grand_jury_matters','grand_jury_members',
    'grand_jury_sessions','grand_jury_exhibits','grand_jury_proposed_charges','grand_jury_returns','trial_juries','trial_jury_panels',
    'jury_instructions','juror_challenges','jury_notes','jury_verdicts','jury_verdict_items','jury_discharges'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_access', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff())', t || '_staff_access', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'complaint_matter_links','complaint_case_links','related_records','evidence_items','evidence_chain_of_custody','court_exhibits',
    'subpoenas','interview_records','matter_tasks','matter_deadlines','grand_juries','grand_jury_matters','grand_jury_members',
    'grand_jury_sessions','grand_jury_exhibits','grand_jury_proposed_charges','grand_jury_returns','trial_juries','trial_jury_panels',
    'jury_instructions','juror_challenges','jury_notes','jury_verdicts','jury_verdict_items','jury_discharges'
  ] loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_change()', t, t);
  end loop;
end $$;

create index if not exists idx_complaint_matter_links_complaint on public.complaint_matter_links(complaint_id) where active;
create index if not exists idx_complaint_matter_links_matter on public.complaint_matter_links(matter_id) where active;
create index if not exists idx_complaint_case_links_complaint on public.complaint_case_links(complaint_id) where active;
create index if not exists idx_complaint_case_links_case on public.complaint_case_links(case_id) where active;
create index if not exists idx_related_records_source on public.related_records(source_type, source_id) where active;
create index if not exists idx_related_records_target on public.related_records(target_type, target_id) where active;
create index if not exists idx_evidence_items_matter on public.evidence_items(matter_id) where archived_at is null;
create index if not exists idx_evidence_items_case on public.evidence_items(case_id) where archived_at is null;
create index if not exists idx_chain_evidence on public.evidence_chain_of_custody(evidence_id, event_at desc);
create index if not exists idx_grand_juries_matter on public.grand_juries(primary_matter_id);
create index if not exists idx_trial_juries_case on public.trial_juries(case_id);

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'complaint_matter_links','complaint_case_links','related_records','evidence_items','evidence_chain_of_custody','court_exhibits',
    'subpoenas','interview_records','matter_tasks','matter_deadlines','grand_juries','grand_jury_matters','grand_jury_sessions',
    'grand_jury_exhibits','grand_jury_returns','trial_juries','trial_jury_panels','jury_instructions','jury_notes','jury_verdicts'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

grant execute on function public.active_federal_courts() to anon, authenticated, service_role;
grant execute on function public.resolve_appeal_court(uuid) to authenticated, service_role;
grant execute on function public.create_federal_case_from_matter_v2(uuid,text,uuid,uuid,text,text,timestamptz,text,text,jsonb,text,text,date,text) to authenticated, service_role;
grant execute on function public.open_matter_from_complaint(uuid,text,text,text,text,text,boolean,text) to authenticated, service_role;
grant execute on function public.link_complaint_to_case(uuid,uuid,text,text) to authenticated, service_role;
grant execute on function public.update_matter_controlled(uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.update_federal_case_controlled(uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.create_evidence_item(jsonb) to authenticated, service_role;
grant execute on function public.add_evidence_custody_event(uuid,jsonb) to authenticated, service_role;
grant execute on function public.present_evidence_as_court_exhibit(uuid,uuid,text,text,text) to authenticated, service_role;
grant execute on function public.create_grand_jury_for_matter(uuid,uuid,jsonb) to authenticated, service_role;
grant execute on function public.create_trial_jury_for_case(uuid,jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
