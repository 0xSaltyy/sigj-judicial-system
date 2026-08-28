-- Criminal-history and background-record system for the DOJ roleplay portal.
-- This module deliberately separates Person, Arrest Event, Charge and Disposition.
-- It is not connected to FBI, CJIS, NCIC, NGI, III, NICS, PACER or any real government system.

alter table public.role_permission_rules drop constraint if exists role_permission_rules_resource_check;
alter table public.role_permission_rules add constraint role_permission_rules_resource_check check (resource = lower(resource) and length(trim(resource)) between 2 and 80);

alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_resource_check;
alter table public.user_permission_overrides add constraint user_permission_overrides_resource_check check (resource = lower(resource) and length(trim(resource)) between 2 and 80);

alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action = lower(action) and length(trim(action)) between 2 and 80);

alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action = lower(action) and length(trim(action)) between 2 and 80);

with catalog(resource, action) as (values
  ('antecedentes','view'),('antecedentes','search'),('antecedentes','create'),('antecedentes','edit'),
  ('antecedentes','record_disposition'),('antecedentes','seal'),('antecedentes','expunge'),('antecedentes','merge'),
  ('antecedentes','correct'),('antecedentes','review'),('antecedentes','issue_token'),('antecedentes','export'),
  ('personas','view'),('personas','search'),('personas','create'),('personas','edit'),('personas','merge'),
  ('arrestos','view'),('arrestos','create'),('arrestos','edit'),
  ('disposiciones','view'),('disposiciones','create'),('disposiciones','record_disposition'),('disposiciones','correct'),
  ('solicitudes_antecedentes','view'),('solicitudes_antecedentes','review'),('solicitudes_antecedentes','issue_token'),
  ('verificaciones_documento','view'),('verificaciones_documento','verify')
), roles(role) as (
  select unnest(enum_range(null::public.app_role))
)
insert into public.role_permission_rules(role, resource, action, allowed)
select role, resource, action, false from roles cross join catalog
on conflict (role, resource, action) do nothing;

update public.role_permission_rules set allowed = true
where role = 'SUPER_ADMIN'
   or role = 'OWNER';

update public.role_permission_rules set allowed = true
where role in ('ATTORNEY_GENERAL','DEPUTY_ATTORNEY_GENERAL','ADMINISTRADOR')
  and resource in ('antecedentes','personas','arrestos','disposiciones','solicitudes_antecedentes','verificaciones_documento');

update public.role_permission_rules set allowed = true
where role in ('FISCAL','INVESTIGADOR','PERSONAL_AUTORIZADO')
  and (
    (resource in ('antecedentes','personas','arrestos','disposiciones') and action in ('view','search','create','edit','record_disposition'))
    or (resource = 'verificaciones_documento' and action in ('view','verify'))
  );

update public.role_permission_rules set allowed = true
where role in ('JUEZ','SECRETARIO_GENERAL','SECRETARIO_DESPACHO')
  and (
    (resource in ('antecedentes','personas','disposiciones') and action in ('view','search','record_disposition'))
    or (resource = 'verificaciones_documento' and action in ('view','verify'))
  );

create sequence if not exists public.person_record_number_seq start 100001;
create sequence if not exists public.arrest_event_number_seq start 100001;
create sequence if not exists public.record_request_number_seq start 100001;
create sequence if not exists public.background_request_number_seq start 100001;
create sequence if not exists public.correction_request_number_seq start 100001;
create sequence if not exists public.document_verification_number_seq start 100001;

create or replace function public.next_roleplay_identifier(p_prefix text, p_sequence regclass, p_at timestamptz default now())
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year text := to_char(coalesce(p_at, now()), 'YYYY');
  v_next bigint;
begin
  execute format('select nextval(%L::regclass)', p_sequence::text) into v_next;
  return p_prefix || '-' || v_year || '-' || lpad(v_next::text, 6, '0');
end $$;

