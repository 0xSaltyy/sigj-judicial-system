-- DOJ Roleplay · U.S. federal Matter/Case model reform.
-- Non-destructive migration: legacy Colombian/SIGJ columns are preserved as metadata
-- while new federal catalogs, relationships and validations become the operational model.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create table if not exists public.federal_courts (
  id uuid primary key default gen_random_uuid(),
  court_system text not null check (court_system in (
    'Supreme Court of the United States',
    'United States Court of Appeals',
    'United States District Court',
    'United States Bankruptcy Court',
    'United States Court of Federal Claims',
    'United States Court of International Trade',
    'Other federal court or tribunal'
  )),
  court_level text not null,
  official_name text not null unique,
  abbreviation text not null unique,
  circuit text,
  district text,
  state_or_territory text,
  geographic_division text,
  clerk_office text,
  local_rules_url text,
  time_zone text not null default 'America/New_York',
  accepted_case_categories text[] not null default '{}',
  active boolean not null default true,
  configurable_by_owner boolean not null default false,
  source_url text,
  effective_from date not null default current_date,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.court_divisions (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.federal_courts(id) on delete cascade,
  name text not null,
  division_type text not null default 'geographic',
  city text,
  state_or_territory text,
  courthouse_name text,
  clerk_office text,
  active boolean not null default true,
  effective_from date not null default current_date,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(court_id, name)
);

create table if not exists public.judges (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.federal_courts(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  judge_type text not null check (judge_type in ('Chief Justice','Associate Justice','Circuit Judge','District Judge','Magistrate Judge','Bankruptcy Judge','Special Master','Other')),
  chambers text,
  active boolean not null default true,
  effective_from date not null default current_date,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_type_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  official_label text not null,
  display_label_es text not null,
  court_system text,
  description text,
  protected_entry boolean not null default true,
  active boolean not null default true,
  effective_from date not null default current_date,
  retired_at timestamptz,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nature_of_suit_catalog (
  code text primary key,
  official_label text not null,
  display_label_es text not null,
  category text not null,
  source_version text not null,
  source_url text not null,
  protected_entry boolean not null default true,
  active boolean not null default true,
  effective_from date not null default '2026-07-23',
  retired_at timestamptz,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matter_type_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  official_label text not null,
  display_label_es text not null,
  description text,
  protected_entry boolean not null default true,
  active boolean not null default true,
  effective_from date not null default current_date,
  retired_at timestamptz,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participant_role_catalog (
  code text primary key,
  role_scope text not null check (role_scope in ('matter','civil','criminal','appeal','bankruptcy','administrative','universal')),
  official_label text not null,
  display_label_es text not null,
  protected_entry boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_type_catalog (
  code text primary key,
  record_scope text not null check (record_scope in ('matter','civil','criminal','appeal','bankruptcy','warrant','universal')),
  official_label text not null,
  display_label_es text not null,
  restricted_by_default boolean not null default false,
  protected_entry boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_status_catalog (
  id uuid primary key default gen_random_uuid(),
  record_scope text not null check (record_scope in ('matter','civil','criminal_investigation','criminal_case','magistrate','miscellaneous','appeal','bankruptcy','warrant','universal')),
  status_code text not null,
  official_label text not null,
  display_label_es text not null,
  terminal boolean not null default false,
  protected_entry boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(record_scope, status_code)
);

create table if not exists public.federal_model_migration_report (
  id uuid primary key default gen_random_uuid(),
  legacy_table text not null,
  legacy_field text not null,
  new_model_target text not null,
  mapping_confidence text not null check (mapping_confidence in ('direct','partial','ambiguous','obsolete')),
  treatment text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique(legacy_table, legacy_field, new_model_target)
);

alter table public.matters add column if not exists matter_category text;
alter table public.matters add column if not exists lead_component text;
alter table public.matters add column if not exists participating_components text[] not null default '{}';
alter table public.matters add column if not exists lead_attorney_id uuid references public.profiles(id) on delete set null;
alter table public.matters add column if not exists assigned_attorney_ids uuid[] not null default '{}';
alter table public.matters add column if not exists investigating_agency text;
alter table public.matters add column if not exists referring_agency text;
alter table public.matters add column if not exists referral_date date;
alter table public.matters add column if not exists statutes_under_review text[] not null default '{}';
alter table public.matters add column if not exists subjects jsonb not null default '[]';
alter table public.matters add column if not exists targets jsonb not null default '[]';
alter table public.matters add column if not exists witnesses jsonb not null default '[]';
alter table public.matters add column if not exists victims jsonb not null default '[]';
alter table public.matters add column if not exists related_entities jsonb not null default '[]';
alter table public.matters add column if not exists jurisdiction text;
alter table public.matters add column if not exists investigative_district text;
alter table public.matters add column if not exists security_classification text not null default 'Internal DOJ only';
alter table public.matters add column if not exists access_restrictions text;
alter table public.matters add column if not exists grand_jury_secret boolean not null default false;
alter table public.matters add column if not exists limitation_deadlines jsonb not null default '[]';
alter table public.matters add column if not exists closing_date date;
alter table public.matters add column if not exists closing_reason text;
alter table public.matters add column if not exists legacy_metadata jsonb not null default '{}';

alter table public.cases add column if not exists record_context text not null default 'federal_case' check (record_context in ('federal_case','case_from_matter','existing_case_proceeding','appeal','magistrate_proceeding','bankruptcy','specialized'));
alter table public.cases add column if not exists court_id uuid references public.federal_courts(id) on delete set null;
alter table public.cases add column if not exists court_division_id uuid references public.court_divisions(id) on delete set null;
alter table public.cases add column if not exists case_category text not null default 'Civil';
alter table public.cases add column if not exists case_caption text;
alter table public.cases add column if not exists assigned_district_judge_id uuid references public.judges(id) on delete set null;
alter table public.cases add column if not exists assigned_magistrate_judge_id uuid references public.judges(id) on delete set null;
alter table public.cases add column if not exists assigned_appellate_panel jsonb not null default '[]';
alter table public.cases add column if not exists originating_court_or_agency text;
alter table public.cases add column if not exists originating_case_number text;
alter table public.cases add column if not exists originating_docket_number text;
alter table public.cases add column if not exists appellate_docket_number text;
alter table public.cases add column if not exists sealed boolean not null default false;
alter table public.cases add column if not exists grand_jury_restricted boolean not null default false;
alter table public.cases add column if not exists federal_access_level text not null default 'Internal DOJ only' check (federal_access_level in ('Public','Restricted','Sealed','Grand-jury restricted','Internal DOJ only'));
alter table public.cases add column if not exists legacy_colombian_metadata jsonb not null default '{}';

alter table public.roleplay_warrants add column if not exists originating_matter_id uuid references public.matters(id) on delete set null;
alter table public.roleplay_warrants add column if not exists magistrate_proceeding_type text;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  person_or_organization text not null default 'person' check (person_or_organization in ('person','organization','agency')),
  legal_name text not null,
  display_name text,
  government_agency text,
  address text,
  address_restricted boolean not null default true,
  contact_info text,
  contact_restricted boolean not null default true,
  sealed boolean not null default false,
  minor boolean not null default false,
  pseudonym boolean not null default false,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.matter_participants (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  role_code text not null references public.participant_role_catalog(code),
  side text,
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique(matter_id, participant_id, role_code, start_date)
);

create table if not exists public.case_participants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  role_code text not null references public.participant_role_catalog(code),
  side text,
  counsel text,
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique(case_id, participant_id, role_code, start_date)
);

create table if not exists public.case_assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  assignee_profile_id uuid references public.profiles(id) on delete set null,
  assignee_judge_id uuid references public.judges(id) on delete set null,
  assignment_role text not null,
  start_date timestamptz not null default now(),
  end_date timestamptz,
  assignment_reason text,
  assigned_by uuid references auth.users(id),
  recusal boolean not null default false,
  reassignment boolean not null default false,
  related_audit_id uuid references public.audit_logs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.matter_assignments (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  assignee_profile_id uuid references public.profiles(id) on delete set null,
  assignment_role text not null,
  start_date timestamptz not null default now(),
  end_date timestamptz,
  assignment_reason text,
  assigned_by uuid references auth.users(id),
  related_audit_id uuid references public.audit_logs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.civil_case_details (
  case_id uuid primary key references public.cases(id) on delete cascade,
  nature_of_suit_code text references public.nature_of_suit_catalog(code),
  cause_of_action text,
  basis_of_jurisdiction text check (basis_of_jurisdiction in ('U.S. Government Plaintiff','U.S. Government Defendant','Federal Question','Diversity')),
  plaintiff_citizenship text,
  defendant_citizenship text,
  amount_in_controversy numeric(18,2),
  origin_code integer check (origin_code in (1,2,3,4,5,6,8)),
  jury_demand boolean not null default false,
  class_action boolean not null default false,
  related_case_indicator boolean not null default false,
  multidistrict_litigation_indicator boolean not null default false,
  county_of_residence text,
  summons_requested boolean not null default false,
  filing_fee_status text,
  ifp_requested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.criminal_case_details (
  case_id uuid primary key references public.cases(id) on delete cascade,
  charging_instrument text check (charging_instrument in ('Criminal Complaint','Indictment','Superseding Indictment','Information','Superseding Information','Citation or Violation Notice')),
  complaint_number text,
  indictment_number text,
  offense_statutes text[] not null default '{}',
  counts jsonb not null default '[]',
  offense_description text,
  offense_level text check (offense_level in ('Felony','Class A misdemeanor','Class B misdemeanor','Class C misdemeanor','Infraction/petty offense')),
  arrest_status text,
  custody_status text,
  initial_appearance_at timestamptz,
  detention_hearing_at timestamptz,
  preliminary_hearing_at timestamptz,
  grand_jury_status text,
  prosecuting_office text,
  lead_ausa text,
  speedy_trial_events jsonb not null default '[]',
  disposition text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appeal_details (
  case_id uuid primary key references public.cases(id) on delete cascade,
  notice_of_appeal_date date,
  appellate_basis text,
  cross_appeal boolean not null default false,
  agency_review boolean not null default false,
  record_transmitted_at timestamptz,
  briefing_schedule jsonb not null default '[]',
  oral_argument_at timestamptz,
  opinion text,
  judgment text,
  mandate_at timestamptz,
  supreme_court_petition_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matter_case_relationships (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  relationship_type text not null default 'originating_matter',
  copied_fields jsonb not null default '[]',
  confidentiality_reviewed boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(matter_id, case_id, relationship_type)
);

create table if not exists public.docket_entries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  docket_entry_number integer not null,
  filing_timestamp timestamptz not null default now(),
  filed_by_participant_id uuid references public.participants(id) on delete set null,
  document_type_code text references public.document_type_catalog(code),
  title text not null,
  related_motion_id uuid,
  visibility public.visibility_level not null default 'internal',
  main_document_id uuid references public.documents(id) on delete set null,
  attachments jsonb not null default '[]',
  court_action text,
  entered_by_clerk text,
  service_status text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(case_id, docket_entry_number)
);

create table if not exists public.filings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete cascade,
  docket_entry_id uuid references public.docket_entries(id) on delete set null,
  filing_type text not null,
  title text not null,
  filed_by text,
  filing_timestamp timestamptz not null default now(),
  visibility public.visibility_level not null default 'internal',
  document_id uuid references public.documents(id) on delete set null,
  restricted_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (case_id is not null or matter_id is not null)
);

create table if not exists public.motions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  motion_type text not null,
  movant_participant_id uuid references public.participants(id) on delete set null,
  responding_participant_ids uuid[] not null default '{}',
  filing_id uuid references public.filings(id) on delete set null,
  filed_at timestamptz,
  response_deadline timestamptz,
  reply_deadline timestamptz,
  hearing_id uuid references public.hearings(id) on delete set null,
  status text not null default 'Filed',
  disposition text,
  related_order_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  order_type text not null,
  issuing_judge_id uuid references public.judges(id) on delete set null,
  signed_at timestamptz,
  entered_at timestamptz,
  related_motion_id uuid references public.motions(id) on delete set null,
  effect text,
  visibility public.visibility_level not null default 'internal',
  compliance_deadline timestamptz,
  document_id uuid references public.documents(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.docket_entries
  drop constraint if exists docket_entries_related_motion_fk;
alter table public.docket_entries
  add constraint docket_entries_related_motion_fk foreign key (related_motion_id) references public.motions(id) on delete set null;

alter table public.motions
  drop constraint if exists motions_related_order_fk;
alter table public.motions
  add constraint motions_related_order_fk foreign key (related_order_id) references public.orders(id) on delete set null;

alter table public.hearings add column if not exists court_id uuid references public.federal_courts(id) on delete set null;
alter table public.hearings add column if not exists judge_id uuid references public.judges(id) on delete set null;
alter table public.hearings add column if not exists courtroom text;
alter table public.hearings add column if not exists attendance_mode text check (attendance_mode in ('in_person','remote','hybrid'));
alter table public.hearings add column if not exists sealed boolean not null default false;
alter table public.hearings add column if not exists result text;
alter table public.hearings add column if not exists minutes text;
alter table public.hearings add column if not exists continued_at timestamptz;

create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete cascade,
  deadline_type text not null,
  due_at timestamptz not null,
  source_event text,
  status text not null default 'Open' check (status in ('Open','Satisfied','Extended','Vacated','Missed')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (case_id is not null or matter_id is not null)
);

create table if not exists public.case_relationships (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  related_case_id uuid not null references public.cases(id) on delete cascade,
  relationship_type text not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (case_id <> related_case_id),
  unique(case_id, related_case_id, relationship_type)
);

create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete cascade,
  event_scope text not null,
  event_code text not null,
  title text not null,
  description text,
  occurred_at timestamptz not null default now(),
  previous_status text,
  new_status text,
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (case_id is not null or matter_id is not null)
);

create index if not exists federal_courts_system_idx on public.federal_courts(court_system, active);
create index if not exists court_divisions_court_idx on public.court_divisions(court_id, active);
create index if not exists judges_court_idx on public.judges(court_id, active);
create index if not exists matters_category_status_idx on public.matters(matter_category, status);
create index if not exists matters_lead_component_idx on public.matters(lead_component);
create index if not exists cases_court_category_idx on public.cases(court_id, case_category);
create index if not exists cases_record_context_idx on public.cases(record_context);
create index if not exists cases_federal_access_idx on public.cases(federal_access_level, sealed, grand_jury_restricted);
create index if not exists participants_name_idx on public.participants using gin (to_tsvector('english', coalesce(legal_name,'') || ' ' || coalesce(display_name,'')));
create index if not exists case_participants_case_idx on public.case_participants(case_id);
create index if not exists matter_participants_matter_idx on public.matter_participants(matter_id);
create index if not exists docket_entries_case_number_idx on public.docket_entries(case_id, docket_entry_number);
create index if not exists filings_case_matter_idx on public.filings(case_id, matter_id);
create index if not exists motions_case_status_idx on public.motions(case_id, status);
create index if not exists orders_case_entered_idx on public.orders(case_id, entered_at desc);
create index if not exists deadlines_due_idx on public.deadlines(due_at, status);
create index if not exists workflow_events_case_idx on public.workflow_events(case_id, occurred_at desc);
create index if not exists workflow_events_matter_idx on public.workflow_events(matter_id, occurred_at desc);

insert into public.federal_courts (id, court_system, court_level, official_name, abbreviation, circuit, district, state_or_territory, clerk_office, local_rules_url, time_zone, accepted_case_categories, source_url, effective_from)
values
  ('81000000-0000-0000-0000-000000000001','Supreme Court of the United States','supreme','Supreme Court of the United States','SCOTUS',null,null,'District of Columbia','Clerk of the Supreme Court','https://www.supremecourt.gov/filingandrules/','America/New_York',array['Supreme Court proceeding','Appeal'],'https://www.supremecourt.gov/',current_date),
  ('81000000-0000-0000-0000-000000000002','United States Court of Appeals','appellate','United States Court of Appeals for the District of Columbia Circuit','D.C. Cir.','District of Columbia Circuit',null,'District of Columbia','Clerk of Court','https://www.cadc.uscourts.gov/internet/home.nsf/Content/Rules','America/New_York',array['Appeal','Specialized federal proceeding'],'https://www.cadc.uscourts.gov/',current_date),
  ('81000000-0000-0000-0000-000000000003','United States Court of Appeals','appellate','United States Court of Appeals for the Second Circuit','2d Cir.','Second Circuit',null,'New York','Clerk of Court','https://www.ca2.uscourts.gov/clerk/case_filing/rules/rules_home.html','America/New_York',array['Appeal','Specialized federal proceeding'],'https://www.ca2.uscourts.gov/',current_date),
  ('81000000-0000-0000-0000-000000000004','United States Court of Appeals','appellate','United States Court of Appeals for the Third Circuit','3d Cir.','Third Circuit',null,'Pennsylvania','Clerk of Court','https://www.ca3.uscourts.gov/rules-procedures','America/New_York',array['Appeal','Specialized federal proceeding'],'https://www.ca3.uscourts.gov/',current_date),
  ('81000000-0000-0000-0000-000000000005','United States District Court','district','United States District Court for the District of Columbia','D.D.C.',null,'District of Columbia','District of Columbia','Clerk’s Office','https://www.dcd.uscourts.gov/local-rules','America/New_York',array['Civil','Criminal','Magistrate Judge proceeding','Miscellaneous'],'https://www.dcd.uscourts.gov/',current_date),
  ('81000000-0000-0000-0000-000000000006','United States District Court','district','United States District Court for the Southern District of New York','S.D.N.Y.',null,'Southern District of New York','New York','Clerk’s Office','https://www.nysd.uscourts.gov/rules','America/New_York',array['Civil','Criminal','Magistrate Judge proceeding','Miscellaneous'],'https://www.nysd.uscourts.gov/',current_date),
  ('81000000-0000-0000-0000-000000000007','United States District Court','district','United States District Court for the District of New Jersey','D.N.J.',null,'District of New Jersey','New Jersey','Clerk’s Office','https://www.njd.uscourts.gov/rules-policies','America/New_York',array['Civil','Criminal','Magistrate Judge proceeding','Miscellaneous'],'https://www.njd.uscourts.gov/',current_date),
  ('81000000-0000-0000-0000-000000000008','United States Bankruptcy Court','bankruptcy','United States Bankruptcy Court for the District of New Jersey','Bankr. D.N.J.',null,'District of New Jersey','New Jersey','Clerk’s Office','https://www.njb.uscourts.gov/local-rules-and-orders','America/New_York',array['Bankruptcy','Adversary proceeding'],'https://www.njb.uscourts.gov/',current_date),
  ('81000000-0000-0000-0000-000000000009','United States Court of Federal Claims','specialized','United States Court of Federal Claims','Fed. Cl.',null,null,'District of Columbia','Clerk’s Office','https://www.uscfc.uscourts.gov/rules-forms','America/New_York',array['Specialized federal proceeding'],'https://www.uscfc.uscourts.gov/',current_date),
  ('81000000-0000-0000-0000-000000000010','United States Court of International Trade','specialized','United States Court of International Trade','CIT',null,null,'New York','Clerk’s Office','https://www.cit.uscourts.gov/rules','America/New_York',array['Specialized federal proceeding'],'https://www.cit.uscourts.gov/',current_date)
on conflict (id) do update set
  accepted_case_categories = excluded.accepted_case_categories,
  source_url = excluded.source_url,
  updated_at = now();

insert into public.court_divisions (court_id, name, division_type, city, state_or_territory, courthouse_name, clerk_office)
values
  ('81000000-0000-0000-0000-000000000006','Manhattan','geographic','New York','New York','Thurgood Marshall United States Courthouse','Manhattan Clerk’s Office'),
  ('81000000-0000-0000-0000-000000000006','White Plains','geographic','White Plains','New York','Charles L. Brieant Jr. Federal Building and Courthouse','White Plains Clerk’s Office'),
  ('81000000-0000-0000-0000-000000000007','Newark','geographic','Newark','New Jersey','Martin Luther King Building and U.S. Courthouse','Newark Clerk’s Office'),
  ('81000000-0000-0000-0000-000000000007','Trenton','geographic','Trenton','New Jersey','Clarkson S. Fisher U.S. Courthouse','Trenton Clerk’s Office'),
  ('81000000-0000-0000-0000-000000000007','Camden','geographic','Camden','New Jersey','Mitchell H. Cohen U.S. Courthouse','Camden Clerk’s Office')
on conflict (court_id, name) do update set active = true, updated_at = now();

insert into public.case_type_catalog (code, official_label, display_label_es, court_system, description, sort_order)
values
  ('civil','Civil','Civil','United States District Court','Civil actions filed in federal district court.',10),
  ('criminal','Criminal','Criminal','United States District Court','Filed federal criminal cases.',20),
  ('magistrate','Magistrate Judge proceeding','Procedimiento ante Magistrate Judge','United States District Court','Magistrate proceedings including warrant applications and misdemeanor proceedings.',30),
  ('miscellaneous','Miscellaneous','Miscellaneous','United States District Court','Configurable miscellaneous proceedings subject to local court practice.',40),
  ('bankruptcy','Bankruptcy','Bankruptcy','United States Bankruptcy Court','Bankruptcy cases.',50),
  ('adversary','Adversary proceeding','Adversary proceeding','United States Bankruptcy Court','Adversary proceedings related to bankruptcy cases.',60),
  ('appeal','Appeal','Apelación','United States Court of Appeals','Appellate proceedings.',70),
  ('supreme','Supreme Court proceeding','Procedimiento ante Supreme Court','Supreme Court of the United States','Supreme Court appellate or original-jurisdiction proceeding.',80),
  ('specialized','Specialized federal proceeding','Procedimiento federal especializado',null,'Proceedings before specialized federal courts or tribunals.',90)
on conflict (code) do update set display_label_es = excluded.display_label_es, updated_at = now();

insert into public.matter_type_catalog (code, official_label, display_label_es, description, sort_order)
values
  ('preliminary_inquiry','Preliminary inquiry','Evaluación preliminar','Initial review before a formal investigation or filing.',10),
  ('federal_criminal_investigation','Federal criminal investigation','Investigación penal federal','Internal criminal investigation matter before or outside a court filing.',20),
  ('civil_investigation','Civil investigation','Investigación civil','Civil investigation handled by a DOJ component.',30),
  ('defensive_civil_matter','Defensive civil matter','Asunto civil defensivo','Matter defending the United States, an agency or officer.',40),
  ('affirmative_civil_enforcement','Affirmative civil enforcement matter','Ejecución civil afirmativa','Civil enforcement matter brought by or for the United States.',50),
  ('legal_advice','Legal advice matter','Asunto de asesoría legal','Internal legal advice or review.',60),
  ('appellate_review','Appellate review','Revisión apelativa','Internal appellate review before or during appeal.',70),
  ('regulatory_administrative','Regulatory or administrative matter','Trámite regulatorio o administrativo','Administrative or regulatory work not yet a court case.',80),
  ('civil_rights_review','Civil rights review','Revisión de derechos civiles','Civil-rights related review matter.',90),
  ('opr_internal','Internal professional-responsibility matter','Responsabilidad profesional interna','Internal professional responsibility matter.',100),
  ('asset_forfeiture','Asset forfeiture investigation','Investigación de forfeiture','Asset forfeiture investigation or review.',110),
  ('foia_privacy_act','FOIA or Privacy Act matter','FOIA / Privacy Act','Records-access matter.',120),
  ('referral_evaluation','Referral evaluation','Evaluación de remisión','Evaluation of a referral from another agency or component.',130),
  ('international_assistance','International assistance matter','Asistencia internacional','International legal assistance matter.',140)
on conflict (code) do update set display_label_es = excluded.display_label_es, updated_at = now();

insert into public.participant_role_catalog (code, role_scope, official_label, display_label_es, sort_order)
values
  ('subject','matter','Subject','Subject',10),
  ('target','matter','Target','Target formal',20),
  ('witness','universal','Witness','Testigo',30),
  ('victim','criminal','Victim','Víctima',40),
  ('complainant','matter','Complainant','Denunciante',50),
  ('referring_agency','matter','Referring agency','Agencia remitente',60),
  ('investigating_agency','matter','Investigating agency','Agencia investigadora',70),
  ('responsible_attorney','matter','Responsible attorney','Attorney responsable',80),
  ('related_entity','matter','Related entity','Entidad relacionada',90),
  ('plaintiff','civil','Plaintiff','Plaintiff',100),
  ('defendant_civil','civil','Defendant','Defendant',110),
  ('petitioner','civil','Petitioner','Petitioner',120),
  ('respondent','civil','Respondent','Respondent',130),
  ('appellant','appeal','Appellant','Appellant',140),
  ('appellee','appeal','Appellee','Appellee',150),
  ('claimant','civil','Claimant','Claimant',160),
  ('counterclaimant','civil','Counterclaimant','Counterclaimant',170),
  ('counterdefendant','civil','Counterdefendant','Counterdefendant',180),
  ('crossclaimant','civil','Crossclaimant','Crossclaimant',190),
  ('crossdefendant','civil','Crossdefendant','Crossdefendant',200),
  ('intervenor','civil','Intervenor','Intervenor',210),
  ('third_party_plaintiff','civil','Third-Party Plaintiff','Third-Party Plaintiff',220),
  ('third_party_defendant','civil','Third-Party Defendant','Third-Party Defendant',230),
  ('united_states','universal','United States','United States',240),
  ('agency','universal','Agency','Agency',250),
  ('amicus','appeal','Amicus Curiae','Amicus Curiae',260),
  ('interested_party','universal','Interested Party','Interested Party',270),
  ('criminal_defendant','criminal','Defendant','Defendant',280),
  ('ausa','criminal','AUSA / Government Counsel','AUSA / Government Counsel',290),
  ('defense_counsel','criminal','Defense Counsel','Defense Counsel',300),
  ('material_witness','criminal','Material Witness','Material Witness',310),
  ('case_agent','criminal','Investigating Agent','Case Agent',320),
  ('probation_officer','criminal','Probation Officer','Probation Officer',330),
  ('pretrial_services','criminal','Pretrial Services Officer','Pretrial Services Officer',340),
  ('surety','criminal','Surety','Surety',350),
  ('debtor','bankruptcy','Debtor','Debtor',360),
  ('joint_debtor','bankruptcy','Joint Debtor','Joint Debtor',370),
  ('trustee','bankruptcy','Trustee','Trustee',380),
  ('creditor','bankruptcy','Creditor','Creditor',390)
on conflict (code) do update set display_label_es = excluded.display_label_es, updated_at = now();

insert into public.document_type_catalog (code, record_scope, official_label, display_label_es, restricted_by_default, sort_order)
values
  ('complaint','civil','Complaint','Complaint',false,10),
  ('amended_complaint','civil','Amended Complaint','Amended Complaint',false,20),
  ('summons','civil','Summons','Summons',false,30),
  ('answer','civil','Answer','Answer',false,40),
  ('motion','universal','Motion','Motion',false,50),
  ('opposition','civil','Opposition','Opposition',false,60),
  ('reply','civil','Reply','Reply',false,70),
  ('notice','universal','Notice','Notice',false,80),
  ('declaration','civil','Declaration','Declaration',false,90),
  ('affidavit','universal','Affidavit','Affidavit',false,100),
  ('exhibit','universal','Exhibit','Exhibit',false,110),
  ('discovery_filing','civil','Discovery filing','Discovery filing',true,120),
  ('proposed_order','civil','Proposed Order','Proposed Order',false,130),
  ('order','universal','Order','Order',false,140),
  ('judgment','civil','Judgment','Judgment',false,150),
  ('notice_of_appeal','appeal','Notice of Appeal','Notice of Appeal',false,160),
  ('mandate','appeal','Mandate','Mandate',false,170),
  ('criminal_complaint','criminal','Criminal Complaint','Criminal Complaint',false,180),
  ('indictment','criminal','Indictment','Indictment',false,190),
  ('superseding_indictment','criminal','Superseding Indictment','Superseding Indictment',false,200),
  ('information','criminal','Information','Information',false,210),
  ('arrest_warrant','criminal','Arrest Warrant','Arrest Warrant',true,220),
  ('search_warrant','warrant','Search Warrant','Search Warrant',true,230),
  ('detention_motion','criminal','Detention Motion','Detention Motion',false,240),
  ('detention_order','criminal','Detention Order','Detention Order',false,250),
  ('plea_agreement','criminal','Plea Agreement','Plea Agreement',true,260),
  ('verdict','criminal','Verdict','Verdict',false,270),
  ('presentence_document','criminal','Presentence document','Presentence document',true,280),
  ('criminal_judgment','criminal','Judgment in a Criminal Case','Judgment in a Criminal Case',false,290),
  ('referral','matter','Referral','Referral',true,300),
  ('intake_memo','matter','Intake Memorandum','Intake Memorandum',true,310),
  ('investigative_memo','matter','Investigative Memorandum','Investigative Memorandum',true,320),
  ('prosecution_memo','matter','Prosecution Memorandum','Prosecution Memorandum',true,330),
  ('declination_memo','matter','Declination Memorandum','Declination Memorandum',true,340),
  ('approval_request','matter','Approval Request','Approval Request',true,350),
  ('litigation_hold','matter','Litigation Hold','Litigation Hold',true,360),
  ('internal_legal_memo','matter','Internal Legal Memorandum','Internal Legal Memorandum',true,370),
  ('closing_memo','matter','Closing Memorandum','Closing Memorandum',true,380)
on conflict (code) do update set restricted_by_default = excluded.restricted_by_default, updated_at = now();

insert into public.workflow_status_catalog (record_scope, status_code, official_label, display_label_es, terminal, sort_order)
values
  ('matter','intake','Intake','Intake',false,10),
  ('matter','conflict_check','Conflict check','Conflict check',false,20),
  ('matter','preliminary_review','Preliminary review','Preliminary review',false,30),
  ('matter','open_investigation','Open investigation','Open investigation',false,40),
  ('matter','grand_jury_investigation','Grand jury investigation','Grand jury investigation',false,50),
  ('matter','enforcement_evaluation','Enforcement evaluation','Enforcement evaluation',false,60),
  ('matter','prosecution_memo_pending','Prosecution memorandum pending','Prosecution memorandum pending',false,70),
  ('matter','authorization_pending','Authorization pending','Authorization pending',false,80),
  ('matter','active_litigation_support','Active litigation support','Active litigation support',false,90),
  ('matter','referred','Referred to another component','Referred to another component',false,100),
  ('matter','declined','Declined','Declined',true,110),
  ('matter','closed','Closed','Closed',true,120),
  ('matter','reopened','Reopened','Reopened',false,130),
  ('matter','archived','Archived','Archived',true,140),
  ('civil','matter_evaluation','Matter evaluation','Matter evaluation',false,10),
  ('civil','complaint_preparation','Complaint preparation','Complaint preparation',false,20),
  ('civil','complaint_filed','Complaint filed','Complaint filed',false,30),
  ('civil','case_opened_by_clerk','Case opened by Clerk','Case opened by Clerk',false,40),
  ('civil','summons_issued','Summons issued','Summons issued',false,50),
  ('civil','service_of_process','Service of process','Service of process',false,60),
  ('civil','responsive_pleading_or_motion','Responsive pleading or motion','Responsive pleading or motion',false,70),
  ('civil','discovery','Discovery','Discovery',false,80),
  ('civil','dispositive_motions','Dispositive motions','Dispositive motions',false,90),
  ('civil','trial','Trial','Trial',false,100),
  ('civil','judgment','Judgment','Judgment',false,110),
  ('civil','appeal_pending','Appeal pending','Appeal pending',false,120),
  ('civil','closed','Closed','Closed',true,130),
  ('criminal_investigation','referral_received','Referral received','Referral received',false,10),
  ('criminal_investigation','preliminary_investigation','Preliminary investigation','Preliminary investigation',false,20),
  ('criminal_investigation','grand_jury_investigation','Grand jury investigation','Grand jury investigation',false,30),
  ('criminal_investigation','charging_review','Charging review','Charging review',false,40),
  ('criminal_investigation','prosecution_memorandum','Prosecution memorandum','Prosecution memorandum',false,50),
  ('criminal_investigation','charges_authorized','Charges authorized','Charges authorized',false,60),
  ('criminal_investigation','declined_or_closed','Declined or closed','Declined or closed',true,70),
  ('criminal_case','criminal_complaint_filed','Criminal Complaint filed','Criminal Complaint filed',false,10),
  ('criminal_case','arrest_or_summons_issued','Arrest warrant or summons issued','Arrest warrant or summons issued',false,20),
  ('criminal_case','initial_appearance','Initial appearance','Initial appearance',false,30),
  ('criminal_case','detention_hearing','Detention hearing','Detention hearing',false,40),
  ('criminal_case','indictment_or_information','Indictment / Information','Indictment / Information',false,50),
  ('criminal_case','arraignment','Arraignment','Arraignment',false,60),
  ('criminal_case','discovery','Discovery','Discovery',false,70),
  ('criminal_case','pretrial_motions','Pretrial motions','Pretrial motions',false,80),
  ('criminal_case','plea_or_trial','Plea agreement / trial','Plea agreement / trial',false,90),
  ('criminal_case','sentencing','Sentencing','Sentencing',false,100),
  ('criminal_case','appeal','Appeal','Appeal',false,110),
  ('criminal_case','closed','Closed','Closed',true,120),
  ('appeal','notice_filed','Notice filed','Notice filed',false,10),
  ('appeal','docketed','Docketed','Docketed',false,20),
  ('appeal','record_preparation','Record preparation','Record preparation',false,30),
  ('appeal','briefing','Briefing','Briefing',false,40),
  ('appeal','oral_argument_scheduled','Oral argument scheduled','Oral argument scheduled',false,50),
  ('appeal','opinion_issued','Opinion issued','Opinion issued',false,60),
  ('appeal','mandate_issued','Mandate issued','Mandate issued',false,70),
  ('appeal','closed','Closed','Closed',true,80)
on conflict (record_scope, status_code) do update set display_label_es = excluded.display_label_es, updated_at = now();

insert into public.nature_of_suit_catalog (code, official_label, display_label_es, category, source_version, source_url, sort_order)
values
  ('110','Insurance','Insurance','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',110),
  ('120','Marine','Marine','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',120),
  ('130','Miller Act','Miller Act','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',130),
  ('140','Negotiable Instrument','Negotiable Instrument','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',140),
  ('150','Recovery of Overpayment & Enforcement of Judgment','Recovery of Overpayment & Enforcement of Judgment','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',150),
  ('151','Medicare Act','Medicare Act','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',151),
  ('152','Recovery of Defaulted Student Loans','Recovery of Defaulted Student Loans','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',152),
  ('153','Recovery of Overpayment of Veteran’s Benefits','Recovery of Overpayment of Veteran’s Benefits','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',153),
  ('160','Stockholders’ Suits','Stockholders’ Suits','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',160),
  ('190','Other Contract','Other Contract','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',190),
  ('195','Contract Product Liability','Contract Product Liability','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',195),
  ('196','Franchise','Franchise','Contract','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',196),
  ('210','Land Condemnation','Land Condemnation','Real Property','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',210),
  ('220','Foreclosure','Foreclosure','Real Property','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',220),
  ('230','Rent Lease & Ejectment','Rent Lease & Ejectment','Real Property','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',230),
  ('240','Torts to Land','Torts to Land','Real Property','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',240),
  ('245','Tort Product Liability','Tort Product Liability','Real Property','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',245),
  ('290','All Other Real Property','All Other Real Property','Real Property','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',290),
  ('310','Airplane','Airplane','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',310),
  ('315','Airplane Product Liability','Airplane Product Liability','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',315),
  ('320','Assault, Libel & Slander','Assault, Libel & Slander','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',320),
  ('330','Federal Employers’ Liability','Federal Employers’ Liability','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',330),
  ('340','Marine','Marine','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',340),
  ('345','Marine Product Liability','Marine Product Liability','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',345),
  ('350','Motor Vehicle','Motor Vehicle','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',350),
  ('355','Motor Vehicle Product Liability','Motor Vehicle Product Liability','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',355),
  ('360','Other Personal Injury','Other Personal Injury','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',360),
  ('362','Personal Injury - Medical Malpractice','Personal Injury - Medical Malpractice','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',362),
  ('365','Personal Injury - Product Liability','Personal Injury - Product Liability','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',365),
  ('367','Health Care/Pharmaceutical Personal Injury Product Liability','Health Care/Pharmaceutical Personal Injury Product Liability','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',367),
  ('368','Asbestos Personal Injury Product Liability','Asbestos Personal Injury Product Liability','Torts - Personal Injury','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',368),
  ('370','Other Fraud','Other Fraud','Torts - Personal Property','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',370),
  ('371','Truth in Lending Act','Truth in Lending Act','Torts - Personal Property','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',371),
  ('380','Other Personal Property Damage','Other Personal Property Damage','Torts - Personal Property','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',380),
  ('385','Property Damage Product Liability','Property Damage Product Liability','Torts - Personal Property','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',385),
  ('440','Other Civil Rights','Other Civil Rights','Civil Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',440),
  ('441','Voting','Voting','Civil Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',441),
  ('442','Employment','Employment','Civil Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',442),
  ('443','Housing/Accommodations','Housing/Accommodations','Civil Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',443),
  ('445','Amer. w/Disabilities - Employment','ADA - Employment','Civil Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',445),
  ('446','Amer. w/Disabilities - Other','ADA - Other','Civil Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',446),
  ('448','Education','Education','Civil Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',448),
  ('510','Motions to Vacate Sentence','Motions to Vacate Sentence','Prisoner Petitions','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',510),
  ('530','General Habeas Corpus','General Habeas Corpus','Prisoner Petitions','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',530),
  ('535','Death Penalty','Death Penalty','Prisoner Petitions','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',535),
  ('540','Mandamus & Other','Mandamus & Other','Prisoner Petitions','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',540),
  ('550','Civil Rights Actions','Civil Rights Actions','Prisoner Petitions','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',550),
  ('555','Prison Condition','Prison Condition','Prisoner Petitions','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',555),
  ('560','Civil Detainee - Conditions of Confinement','Civil Detainee - Conditions of Confinement','Prisoner Petitions','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',560),
  ('625','Drug Related Seizure of Property 21 USC 881','Drug Related Seizure of Property 21 USC 881','Forfeiture/Penalty','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',625),
  ('690','Other','Other','Forfeiture/Penalty','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',690),
  ('710','Fair Labor Standards Act','Fair Labor Standards Act','Labor','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',710),
  ('720','Labor/Management Relations','Labor/Management Relations','Labor','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',720),
  ('740','Railway Labor Act','Railway Labor Act','Labor','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',740),
  ('751','Family and Medical Leave Act','Family and Medical Leave Act','Labor','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',751),
  ('790','Other Labor Litigation','Other Labor Litigation','Labor','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',790),
  ('791','Employee Retirement Income Security Act','ERISA','Employee Retirement Income Security Act','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',791),
  ('462','Naturalization Application','Naturalization Application','Immigration','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',462),
  ('463','Alien Detainee','Alien Detainee','Immigration','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',463),
  ('465','Other Immigration Actions','Other Immigration Actions','Immigration','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',465),
  ('422','Appeal 28 USC 158','Appeal 28 USC 158','Bankruptcy','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',422),
  ('423','Withdrawal 28 USC 157','Withdrawal 28 USC 157','Bankruptcy','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',423),
  ('820','Copyrights','Copyrights','Property Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',820),
  ('830','Patent','Patent','Property Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',830),
  ('835','Patent - Abbreviated New Drug Application','Patent - ANDA','Property Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',835),
  ('840','Trademark','Trademark','Property Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',840),
  ('880','Defend Trade Secrets Act of 2016','Defend Trade Secrets Act of 2016','Property Rights','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',880),
  ('861','HIA (1395ff)','HIA (1395ff)','Social Security','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',861),
  ('862','Black Lung (923)','Black Lung (923)','Social Security','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',862),
  ('863','DIWC/DIWW (405(g))','DIWC/DIWW (405(g))','Social Security','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',863),
  ('864','SSID Title XVI','SSID Title XVI','Social Security','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',864),
  ('865','RSI (405(g))','RSI (405(g))','Social Security','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',865),
  ('870','Taxes (U.S. Plaintiff or Defendant)','Taxes (U.S. Plaintiff or Defendant)','Federal Tax Suits','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',870),
  ('871','IRS—Third Party 26 USC 7609','IRS—Third Party 26 USC 7609','Federal Tax Suits','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',871),
  ('375','False Claims Act','False Claims Act','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',375),
  ('376','Qui Tam (31 USC 3729(a))','Qui Tam (31 USC 3729(a))','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',376),
  ('400','State Reapportionment','State Reapportionment','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',400),
  ('410','Antitrust','Antitrust','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',410),
  ('430','Banks and Banking','Banks and Banking','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',430),
  ('450','Commerce','Commerce','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',450),
  ('460','Deportation','Deportation','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',460),
  ('470','Racketeer Influenced and Corrupt Organizations','RICO','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',470),
  ('480','Consumer Credit','Consumer Credit','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',480),
  ('485','Telephone Consumer Protection Act','Telephone Consumer Protection Act','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',485),
  ('490','Cable/Sat TV','Cable/Sat TV','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',490),
  ('850','Securities/Commodities/Exchange','Securities/Commodities/Exchange','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',850),
  ('890','Other Statutory Actions','Other Statutory Actions','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',890),
  ('891','Agricultural Acts','Agricultural Acts','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',891),
  ('893','Environmental Matters','Environmental Matters','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',893),
  ('895','Freedom of Information Act','Freedom of Information Act','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',895),
  ('896','Arbitration','Arbitration','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',896),
  ('899','Administrative Procedure Act/Review or Appeal of Agency Decision','APA / Agency Review','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',899),
  ('950','Constitutionality of State Statutes','Constitutionality of State Statutes','Other Statutes','JS 44 (Rev. 03/24); U.S. Courts page effective 2026-07-23','https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet',950)
on conflict (code) do update set
  official_label = excluded.official_label,
  display_label_es = excluded.display_label_es,
  category = excluded.category,
  source_version = excluded.source_version,
  source_url = excluded.source_url,
  effective_from = excluded.effective_from,
  updated_at = now();

insert into public.federal_model_migration_report (legacy_table, legacy_field, new_model_target, mapping_confidence, treatment, notes)
values
  ('cases','authority_type','cases.court_id / federal_courts.court_system','ambiguous','Preserved in cases.legacy_colombian_metadata; new form requires structured federal court selection.','Legacy values such as Tribunal/Juzgado cannot be reinterpreted as DOJ components or Article III courts without review.'),
  ('cases','chamber','cases.court_division_id / judges.chambers when applicable','obsolete','Preserved as legacy metadata only; hidden from new forms.','Civil/criminal are case categories, not permanent salas. Chambers means a judge’s office only.'),
  ('cases','process_type','cases.case_category / matter_type_catalog depending on context','partial','Mapped only for obvious Civil/Criminal/Appeal values; otherwise retained for review.','Laboral/Administrativo/Constitucional are not federal court divisions in this model.'),
  ('cases','process_subtype','civil_case_details.nature_of_suit_code or workflow metadata','ambiguous','Retained in legacy metadata; not displayed as a federal subtype dropdown.','JS 44 Nature of Suit and court-local workflows replace generic subtypes.'),
  ('cases','claimant_name','participants + case_participants','partial','Copied to structured participant rows only when new cases are opened through the federal form.','Fixed two-party boxes do not fit criminal, appeal, matter or multi-party civil records.'),
  ('cases','defendant_name','participants + case_participants','partial','Copied to structured participant rows only when new cases are opened through the federal form.','Criminal defendants, civil defendants and subjects/targets are distinct roles.'),
  ('cases','judicial_number','cases.docket_number / originating_docket_number / legacy metadata','ambiguous','Preserved for historical records; new court docket number remains distinct from portal Case Number.','No legacy radicado-style value is reused as the Clerk’s Docket Number automatically.'),
  ('case_actions','action_type','docket_entries or workflow_events','partial','New court filings use docket_entries; internal DOJ activity uses workflow_events/filings scoped to Matter.','Internal DOJ activity is not a public court docket entry.'),
  ('proceedings','providence_number','orders / docket_entries / documents','partial','Existing records preserved; new federal terminology uses orders, filings and docket entries.','Generic providencia terminology is hidden from the reformed intake and case presentation.')
on conflict (legacy_table, legacy_field, new_model_target) do update set
  mapping_confidence = excluded.mapping_confidence,
  treatment = excluded.treatment,
  notes = excluded.notes;

update public.cases
   set legacy_colombian_metadata = legacy_colombian_metadata || jsonb_strip_nulls(jsonb_build_object(
         'authority_type', authority_type,
         'chamber', chamber,
         'process_type', process_type,
         'process_subtype', process_subtype,
         'claimant_name', claimant_name,
         'defendant_name', defendant_name,
         'judicial_number', judicial_number
       )),
       case_category = case
         when unaccent(lower(process_type)) like '%penal%' or lower(process_type) like '%criminal%' then 'Criminal'
         when unaccent(lower(process_type)) like '%apel%' or lower(process_type) like '%appeal%' then 'Appeal'
         when unaccent(lower(process_type)) like '%civil%' then 'Civil'
         else coalesce(case_category, 'Civil')
       end,
       case_caption = coalesce(case_caption, nullif(trim(claimant_name || ' v. ' || defendant_name), 'v.')),
       federal_access_level = case
         when confidentiality_level = 'Público' then 'Public'
         when confidentiality_level = 'Confidencial' then 'Sealed'
         else 'Restricted'
       end,
       sealed = case when confidentiality_level = 'Confidencial' then true else sealed end,
       public_visibility = case when confidentiality_level = 'Público' and not sealed and not grand_jury_restricted then public_visibility else false end
 where legacy_colombian_metadata = '{}'::jsonb
   and archived_at is null;

create or replace function public.is_federal_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_internal()
$$;

create or replace function public.validate_federal_case_model()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accepted text[];
begin
  if nullif(trim(coalesce(new.case_category, '')), '') is null then
    raise exception 'Case Category is required';
  end if;

  if new.docket_number is not null and new.court_id is null then
    raise exception 'A Docket Number may only be recorded after a federal court is selected';
  end if;

  if new.case_category = 'Appeal' and nullif(trim(coalesce(new.originating_case_number, new.originating_docket_number, new.originating_court_or_agency, '')), '') is null then
    raise exception 'Appeals require an originating case, docket number, court, or agency';
  end if;

  if new.case_category = 'Criminal' and new.public_visibility and coalesce(new.grand_jury_restricted, false) then
    raise exception 'Grand-jury restricted criminal records cannot be public';
  end if;

  if new.sealed or new.grand_jury_restricted or new.federal_access_level in ('Sealed','Grand-jury restricted','Internal DOJ only') then
    new.public_visibility := false;
    if new.confidentiality_level = 'Público' then
      new.confidentiality_level := 'Reservado';
    end if;
  end if;

  if new.court_id is not null then
    select accepted_case_categories into v_accepted from public.federal_courts where id = new.court_id and active;
    if v_accepted is null then
      raise exception 'Selected federal court is inactive or does not exist';
    end if;
    if not new.case_category = any(v_accepted) then
      raise exception 'Selected court does not accept the requested Case Category';
    end if;
  end if;

  if new.assigned_district_judge_id is not null and exists (
    select 1 from public.federal_courts c
    where c.id = new.court_id and c.court_system = 'United States Court of Appeals'
  ) then
    raise exception 'District Judge assignments do not apply to Courts of Appeals panels';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_federal_case_model_before_write on public.cases;
create trigger validate_federal_case_model_before_write
before insert or update on public.cases
for each row execute function public.validate_federal_case_model();

create or replace function public.validate_civil_case_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
begin
  select case_category into v_category from public.cases where id = new.case_id;
  if v_category is distinct from 'Civil' then
    raise exception 'Civil case details may only be attached to a Civil Case';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_civil_case_details_before_write on public.civil_case_details;
create trigger validate_civil_case_details_before_write
before insert or update on public.civil_case_details
for each row execute function public.validate_civil_case_details();

create or replace function public.validate_criminal_case_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
begin
  select case_category into v_category from public.cases where id = new.case_id;
  if v_category not in ('Criminal','Magistrate Judge proceeding') then
    raise exception 'Criminal details may only be attached to a Criminal or Magistrate Judge proceeding';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_criminal_case_details_before_write on public.criminal_case_details;
create trigger validate_criminal_case_details_before_write
before insert or update on public.criminal_case_details
for each row execute function public.validate_criminal_case_details();

create or replace function public.validate_appeal_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
  v_origin text;
begin
  select case_category, coalesce(originating_case_number, originating_docket_number, originating_court_or_agency)
    into v_category, v_origin
    from public.cases where id = new.case_id;
  if v_category <> 'Appeal' then
    raise exception 'Appeal details may only be attached to an Appeal';
  end if;
  if nullif(trim(coalesce(v_origin, '')), '') is null then
    raise exception 'Appeals require originating record information';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_appeal_details_before_write on public.appeal_details;
create trigger validate_appeal_details_before_write
before insert or update on public.appeal_details
for each row execute function public.validate_appeal_details();

create or replace function public.validate_case_participant_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
  v_scope text;
begin
  select case_category into v_category from public.cases where id = new.case_id;
  select role_scope into v_scope from public.participant_role_catalog where code = new.role_code and active;
  if v_scope is null then
    raise exception 'Participant role is inactive or unknown';
  end if;
  if v_category = 'Criminal' and v_scope = 'civil' then
    raise exception 'Civil party roles cannot be used in Criminal Cases';
  end if;
  if v_category = 'Civil' and v_scope = 'criminal' then
    raise exception 'Criminal participant roles cannot be used in Civil Cases';
  end if;
  if v_category = 'Appeal' and v_scope in ('matter','criminal') and new.role_code not in ('united_states','agency','interested_party') then
    raise exception 'Selected role is not valid for an Appeal';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_case_participant_role_before_write on public.case_participants;
create trigger validate_case_participant_role_before_write
before insert or update on public.case_participants
for each row execute function public.validate_case_participant_role();

create or replace function public.create_federal_case_from_matter(
  p_matter_id uuid,
  p_court_id uuid,
  p_case_category text,
  p_selected_participant_ids uuid[] default '{}',
  p_metadata jsonb default '{}'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matter public.matters%rowtype;
  v_case_id uuid;
  v_case_number text;
  v_judicial_number text;
begin
  if not public.is_federal_staff() then
    raise exception 'Institutional authentication required';
  end if;

  select * into v_matter from public.matters where id = p_matter_id and archived_at is null;
  if not found then
    raise exception 'Matter not found';
  end if;

  if coalesce(v_matter.grand_jury_secret, false) and coalesce((p_metadata->>'confidentiality_reviewed')::boolean, false) is not true then
    raise exception 'Grand-jury material requires confidentiality review before creating a court Case';
  end if;

  v_case_number := public.generate_case_number_for_date(p_case_category, now());
  v_judicial_number := public.generate_judicial_case_number('001');

  insert into public.cases (
    internal_number,
    judicial_number,
    case_number,
    title,
    authority_type,
    chamber,
    process_type,
    process_subtype,
    claimant_name,
    defendant_name,
    summary,
    claims,
    department,
    municipality,
    reception_method,
    confidentiality_level,
    status,
    public_visibility,
    filed_at,
    created_by,
    matter_id,
    record_context,
    court_id,
    case_category,
    case_caption,
    federal_access_level,
    sealed,
    grand_jury_restricted,
    legacy_colombian_metadata
  ) values (
    v_case_number,
    v_judicial_number,
    v_case_number,
    coalesce(nullif(v_matter.title, ''), 'Federal case from Matter'),
    'United States Federal Judiciary',
    'Federal court filing',
    p_case_category,
    coalesce(p_metadata->>'classification', 'Case opened from Matter'),
    coalesce(p_metadata->>'primary_party', 'United States'),
    coalesce(p_metadata->>'opposing_party', 'To be added'),
    coalesce(v_matter.summary, 'Case opened from DOJ Matter. Internal notes are not copied.'),
    coalesce(p_metadata->>'requested_relief', 'Court filing under review.'),
    coalesce(v_matter.jurisdiction, 'United States'),
    coalesce(v_matter.investigative_district, 'Federal District'),
    'Matter-to-Case conversion',
    case when coalesce(v_matter.access_level, 'Interno') = 'Público' and not coalesce(v_matter.grand_jury_secret, false) then 'Público' else 'Reservado' end,
    'Case opened by Clerk',
    false,
    now(),
    auth.uid(),
    p_matter_id,
    'case_from_matter',
    p_court_id,
    p_case_category,
    coalesce(p_metadata->>'case_caption', v_matter.title),
    case when coalesce(v_matter.grand_jury_secret, false) then 'Grand-jury restricted' else 'Internal DOJ only' end,
    coalesce((p_metadata->>'sealed')::boolean, false),
    coalesce(v_matter.grand_jury_secret, false),
    jsonb_build_object('source_matter_number', v_matter.matter_number, 'copied_from_matter', true)
  ) returning id into v_case_id;

  insert into public.matter_case_relationships(matter_id, case_id, relationship_type, copied_fields, confidentiality_reviewed, created_by)
  values (
    p_matter_id,
    v_case_id,
    'originating_matter',
    coalesce(p_metadata->'copied_fields', '[]'::jsonb),
    coalesce((p_metadata->>'confidentiality_reviewed')::boolean, false),
    auth.uid()
  );

  insert into public.workflow_events(case_id, matter_id, event_scope, event_code, title, description, new_status, metadata, created_by)
  values (v_case_id, p_matter_id, 'matter_to_case', 'case_opened_from_matter', 'Case opened from DOJ Matter', 'The Matter was preserved and linked to a new court Case. Confidential information was not automatically copied.', 'Case opened by Clerk', p_metadata, auth.uid());

  return v_case_id;
end;
$$;

revoke all on function public.create_federal_case_from_matter(uuid, uuid, text, uuid[], jsonb) from public, anon;
grant execute on function public.create_federal_case_from_matter(uuid, uuid, text, uuid[], jsonb) to authenticated, service_role;

drop view if exists public.public_case_lookup;
create view public.public_case_lookup with (security_barrier = true) as
select
  c.id,
  coalesce(c.case_number, c.internal_number) as case_number,
  c.internal_number,
  c.docket_number,
  c.judicial_number,
  c.docket_court,
  c.docket_district,
  c.docket_division,
  c.docket_assigned_at,
  c.filing_status,
  c.title,
  c.summary,
  coalesce(c.case_caption, c.title) as case_caption,
  fc.official_name as court_name,
  fc.abbreviation as court_abbreviation,
  c.case_category,
  c.status,
  c.filed_at,
  c.federal_access_level,
  d.name as institution_name
from public.cases c
left join public.dependencies d on d.id = c.dependency_id
left join public.federal_courts fc on fc.id = c.court_id
where c.public_visibility
  and c.confidentiality_level = 'Público'
  and c.federal_access_level = 'Public'
  and coalesce(c.sealed, false) = false
  and coalesce(c.grand_jury_restricted, false) = false
  and c.archived_at is null;

drop view if exists public.public_case_participants;
create view public.public_case_participants with (security_barrier = true) as
select
  cp.case_id,
  cp.role_code,
  pr.display_label_es as role_label,
  coalesce(p.display_name, p.legal_name) as display_name,
  cp.side
from public.case_participants cp
join public.participants p on p.id = cp.participant_id
join public.participant_role_catalog pr on pr.code = cp.role_code
join public.cases c on c.id = cp.case_id
where c.public_visibility
  and c.confidentiality_level = 'Público'
  and c.federal_access_level = 'Public'
  and coalesce(c.sealed, false) = false
  and coalesce(c.grand_jury_restricted, false) = false
  and coalesce(p.sealed, false) = false
  and coalesce(p.minor, false) = false
  and coalesce(p.pseudonym, false) = false
  and cp.active
  and p.archived_at is null;

grant select on public.public_case_lookup, public.public_case_participants to anon, authenticated;

drop trigger if exists federal_courts_updated on public.federal_courts;
create trigger federal_courts_updated before update on public.federal_courts for each row execute function public.set_updated_at();
drop trigger if exists court_divisions_updated on public.court_divisions;
create trigger court_divisions_updated before update on public.court_divisions for each row execute function public.set_updated_at();
drop trigger if exists judges_updated on public.judges;
create trigger judges_updated before update on public.judges for each row execute function public.set_updated_at();
drop trigger if exists case_type_catalog_updated on public.case_type_catalog;
create trigger case_type_catalog_updated before update on public.case_type_catalog for each row execute function public.set_updated_at();
drop trigger if exists nature_of_suit_catalog_updated on public.nature_of_suit_catalog;
create trigger nature_of_suit_catalog_updated before update on public.nature_of_suit_catalog for each row execute function public.set_updated_at();
drop trigger if exists matter_type_catalog_updated on public.matter_type_catalog;
create trigger matter_type_catalog_updated before update on public.matter_type_catalog for each row execute function public.set_updated_at();
drop trigger if exists participant_role_catalog_updated on public.participant_role_catalog;
create trigger participant_role_catalog_updated before update on public.participant_role_catalog for each row execute function public.set_updated_at();
drop trigger if exists document_type_catalog_updated on public.document_type_catalog;
create trigger document_type_catalog_updated before update on public.document_type_catalog for each row execute function public.set_updated_at();
drop trigger if exists workflow_status_catalog_updated on public.workflow_status_catalog;
create trigger workflow_status_catalog_updated before update on public.workflow_status_catalog for each row execute function public.set_updated_at();
drop trigger if exists participants_updated on public.participants;
create trigger participants_updated before update on public.participants for each row execute function public.set_updated_at();
drop trigger if exists civil_case_details_updated on public.civil_case_details;
create trigger civil_case_details_updated before update on public.civil_case_details for each row execute function public.set_updated_at();
drop trigger if exists criminal_case_details_updated on public.criminal_case_details;
create trigger criminal_case_details_updated before update on public.criminal_case_details for each row execute function public.set_updated_at();
drop trigger if exists appeal_details_updated on public.appeal_details;
create trigger appeal_details_updated before update on public.appeal_details for each row execute function public.set_updated_at();
drop trigger if exists docket_entries_updated on public.docket_entries;
create trigger docket_entries_updated before update on public.docket_entries for each row execute function public.set_updated_at();
drop trigger if exists filings_updated on public.filings;
create trigger filings_updated before update on public.filings for each row execute function public.set_updated_at();
drop trigger if exists motions_updated on public.motions;
create trigger motions_updated before update on public.motions for each row execute function public.set_updated_at();
drop trigger if exists orders_updated on public.orders;
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists deadlines_updated on public.deadlines;
create trigger deadlines_updated before update on public.deadlines for each row execute function public.set_updated_at();

drop trigger if exists audit_federal_courts on public.federal_courts;
create trigger audit_federal_courts after insert or update or delete on public.federal_courts for each row execute function public.audit_change();
drop trigger if exists audit_court_divisions on public.court_divisions;
create trigger audit_court_divisions after insert or update or delete on public.court_divisions for each row execute function public.audit_change();
drop trigger if exists audit_judges on public.judges;
create trigger audit_judges after insert or update or delete on public.judges for each row execute function public.audit_change();
drop trigger if exists audit_participants on public.participants;
create trigger audit_participants after insert or update or delete on public.participants for each row execute function public.audit_change();
drop trigger if exists audit_matter_participants on public.matter_participants;
create trigger audit_matter_participants after insert or update or delete on public.matter_participants for each row execute function public.audit_change();
drop trigger if exists audit_case_participants on public.case_participants;
create trigger audit_case_participants after insert or update or delete on public.case_participants for each row execute function public.audit_change();
drop trigger if exists audit_case_assignments on public.case_assignments;
create trigger audit_case_assignments after insert or update or delete on public.case_assignments for each row execute function public.audit_change();
drop trigger if exists audit_matter_assignments on public.matter_assignments;
create trigger audit_matter_assignments after insert or update or delete on public.matter_assignments for each row execute function public.audit_change();
drop trigger if exists audit_civil_case_details on public.civil_case_details;
create trigger audit_civil_case_details after insert or update or delete on public.civil_case_details for each row execute function public.audit_change();
drop trigger if exists audit_criminal_case_details on public.criminal_case_details;
create trigger audit_criminal_case_details after insert or update or delete on public.criminal_case_details for each row execute function public.audit_change();
drop trigger if exists audit_appeal_details on public.appeal_details;
create trigger audit_appeal_details after insert or update or delete on public.appeal_details for each row execute function public.audit_change();
drop trigger if exists audit_matter_case_relationships on public.matter_case_relationships;
create trigger audit_matter_case_relationships after insert or update or delete on public.matter_case_relationships for each row execute function public.audit_change();
drop trigger if exists audit_docket_entries on public.docket_entries;
create trigger audit_docket_entries after insert or update or delete on public.docket_entries for each row execute function public.audit_change();
drop trigger if exists audit_filings on public.filings;
create trigger audit_filings after insert or update or delete on public.filings for each row execute function public.audit_change();
drop trigger if exists audit_motions on public.motions;
create trigger audit_motions after insert or update or delete on public.motions for each row execute function public.audit_change();
drop trigger if exists audit_orders on public.orders;
create trigger audit_orders after insert or update or delete on public.orders for each row execute function public.audit_change();
drop trigger if exists audit_deadlines on public.deadlines;
create trigger audit_deadlines after insert or update or delete on public.deadlines for each row execute function public.audit_change();
drop trigger if exists audit_case_relationships on public.case_relationships;
create trigger audit_case_relationships after insert or update or delete on public.case_relationships for each row execute function public.audit_change();
drop trigger if exists audit_workflow_events on public.workflow_events;
create trigger audit_workflow_events after insert or update or delete on public.workflow_events for each row execute function public.audit_change();

alter table public.federal_courts enable row level security;
alter table public.court_divisions enable row level security;
alter table public.judges enable row level security;
alter table public.case_type_catalog enable row level security;
alter table public.nature_of_suit_catalog enable row level security;
alter table public.matter_type_catalog enable row level security;
alter table public.participant_role_catalog enable row level security;
alter table public.document_type_catalog enable row level security;
alter table public.workflow_status_catalog enable row level security;
alter table public.federal_model_migration_report enable row level security;
alter table public.participants enable row level security;
alter table public.matter_participants enable row level security;
alter table public.case_participants enable row level security;
alter table public.case_assignments enable row level security;
alter table public.matter_assignments enable row level security;
alter table public.civil_case_details enable row level security;
alter table public.criminal_case_details enable row level security;
alter table public.appeal_details enable row level security;
alter table public.matter_case_relationships enable row level security;
alter table public.docket_entries enable row level security;
alter table public.filings enable row level security;
alter table public.motions enable row level security;
alter table public.orders enable row level security;
alter table public.deadlines enable row level security;
alter table public.case_relationships enable row level security;
alter table public.workflow_events enable row level security;

drop policy if exists federal_courts_read on public.federal_courts;
create policy federal_courts_read on public.federal_courts for select to anon, authenticated using (active or public.is_super_admin());
drop policy if exists federal_courts_owner_write on public.federal_courts;
create policy federal_courts_owner_write on public.federal_courts for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists court_divisions_read on public.court_divisions;
create policy court_divisions_read on public.court_divisions for select to anon, authenticated using (active or public.is_super_admin());
drop policy if exists court_divisions_owner_write on public.court_divisions;
create policy court_divisions_owner_write on public.court_divisions for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists judges_staff_read on public.judges;
create policy judges_staff_read on public.judges for select to authenticated using (public.is_federal_staff());
drop policy if exists judges_owner_write on public.judges;
create policy judges_owner_write on public.judges for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists case_type_catalog_read on public.case_type_catalog;
create policy case_type_catalog_read on public.case_type_catalog for select to anon, authenticated using (active or public.is_super_admin());
drop policy if exists case_type_catalog_owner_write on public.case_type_catalog;
create policy case_type_catalog_owner_write on public.case_type_catalog for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists nature_of_suit_catalog_read on public.nature_of_suit_catalog;
create policy nature_of_suit_catalog_read on public.nature_of_suit_catalog for select to anon, authenticated using (active or public.is_super_admin());
drop policy if exists nature_of_suit_catalog_owner_write on public.nature_of_suit_catalog;
create policy nature_of_suit_catalog_owner_write on public.nature_of_suit_catalog for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists matter_type_catalog_read on public.matter_type_catalog;
create policy matter_type_catalog_read on public.matter_type_catalog for select to authenticated using (active or public.is_super_admin());
drop policy if exists matter_type_catalog_owner_write on public.matter_type_catalog;
create policy matter_type_catalog_owner_write on public.matter_type_catalog for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists participant_role_catalog_read on public.participant_role_catalog;
create policy participant_role_catalog_read on public.participant_role_catalog for select to authenticated using (active or public.is_super_admin());
drop policy if exists participant_role_catalog_owner_write on public.participant_role_catalog;
create policy participant_role_catalog_owner_write on public.participant_role_catalog for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists document_type_catalog_staff_read on public.document_type_catalog;
create policy document_type_catalog_staff_read on public.document_type_catalog for select to authenticated using (active or public.is_super_admin());
drop policy if exists document_type_catalog_owner_write on public.document_type_catalog;
create policy document_type_catalog_owner_write on public.document_type_catalog for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists workflow_status_catalog_staff_read on public.workflow_status_catalog;
create policy workflow_status_catalog_staff_read on public.workflow_status_catalog for select to authenticated using (active or public.is_super_admin());
drop policy if exists workflow_status_catalog_owner_write on public.workflow_status_catalog;
create policy workflow_status_catalog_owner_write on public.workflow_status_catalog for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists federal_model_migration_report_owner_read on public.federal_model_migration_report;
create policy federal_model_migration_report_owner_read on public.federal_model_migration_report for select to authenticated using (public.is_super_admin());

drop policy if exists participants_staff_access on public.participants;
create policy participants_staff_access on public.participants for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists matter_participants_staff_access on public.matter_participants;
create policy matter_participants_staff_access on public.matter_participants for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists case_participants_staff_access on public.case_participants;
create policy case_participants_staff_access on public.case_participants for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists case_assignments_staff_access on public.case_assignments;
create policy case_assignments_staff_access on public.case_assignments for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists matter_assignments_staff_access on public.matter_assignments;
create policy matter_assignments_staff_access on public.matter_assignments for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists civil_case_details_staff_access on public.civil_case_details;
create policy civil_case_details_staff_access on public.civil_case_details for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists criminal_case_details_staff_access on public.criminal_case_details;
create policy criminal_case_details_staff_access on public.criminal_case_details for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists appeal_details_staff_access on public.appeal_details;
create policy appeal_details_staff_access on public.appeal_details for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists matter_case_relationships_staff_access on public.matter_case_relationships;
create policy matter_case_relationships_staff_access on public.matter_case_relationships for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists docket_entries_staff_access on public.docket_entries;
create policy docket_entries_staff_access on public.docket_entries for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists filings_staff_access on public.filings;
create policy filings_staff_access on public.filings for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists motions_staff_access on public.motions;
create policy motions_staff_access on public.motions for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists orders_staff_access on public.orders;
create policy orders_staff_access on public.orders for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists deadlines_staff_access on public.deadlines;
create policy deadlines_staff_access on public.deadlines for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists case_relationships_staff_access on public.case_relationships;
create policy case_relationships_staff_access on public.case_relationships for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());
drop policy if exists workflow_events_staff_access on public.workflow_events;
create policy workflow_events_staff_access on public.workflow_events for all to authenticated using (public.is_federal_staff()) with check (public.is_federal_staff());

drop policy if exists cases_federal_staff_read on public.cases;
create policy cases_federal_staff_read on public.cases
for select to authenticated
using (public.is_federal_staff());

drop policy if exists cases_federal_staff_create on public.cases;
create policy cases_federal_staff_create on public.cases
for insert to authenticated
with check (public.is_federal_staff() and created_by = auth.uid());

drop policy if exists cases_federal_staff_update on public.cases;
create policy cases_federal_staff_update on public.cases
for update to authenticated
using (public.is_federal_staff() and archived_at is null)
with check (public.is_federal_staff());

do $$
declare
  tbl regclass;
begin
  foreach tbl in array array[
    'public.federal_courts'::regclass,
    'public.court_divisions'::regclass,
    'public.judges'::regclass,
    'public.matters'::regclass,
    'public.participants'::regclass,
    'public.matter_participants'::regclass,
    'public.case_participants'::regclass,
    'public.case_assignments'::regclass,
    'public.matter_assignments'::regclass,
    'public.civil_case_details'::regclass,
    'public.criminal_case_details'::regclass,
    'public.appeal_details'::regclass,
    'public.matter_case_relationships'::regclass,
    'public.docket_entries'::regclass,
    'public.filings'::regclass,
    'public.motions'::regclass,
    'public.orders'::regclass,
    'public.hearings'::regclass,
    'public.deadlines'::regclass,
    'public.workflow_events'::regclass,
    'public.audit_logs'::regclass
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %s', tbl);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