create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  person_record_number text not null unique default public.next_roleplay_identifier('RP-PER', 'public.person_record_number_seq'::regclass),
  legal_first_name text not null,
  legal_middle_name text,
  legal_last_name text not null,
  suffix text,
  previous_names text[] not null default '{}',
  aliases text[] not null default '{}',
  date_of_birth date,
  place_of_birth text,
  sex_or_gender text,
  nationality text,
  citizenship text,
  restricted_address text,
  restricted_contact_details jsonb not null default '{}'::jsonb,
  identification_document_type text,
  protected_identification_last4 text check (protected_identification_last4 is null or protected_identification_last4 ~ '^[A-Za-z0-9*]{2,12}$'),
  booking_identifiers jsonb not null default '[]'::jsonb,
  agency_identifiers jsonb not null default '[]'::jsonb,
  photograph_path text,
  fingerprint_reference_metadata jsonb not null default '{}'::jsonb,
  record_source text not null default 'portal',
  verification_status text not null default 'Pending verification' check (verification_status in ('Verified','Pending verification','Incomplete','Conflicting information','Corrected')),
  duplicate_review_status text not null default 'Not reviewed' check (duplicate_review_status in ('Not reviewed','Possible duplicate','Under review','Merged','Cleared')),
  person_status text not null default 'Active' check (person_status in ('Active','Merged','Deceased','Inactive')),
  access_classification text not null default 'Restricted' check (access_classification in ('Public','Restricted','Sealed','Expunged','Juvenile/restricted','Internal only')),
  merged_into_person_id uuid references public.persons(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.person_aliases (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  alias_name text not null,
  alias_type text not null default 'Alias',
  verified boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.person_identifiers (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  identifier_type text not null,
  protected_identifier_hash text,
  display_last4 text,
  issuing_authority text,
  verification_status text not null default 'Pending verification',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.person_merge_history (
  id uuid primary key default gen_random_uuid(),
  source_person_id uuid not null references public.persons(id) on delete restrict,
  target_person_id uuid not null references public.persons(id) on delete restrict,
  merge_reason text not null,
  old_source_snapshot jsonb not null,
  merged_by uuid references public.profiles(id) on delete set null,
  merged_at timestamptz not null default now(),
  reversed_by uuid references public.profiles(id) on delete set null,
  reversed_at timestamptz,
  reversal_reason text,
  constraint person_merge_no_self check (source_person_id <> target_person_id)
);

create table if not exists public.record_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('Case','Matter','Warrant','Docket entry','Order','Judgment','Plea agreement','Verdict','Dismissal order','Sentencing minutes','Appellate mandate','Sealing order','Expungement order','Historical import','Correction request','Other')),
  title text not null,
  case_id uuid references public.cases(id) on delete set null,
  matter_id uuid references public.matters(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  docket_entry_id uuid references public.docket_entries(id) on delete set null,
  source_agency text,
  source_court text,
  verification_status text not null default 'Pending verification',
  entered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.arrest_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete restrict,
  arrest_event_number text not null unique default public.next_roleplay_identifier('RP-ARR', 'public.arrest_event_number_seq'::regclass),
  arresting_agency text not null,
  arrest_at timestamptz not null,
  arrest_location text,
  booking_number text,
  arresting_officer_or_agent text,
  matter_id uuid references public.matters(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  warrant_id uuid references public.roleplay_warrants(id) on delete set null,
  warrant_number text,
  arrest_basis text,
  arrest_charges text,
  custody_outcome text,
  fingerprint_submission_metadata jsonb not null default '{}'::jsonb,
  restricted_notes text,
  access_classification text not null default 'Restricted' check (access_classification in ('Public','Restricted','Sealed','Expunged','Juvenile/restricted','Internal only')),
  verification_status text not null default 'Pending verification' check (verification_status in ('Verified','Pending verification','Incomplete disposition','Conflicting information','Corrected','Sealed','Superseded')),
  source_id uuid references public.record_sources(id) on delete set null,
  entered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.criminal_charges (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete restrict,
  arrest_event_id uuid references public.arrest_events(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  matter_id uuid references public.matters(id) on delete set null,
  count_number integer,
  statute_citation text not null,
  offense_title text not null,
  offense_date date,
  offense_level text check (offense_level is null or offense_level in ('Felony','Misdemeanor','Petty offense','Infraction','Class A misdemeanor','Class B misdemeanor','Class C misdemeanor')),
  charging_instrument text check (charging_instrument is null or charging_instrument in ('Criminal Complaint','Indictment','Superseding Indictment','Information','Superseding Information','Citation or Violation Notice','Historical import')),
  filing_date date,
  prosecuting_office text,
  status text not null default 'Pending' check (status in ('Pending','Filed','Amended','Dismissed','Acquitted','Convicted','Declined','No bill','Superseded','Sealed','Expunged','Unknown')),
  original_charge text,
  amended_charge text,
  access_classification text not null default 'Restricted' check (access_classification in ('Public','Restricted','Sealed','Expunged','Juvenile/restricted','Internal only')),
  verification_status text not null default 'Pending verification',
  source_id uuid references public.record_sources(id) on delete set null,
  entered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists criminal_charges_case_count_source_key
on public.criminal_charges(person_id, case_id, count_number, statute_citation)
where case_id is not null and count_number is not null and status <> 'Superseded';

create table if not exists public.charge_dispositions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete restrict,
  charge_id uuid not null references public.criminal_charges(id) on delete restrict,
  case_id uuid references public.cases(id) on delete set null,
  court_id uuid references public.federal_courts(id) on delete set null,
  case_number text,
  docket_number text,
  count_number integer,
  disposition_date date not null,
  disposition_type text not null check (disposition_type in (
    'Convicted after trial','Guilty plea','Nolo contendere plea','Acquitted','Dismissed','Dismissed without prejudice',
    'Dismissed with prejudice','Charge declined','No bill','Deferred disposition','Diversion','Mistrial',
    'Conviction vacated','Judgment reversed','Remanded','Sentence modified','Pardoned','Sealed','Expunged','Pending','Unknown or incomplete disposition'
  )),
  conviction_indicator boolean not null default false,
  judgment_date date,
  appeal_status text not null default 'No appeal recorded' check (appeal_status in ('No appeal recorded','Final','On appeal','Reversed','Vacated','Remanded','Resentencing pending','Modified','Pardoned')),
  finality_status text not null default 'Pending finality' check (finality_status in ('Final','Pending finality','On appeal','Reversed','Vacated','Remanded','Modified','Pardoned','Unknown')),
  sealed boolean not null default false,
  expunged boolean not null default false,
  access_classification text not null default 'Restricted' check (access_classification in ('Public','Restricted','Sealed','Expunged','Juvenile/restricted','Internal only')),
  source_id uuid references public.record_sources(id) on delete set null,
  entered_by uuid references public.profiles(id) on delete set null,
  verification_status text not null default 'Pending verification',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(charge_id, disposition_type, disposition_date)
);

create table if not exists public.sentences (
  id uuid primary key default gen_random_uuid(),
  disposition_id uuid not null references public.charge_dispositions(id) on delete cascade,
  imprisonment text,
  probation text,
  supervised_release text,
  fine_amount numeric(12,2),
  restitution_amount numeric(12,2),
  forfeiture text,
  community_service text,
  special_assessment numeric(12,2),
  concurrent_or_consecutive text check (concurrent_or_consecutive is null or concurrent_or_consecutive in ('Concurrent','Consecutive','Mixed','Not applicable')),
  other_conditions text,
  active_supervision boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.record_restrictions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete restrict,
  action_type text not null check (action_type in ('Sealed','Partially sealed','Expunged','Conviction vacated','Set aside','Pardoned','Restricted','Unsealed','Corrected')),
  court_id uuid references public.federal_courts(id) on delete set null,
  order_date date not null,
  effective_date date not null default current_date,
  case_id uuid references public.cases(id) on delete set null,
  affected_charge_ids uuid[] not null default '{}',
  scope text not null,
  source_order_id uuid references public.documents(id) on delete set null,
  authorized_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.record_corrections (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete restrict,
  challenged_event_type text not null,
  challenged_event_id uuid,
  correction_status text not null default 'Under review' check (correction_status in ('Submitted','Identity verification pending','Under review','Source agency confirmation pending','Correction approved','Correction denied','Record updated','Closed')),
  previous_value jsonb,
  corrected_value jsonb,
  correction_source text,
  deciding_official uuid references public.profiles(id) on delete set null,
  effective_date date,
  decided_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.criminal_history_summary_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default public.next_roleplay_identifier('RP-IHS', 'public.record_request_number_seq'::regclass),
  legal_name text not null,
  date_of_birth date,
  person_record_number text,
  private_access_code_hash text,
  verification_token_hash text,
  request_purpose text not null,
  subject_declaration boolean not null default false,
  consent_acknowledged boolean not null default false,
  requester_contact text,
  status text not null default 'Submitted' check (status in ('Submitted','Identity verification pending','Under review','Additional info required','Approved','Completed','Denied','Cancelled','Expired')),
  matched_person_id uuid references public.persons(id) on delete set null,
  assigned_reviewer uuid references public.profiles(id) on delete set null,
  reviewer_notes text,
  neutral_public_message text not null default 'Solicitud recibida para revisión privada. Este portal no confirma ni descarta coincidencias antes de verificar identidad.',
  access_token_hash text,
  access_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.background_check_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default public.next_roleplay_identifier('RP-BG', 'public.background_request_number_seq'::regclass),
  subject_person_id uuid references public.persons(id) on delete set null,
  subject_legal_name text not null,
  subject_date_of_birth date,
  requesting_organization text not null,
  authorized_purpose text not null,
  legal_authority_or_consent text not null,
  scope text not null,
  status text not null default 'Submitted' check (status in ('Submitted','Identity verification pending','Consent review pending','Under review','Additional information required','Completed','Denied','Cancelled','Expired')),
  result_summary text,
  expiration_date date,
  assigned_reviewer uuid references public.profiles(id) on delete set null,
  audit_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.background_check_consents (
  id uuid primary key default gen_random_uuid(),
  background_request_id uuid not null references public.background_check_requests(id) on delete cascade,
  subject_name text not null,
  consent_statement text not null,
  consent_token_hash text,
  consent_status text not null default 'Pending' check (consent_status in ('Pending','Granted','Denied','Expired','Revoked')),
  granted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.identity_verification_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default public.next_roleplay_identifier('RP-IDV', 'public.record_request_number_seq'::regclass),
  request_type text not null check (request_type in ('Self summary','Background check','Correction','Access token issuance')),
  person_id uuid references public.persons(id) on delete set null,
  request_payload jsonb not null default '{}'::jsonb,
  verification_status text not null default 'Pending' check (verification_status in ('Pending','Verified','Rejected','Expired','Needs review')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.record_access_tokens (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  issued_for_request_id uuid references public.criminal_history_summary_requests(id) on delete set null,
  token_hash text not null unique,
  purpose text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  issued_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.issued_record_summaries (
  id uuid primary key default gen_random_uuid(),
  request_number text not null,
  person_id uuid references public.persons(id) on delete set null,
  document_verification_number text not null unique default public.next_roleplay_identifier('RP-VER', 'public.document_verification_number_seq'::regclass),
  document_hash text not null,
  document_type text not null default 'Portal Criminal History Summary',
  status text not null default 'Current' check (status in ('Current','Superseded','Revoked','Expired')),
  issue_date timestamptz not null default now(),
  expiration_date timestamptz not null default (now() + interval '30 days'),
  subject_initials text,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now()
);

create table if not exists public.document_verifications (
  id uuid primary key default gen_random_uuid(),
  document_verification_number text not null unique,
  document_hash text not null,
  document_type text not null,
  status text not null default 'Current' check (status in ('Current','Superseded','Revoked','Expired','Invalid')),
  issue_date timestamptz not null,
  expiration_date timestamptz,
  limited_subject_display text,
  source_summary_id uuid references public.issued_record_summaries(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.document_verifications add column if not exists document_verification_number text;
alter table public.document_verifications add column if not exists document_hash text;
alter table public.document_verifications add column if not exists issue_date timestamptz;
alter table public.document_verifications add column if not exists expiration_date timestamptz;
alter table public.document_verifications add column if not exists limited_subject_display text;
alter table public.document_verifications add column if not exists source_summary_id uuid references public.issued_record_summaries(id) on delete set null;
alter table public.document_verifications add column if not exists verification_code text;
alter table public.document_verifications add column if not exists issued_at timestamptz;
alter table public.document_verifications add column if not exists public_metadata jsonb not null default '{}'::jsonb;

update public.document_verifications
set document_verification_number = coalesce(document_verification_number, verification_code),
    document_hash = coalesce(document_hash, public_metadata->>'document_hash', verification_code),
    issue_date = coalesce(issue_date, issued_at, created_at),
    limited_subject_display = coalesce(limited_subject_display, public_metadata->>'limited_subject_display')
where document_verification_number is null
   or document_hash is null
   or issue_date is null;

create table if not exists public.criminal_history_correction_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default public.next_roleplay_identifier('RP-COR', 'public.correction_request_number_seq'::regclass),
  person_record_number text,
  challenged_event text not null,
  explanation text not null,
  supporting_document_path text,
  contact_method text,
  status text not null default 'Submitted' check (status in ('Submitted','Identity verification pending','Under review','Source agency confirmation pending','Correction approved','Correction denied','Record updated','Closed')),
  assigned_reviewer uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.criminal_history_search_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  search_purpose text not null,
  query_hash text not null,
  related_case_id uuid references public.cases(id) on delete set null,
  related_matter_id uuid references public.matters(id) on delete set null,
  results_count integer not null default 0,
  viewed_person_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.participants add column if not exists person_id uuid references public.persons(id) on delete set null;
create index if not exists participants_person_id_idx on public.participants(person_id);

create index if not exists persons_record_number_idx on public.persons(person_record_number);
create index if not exists persons_legal_first_name_idx on public.persons(lower(legal_first_name));
create index if not exists persons_legal_last_name_idx on public.persons(lower(legal_last_name));
create index if not exists persons_birth_idx on public.persons(date_of_birth) where date_of_birth is not null;
create index if not exists person_aliases_name_idx on public.person_aliases(alias_name);
create index if not exists arrest_events_person_idx on public.arrest_events(person_id, arrest_at desc);
create index if not exists criminal_charges_person_idx on public.criminal_charges(person_id, status);
create index if not exists charge_dispositions_person_idx on public.charge_dispositions(person_id, disposition_date desc);
create index if not exists charge_dispositions_case_idx on public.charge_dispositions(case_id);
create index if not exists record_restrictions_person_idx on public.record_restrictions(person_id, effective_date desc);
create index if not exists criminal_history_requests_status_idx on public.criminal_history_summary_requests(status, created_at desc);
create index if not exists background_check_requests_status_idx on public.background_check_requests(status, created_at desc);
create index if not exists document_verifications_number_idx on public.document_verifications(document_verification_number, document_hash);

create or replace function public.can_view_criminal_history(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.has_effective_permission('antecedentes','view',p_user_id), false)
      or coalesce(public.has_effective_permission('antecedentes','search',p_user_id), false)
      or coalesce(public.has_effective_permission('personas','view',p_user_id), false)
$$;

create or replace function public.can_manage_criminal_history(p_action text default 'edit', p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.has_effective_permission('antecedentes',p_action,p_user_id), false)
      or coalesce(public.has_effective_permission('disposiciones',p_action,p_user_id), false)
      or coalesce(public.has_effective_permission('arrestos',p_action,p_user_id), false)
$$;

create or replace function public.criminal_history_conviction_type(p_disposition text)
returns boolean language sql immutable as $$
  select p_disposition in ('Convicted after trial','Guilty plea','Nolo contendere plea')
$$;

create or replace view public.person_criminal_history_summary
with (security_barrier = true) as
select
  p.id as person_id,
  p.person_record_number,
  trim(p.legal_first_name || ' ' || coalesce(p.legal_middle_name || ' ', '') || p.legal_last_name || coalesce(' ' || p.suffix, '')) as verified_name,
  count(distinct ae.id) filter (where ae.access_classification not in ('Sealed','Expunged')) as total_arrest_events,
  count(distinct cc.id) filter (where cc.status in ('Pending','Filed','Amended') and cc.access_classification not in ('Sealed','Expunged')) as pending_charges,
  count(distinct cd.id) filter (where cd.conviction_indicator and cd.finality_status not in ('Reversed','Vacated') and not cd.expunged) as conviction_counts,
  count(distinct cd.id) filter (where cd.disposition_type like 'Dismissed%' and not cd.expunged) as dismissed_counts,
  count(distinct cd.id) filter (where cd.disposition_type = 'Acquitted' and not cd.expunged) as acquitted_counts,
  count(distinct cd.id) filter (where cd.finality_status in ('Vacated','Reversed') or cd.disposition_type in ('Conviction vacated','Judgment reversed')) as vacated_or_reversed_convictions,
  count(distinct cd.id) filter (where cd.sealed or cd.access_classification = 'Sealed') as sealed_records,
  max(cd.disposition_date) as most_recent_disposition,
  bool_or(s.active_supervision) as active_sentence_or_supervision,
  count(distinct cd.id) filter (where cd.appeal_status = 'On appeal') as cases_on_appeal,
  count(distinct cc.id) filter (where not exists (select 1 from public.charge_dispositions d where d.charge_id = cc.id)) as incomplete_dispositions
from public.persons p
left join public.arrest_events ae on ae.person_id = p.id
left join public.criminal_charges cc on cc.person_id = p.id
left join public.charge_dispositions cd on cd.person_id = p.id
left join public.sentences s on s.disposition_id = cd.id
where public.can_view_criminal_history()
group by p.id, p.person_record_number, p.legal_first_name, p.legal_middle_name, p.legal_last_name, p.suffix;

create or replace view public.incomplete_dispositions_queue
with (security_barrier = true) as
select
  cc.id as charge_id,
  cc.person_id,
  p.person_record_number,
  trim(p.legal_first_name || ' ' || coalesce(p.legal_middle_name || ' ', '') || p.legal_last_name) as person_name,
  cc.case_id,
  c.case_number,
  c.docket_number,
  cc.count_number,
  cc.statute_citation,
  cc.offense_title,
  cc.filing_date,
  'Disposition not received'::text as completeness_warning
from public.criminal_charges cc
join public.persons p on p.id = cc.person_id
left join public.cases c on c.id = cc.case_id
where not exists (select 1 from public.charge_dispositions cd where cd.charge_id = cc.id)
  and cc.status not in ('Declined','No bill','Superseded','Sealed','Expunged')
  and public.can_view_criminal_history();

create or replace function public.log_criminal_history_search(
  p_query text,
  p_purpose text,
  p_results_count integer,
  p_viewed_person_ids uuid[] default '{}',
  p_related_case_id uuid default null,
  p_related_matter_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_view_criminal_history(auth.uid()) then
    insert into public.audit_logs(user_id, action, table_name, description, metadata)
    values (auth.uid(), 'CRIMINAL_HISTORY_SEARCH_DENIED', 'persons', 'Intento denegado de consulta de antecedentes', jsonb_build_object('purpose', left(coalesce(p_purpose,''), 200)));
    raise exception 'No autorizado';
  end if;
  if length(trim(coalesce(p_purpose,''))) < 8 then raise exception 'Debe indicar un propósito de búsqueda'; end if;
  insert into public.criminal_history_search_logs(user_id, search_purpose, query_hash, related_case_id, related_matter_id, results_count, viewed_person_ids)
  values (auth.uid(), trim(p_purpose), encode(digest(coalesce(p_query,''), 'sha256'), 'hex'), p_related_case_id, p_related_matter_id, greatest(coalesce(p_results_count,0),0), coalesce(p_viewed_person_ids,'{}'));
  insert into public.audit_logs(user_id, action, table_name, description, metadata)
  values (auth.uid(), 'CRIMINAL_HISTORY_SEARCH', 'persons', 'Consulta interna de registros de antecedentes', jsonb_build_object('purpose', trim(p_purpose), 'results_count', p_results_count));
end $$;

create or replace function public.record_final_case_disposition(
  p_case_id uuid,
  p_person_id uuid,
  p_legal_first_name text,
  p_legal_middle_name text,
  p_legal_last_name text,
  p_date_of_birth date,
  p_count_number integer,
  p_statute_citation text,
  p_offense_title text,
  p_offense_level text,
  p_charging_instrument text,
  p_disposition_type text,
  p_disposition_date date,
  p_judgment_date date,
  p_sentence jsonb,
  p_access_classification text,
  p_certification text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_case public.cases%rowtype;
  v_person_id uuid;
  v_source_id uuid;
  v_charge_id uuid;
  v_disposition_id uuid;
  v_conviction boolean;
  v_sentence jsonb := coalesce(p_sentence, '{}'::jsonb);
begin
  if v_actor is null or not public.can_manage_criminal_history('record_disposition', v_actor) then
    insert into public.audit_logs(user_id, action, table_name, record_id, description)
    values (v_actor, 'FINAL_DISPOSITION_DENIED', 'cases', p_case_id, 'Intento denegado de registrar disposición final');
    raise exception 'No autorizado para registrar disposiciones finales';
  end if;
  if length(trim(coalesce(p_certification,''))) < 12 then raise exception 'Debe certificar la fuente y revisión de la disposición'; end if;

  select * into v_case from public.cases where id = p_case_id for update;
  if not found then raise exception 'Case no encontrado'; end if;
  if v_case.case_category not in ('Criminal','Magistrate Judge proceeding') then raise exception 'La disposición penal solo aplica a Criminal Cases o proceedings magistrales'; end if;

  if p_person_id is not null then
    select id into v_person_id from public.persons where id = p_person_id for update;
    if v_person_id is null then raise exception 'Person record no encontrado'; end if;
  else
    if length(trim(coalesce(p_legal_first_name,''))) < 1 or length(trim(coalesce(p_legal_last_name,''))) < 1 then
      raise exception 'Debe seleccionar o crear la persona vinculada';
    end if;
    insert into public.persons(legal_first_name, legal_middle_name, legal_last_name, date_of_birth, record_source, verification_status, duplicate_review_status, access_classification, created_by, updated_by)
    values (trim(p_legal_first_name), nullif(trim(coalesce(p_legal_middle_name,'')), ''), trim(p_legal_last_name), p_date_of_birth, 'case-disposition', 'Pending verification', 'Not reviewed', coalesce(p_access_classification,'Restricted'), v_actor, v_actor)
    returning id into v_person_id;
  end if;

  insert into public.record_sources(source_type, title, case_id, source_court, verification_status, entered_by)
  values ('Judgment', 'Final disposition review for ' || coalesce(v_case.case_number, v_case.internal_number), p_case_id, v_case.docket_court, 'Verified', v_actor)
  returning id into v_source_id;

  insert into public.criminal_charges(person_id, case_id, matter_id, count_number, statute_citation, offense_title, offense_level, charging_instrument, filing_date, prosecuting_office, status, access_classification, source_id, entered_by)
  values (v_person_id, p_case_id, v_case.matter_id, p_count_number, trim(p_statute_citation), trim(p_offense_title), nullif(p_offense_level,''), nullif(p_charging_instrument,''), v_case.filed_at::date, nullif(v_case.originating_court_or_agency,''), 'Filed', coalesce(p_access_classification,'Restricted'), v_source_id, v_actor)
  on conflict (person_id, case_id, count_number, statute_citation) where case_id is not null and count_number is not null and status <> 'Superseded'
  do update set offense_title = excluded.offense_title, offense_level = excluded.offense_level, charging_instrument = excluded.charging_instrument, updated_at = now()
  returning id into v_charge_id;

  if exists (
    select 1 from public.charge_dispositions
    where charge_id = v_charge_id and disposition_type = p_disposition_type and disposition_date = p_disposition_date
  ) then
    raise exception 'Ya existe una disposición registrada para este cargo, fecha y resultado';
  end if;

  v_conviction := public.criminal_history_conviction_type(p_disposition_type)
    and coalesce(p_access_classification,'Restricted') <> 'Expunged';

  insert into public.charge_dispositions(person_id, charge_id, case_id, court_id, case_number, docket_number, count_number, disposition_date, disposition_type, conviction_indicator, judgment_date, appeal_status, finality_status, sealed, expunged, access_classification, source_id, entered_by, verification_status)
  values (v_person_id, v_charge_id, p_case_id, v_case.court_id, v_case.case_number, v_case.docket_number, p_count_number, p_disposition_date, p_disposition_type, v_conviction, p_judgment_date,
    case when p_disposition_type in ('Judgment reversed','Conviction vacated','Remanded') then 'Reversed' else 'No appeal recorded' end,
    case when p_disposition_type in ('Conviction vacated') then 'Vacated' when p_disposition_type in ('Judgment reversed') then 'Reversed' when p_disposition_type = 'Remanded' then 'Remanded' else 'Final' end,
    coalesce(p_access_classification,'Restricted') = 'Sealed',
    coalesce(p_access_classification,'Restricted') = 'Expunged' or p_disposition_type = 'Expunged',
    coalesce(p_access_classification,'Restricted'),
    v_source_id, v_actor, 'Verified')
  returning id into v_disposition_id;

  if v_conviction or jsonb_typeof(v_sentence) = 'object' then
    insert into public.sentences(disposition_id, imprisonment, probation, supervised_release, fine_amount, restitution_amount, forfeiture, community_service, special_assessment, concurrent_or_consecutive, other_conditions, active_supervision, created_by)
    values (
      v_disposition_id,
      nullif(v_sentence->>'imprisonment',''),
      nullif(v_sentence->>'probation',''),
      nullif(v_sentence->>'supervised_release',''),
      nullif(v_sentence->>'fine_amount','')::numeric,
      nullif(v_sentence->>'restitution_amount','')::numeric,
      nullif(v_sentence->>'forfeiture',''),
      nullif(v_sentence->>'community_service',''),
      nullif(v_sentence->>'special_assessment','')::numeric,
      nullif(v_sentence->>'concurrent_or_consecutive',''),
      nullif(v_sentence->>'other_conditions',''),
      coalesce((v_sentence->>'active_supervision')::boolean, false),
      v_actor
    );
  end if;

  update public.criminal_charges
  set status = case
    when p_disposition_type in ('Convicted after trial','Guilty plea','Nolo contendere plea') then 'Convicted'
    when p_disposition_type = 'Acquitted' then 'Acquitted'
    when p_disposition_type like 'Dismissed%' then 'Dismissed'
    when p_disposition_type = 'Charge declined' then 'Declined'
    when p_disposition_type = 'No bill' then 'No bill'
    when p_disposition_type = 'Sealed' then 'Sealed'
    when p_disposition_type = 'Expunged' then 'Expunged'
    else status
  end,
  updated_at = now()
  where id = v_charge_id;

  insert into public.workflow_events(case_id, matter_id, event_code, title, description, previous_status, new_status, occurred_at, created_by)
  values (p_case_id, v_case.matter_id, 'FINAL_DISPOSITION_RECORDED', 'Final criminal disposition recorded', 'Count ' || coalesce(p_count_number::text,'N/A') || ' recorded as ' || p_disposition_type, v_case.status, v_case.status, now(), v_actor);

  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (v_actor, 'FINAL_DISPOSITION_RECORDED', 'charge_dispositions', v_disposition_id, 'Disposición final penal registrada', jsonb_build_object('case_id', p_case_id, 'person_id', v_person_id, 'charge_id', v_charge_id, 'disposition_type', p_disposition_type, 'certification', p_certification));

  return jsonb_build_object('ok', true, 'person_id', v_person_id, 'charge_id', v_charge_id, 'disposition_id', v_disposition_id);
end $$;

create or replace function public.verify_record_document(p_verification_number text, p_document_hash text)
returns table(valid boolean, issue_date timestamptz, expiration_date timestamptz, document_type text, status text, limited_subject_display text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select
    dv.status = 'Current' and (dv.expiration_date is null or dv.expiration_date > now()) as valid,
    dv.issue_date,
    dv.expiration_date,
    dv.document_type,
    dv.status,
    dv.limited_subject_display
  from public.document_verifications dv
  where dv.document_verification_number = trim(p_verification_number)
    and dv.document_hash = trim(p_document_hash)
  limit 1;
end $$;

do $$
declare
  tbl regclass;
begin
  foreach tbl in array array[
    'public.persons'::regclass,
    'public.person_aliases'::regclass,
    'public.person_identifiers'::regclass,
    'public.person_merge_history'::regclass,
    'public.record_sources'::regclass,
    'public.arrest_events'::regclass,
    'public.criminal_charges'::regclass,
    'public.charge_dispositions'::regclass,
    'public.sentences'::regclass,
    'public.record_restrictions'::regclass,
    'public.record_corrections'::regclass,
    'public.criminal_history_summary_requests'::regclass,
    'public.background_check_requests'::regclass,
    'public.background_check_consents'::regclass,
    'public.identity_verification_requests'::regclass,
    'public.record_access_tokens'::regclass,
    'public.issued_record_summaries'::regclass,
    'public.document_verifications'::regclass,
    'public.criminal_history_correction_requests'::regclass,
    'public.criminal_history_search_logs'::regclass
  ] loop
    execute format('alter table %s enable row level security', tbl);
  end loop;
end $$;

drop policy if exists criminal_history_persons_staff_read on public.persons;
create policy criminal_history_persons_staff_read on public.persons for select to authenticated using (public.can_view_criminal_history());
drop policy if exists criminal_history_persons_staff_write on public.persons;
create policy criminal_history_persons_staff_write on public.persons for all to authenticated using (public.can_manage_criminal_history('edit')) with check (public.can_manage_criminal_history('create') or public.can_manage_criminal_history('edit'));

drop policy if exists person_aliases_staff_access on public.person_aliases;
create policy person_aliases_staff_access on public.person_aliases for all to authenticated using (public.can_view_criminal_history()) with check (public.can_manage_criminal_history('edit'));
drop policy if exists person_identifiers_staff_access on public.person_identifiers;
create policy person_identifiers_staff_access on public.person_identifiers for all to authenticated using (public.can_view_criminal_history()) with check (public.can_manage_criminal_history('edit'));
drop policy if exists person_merge_history_staff_read on public.person_merge_history;
create policy person_merge_history_staff_read on public.person_merge_history for select to authenticated using (public.can_view_criminal_history());
drop policy if exists person_merge_history_owner_write on public.person_merge_history;
create policy person_merge_history_owner_write on public.person_merge_history for all to authenticated using (public.can_manage_criminal_history('merge')) with check (public.can_manage_criminal_history('merge'));

drop policy if exists criminal_history_core_read on public.record_sources;
create policy criminal_history_core_read on public.record_sources for select to authenticated using (public.can_view_criminal_history());
drop policy if exists criminal_history_core_write on public.record_sources;
create policy criminal_history_core_write on public.record_sources for all to authenticated using (public.can_manage_criminal_history('edit')) with check (public.can_manage_criminal_history('edit') or public.can_manage_criminal_history('record_disposition'));

drop policy if exists arrest_events_staff_access on public.arrest_events;
create policy arrest_events_staff_access on public.arrest_events for all to authenticated using (public.can_view_criminal_history()) with check (public.can_manage_criminal_history('create') or public.can_manage_criminal_history('edit'));
drop policy if exists criminal_charges_staff_access on public.criminal_charges;
create policy criminal_charges_staff_access on public.criminal_charges for all to authenticated using (public.can_view_criminal_history()) with check (public.can_manage_criminal_history('create') or public.can_manage_criminal_history('edit') or public.can_manage_criminal_history('record_disposition'));
drop policy if exists charge_dispositions_staff_access on public.charge_dispositions;
create policy charge_dispositions_staff_access on public.charge_dispositions for all to authenticated using (public.can_view_criminal_history()) with check (public.can_manage_criminal_history('record_disposition') or public.can_manage_criminal_history('correct'));
drop policy if exists sentences_staff_access on public.sentences;
create policy sentences_staff_access on public.sentences for all to authenticated using (public.can_view_criminal_history()) with check (public.can_manage_criminal_history('record_disposition') or public.can_manage_criminal_history('correct'));
drop policy if exists record_restrictions_staff_access on public.record_restrictions;
create policy record_restrictions_staff_access on public.record_restrictions for all to authenticated using (public.can_view_criminal_history()) with check (public.can_manage_criminal_history('seal') or public.can_manage_criminal_history('expunge') or public.can_manage_criminal_history('correct'));
drop policy if exists record_corrections_staff_access on public.record_corrections;
create policy record_corrections_staff_access on public.record_corrections for all to authenticated using (public.can_view_criminal_history()) with check (public.can_manage_criminal_history('correct'));

drop policy if exists history_requests_staff_read on public.criminal_history_summary_requests;
create policy history_requests_staff_read on public.criminal_history_summary_requests for select to authenticated using (public.has_effective_permission('solicitudes_antecedentes','view'));
drop policy if exists history_requests_staff_update on public.criminal_history_summary_requests;
create policy history_requests_staff_update on public.criminal_history_summary_requests for update to authenticated using (public.has_effective_permission('solicitudes_antecedentes','review')) with check (public.has_effective_permission('solicitudes_antecedentes','review'));

drop policy if exists background_requests_staff_read on public.background_check_requests;
create policy background_requests_staff_read on public.background_check_requests for select to authenticated using (public.has_effective_permission('solicitudes_antecedentes','view'));
drop policy if exists background_requests_staff_update on public.background_check_requests;
create policy background_requests_staff_update on public.background_check_requests for update to authenticated using (public.has_effective_permission('solicitudes_antecedentes','review')) with check (public.has_effective_permission('solicitudes_antecedentes','review'));
drop policy if exists background_consents_staff_access on public.background_check_consents;
create policy background_consents_staff_access on public.background_check_consents for all to authenticated using (public.has_effective_permission('solicitudes_antecedentes','view')) with check (public.has_effective_permission('solicitudes_antecedentes','review'));
drop policy if exists identity_verification_staff_access on public.identity_verification_requests;
create policy identity_verification_staff_access on public.identity_verification_requests for all to authenticated using (public.has_effective_permission('solicitudes_antecedentes','view')) with check (public.has_effective_permission('solicitudes_antecedentes','review'));
drop policy if exists record_access_tokens_staff_access on public.record_access_tokens;
create policy record_access_tokens_staff_access on public.record_access_tokens for all to authenticated using (public.has_effective_permission('solicitudes_antecedentes','issue_token')) with check (public.has_effective_permission('solicitudes_antecedentes','issue_token'));
drop policy if exists issued_record_summaries_staff_read on public.issued_record_summaries;
create policy issued_record_summaries_staff_read on public.issued_record_summaries for select to authenticated using (public.has_effective_permission('antecedentes','export'));
drop policy if exists document_verifications_staff_read on public.document_verifications;
create policy document_verifications_staff_read on public.document_verifications for select to authenticated using (public.has_effective_permission('verificaciones_documento','view'));
drop policy if exists correction_requests_staff_read on public.criminal_history_correction_requests;
create policy correction_requests_staff_read on public.criminal_history_correction_requests for select to authenticated using (public.has_effective_permission('solicitudes_antecedentes','view') or public.can_manage_criminal_history('correct'));
drop policy if exists correction_requests_staff_update on public.criminal_history_correction_requests;
create policy correction_requests_staff_update on public.criminal_history_correction_requests for update to authenticated using (public.can_manage_criminal_history('correct')) with check (public.can_manage_criminal_history('correct'));
drop policy if exists search_logs_staff_read on public.criminal_history_search_logs;
create policy search_logs_staff_read on public.criminal_history_search_logs for select to authenticated using (public.has_effective_permission('auditoria','view') or user_id = auth.uid());

grant select, insert, update on public.persons, public.person_aliases, public.person_identifiers, public.record_sources, public.arrest_events, public.criminal_charges, public.charge_dispositions, public.sentences, public.record_restrictions, public.record_corrections, public.criminal_history_summary_requests, public.background_check_requests, public.background_check_consents, public.identity_verification_requests, public.record_access_tokens, public.issued_record_summaries, public.document_verifications, public.criminal_history_correction_requests, public.criminal_history_search_logs to authenticated;
grant select on public.person_criminal_history_summary, public.incomplete_dispositions_queue to authenticated;
grant execute on function public.log_criminal_history_search(text,text,integer,uuid[],uuid,uuid) to authenticated;
grant execute on function public.record_final_case_disposition(uuid,uuid,text,text,text,date,integer,text,text,text,text,text,date,date,jsonb,text,text) to authenticated;
grant execute on function public.verify_record_document(text,text) to anon, authenticated;

do $$
declare
  tbl regclass;
begin
  foreach tbl in array array[
    'public.persons'::regclass,
    'public.arrest_events'::regclass,
    'public.criminal_charges'::regclass,
    'public.charge_dispositions'::regclass,
    'public.sentences'::regclass,
    'public.record_restrictions'::regclass,
    'public.record_corrections'::regclass,
    'public.criminal_history_summary_requests'::regclass,
    'public.background_check_requests'::regclass,
    'public.criminal_history_correction_requests'::regclass,
    'public.document_verifications'::regclass,
    'public.criminal_history_search_logs'::regclass
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %s', tbl);
    exception when duplicate_object or undefined_object then null;
    end;
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('criminal-history-documents', 'criminal-history-documents', false, 10485760, array['application/pdf','image/png','image/jpeg','text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists criminal_history_documents_staff_read on storage.objects;
create policy criminal_history_documents_staff_read on storage.objects for select to authenticated
using (bucket_id = 'criminal-history-documents' and public.can_view_criminal_history());
drop policy if exists criminal_history_documents_staff_insert on storage.objects;
create policy criminal_history_documents_staff_insert on storage.objects for insert to authenticated
with check (bucket_id = 'criminal-history-documents' and public.can_manage_criminal_history('create'));
drop policy if exists criminal_history_documents_staff_update on storage.objects;
create policy criminal_history_documents_staff_update on storage.objects for update to authenticated
using (bucket_id = 'criminal-history-documents' and public.can_manage_criminal_history('edit'))
with check (bucket_id = 'criminal-history-documents' and public.can_manage_criminal_history('edit'));

drop trigger if exists persons_updated on public.persons;
create trigger persons_updated before update on public.persons for each row execute function public.set_updated_at();
drop trigger if exists arrest_events_updated on public.arrest_events;
create trigger arrest_events_updated before update on public.arrest_events for each row execute function public.set_updated_at();
drop trigger if exists criminal_charges_updated on public.criminal_charges;
create trigger criminal_charges_updated before update on public.criminal_charges for each row execute function public.set_updated_at();
drop trigger if exists charge_dispositions_updated on public.charge_dispositions;
create trigger charge_dispositions_updated before update on public.charge_dispositions for each row execute function public.set_updated_at();
drop trigger if exists sentences_updated on public.sentences;
create trigger sentences_updated before update on public.sentences for each row execute function public.set_updated_at();
drop trigger if exists history_summary_requests_updated on public.criminal_history_summary_requests;
create trigger history_summary_requests_updated before update on public.criminal_history_summary_requests for each row execute function public.set_updated_at();
drop trigger if exists background_check_requests_updated on public.background_check_requests;
create trigger background_check_requests_updated before update on public.background_check_requests for each row execute function public.set_updated_at();
drop trigger if exists correction_requests_updated on public.criminal_history_correction_requests;
create trigger correction_requests_updated before update on public.criminal_history_correction_requests for each row execute function public.set_updated_at();

drop trigger if exists audit_persons on public.persons;
create trigger audit_persons after insert or update or delete on public.persons for each row execute function public.audit_change();
drop trigger if exists audit_arrest_events on public.arrest_events;
create trigger audit_arrest_events after insert or update or delete on public.arrest_events for each row execute function public.audit_change();
drop trigger if exists audit_criminal_charges on public.criminal_charges;
create trigger audit_criminal_charges after insert or update or delete on public.criminal_charges for each row execute function public.audit_change();
drop trigger if exists audit_charge_dispositions on public.charge_dispositions;
create trigger audit_charge_dispositions after insert or update or delete on public.charge_dispositions for each row execute function public.audit_change();
drop trigger if exists audit_sentences on public.sentences;
create trigger audit_sentences after insert or update or delete on public.sentences for each row execute function public.audit_change();
drop trigger if exists audit_record_restrictions on public.record_restrictions;
create trigger audit_record_restrictions after insert or update or delete on public.record_restrictions for each row execute function public.audit_change();
drop trigger if exists audit_record_corrections on public.record_corrections;
create trigger audit_record_corrections after insert or update or delete on public.record_corrections for each row execute function public.audit_change();
drop trigger if exists audit_history_requests on public.criminal_history_summary_requests;
create trigger audit_history_requests after insert or update or delete on public.criminal_history_summary_requests for each row execute function public.audit_change();
drop trigger if exists audit_background_requests on public.background_check_requests;
create trigger audit_background_requests after insert or update or delete on public.background_check_requests for each row execute function public.audit_change();
drop trigger if exists audit_correction_requests on public.criminal_history_correction_requests;
create trigger audit_correction_requests after insert or update or delete on public.criminal_history_correction_requests for each row execute function public.audit_change();

notify pgrst, 'reload schema';
