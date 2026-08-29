set check_function_bodies = off;

do $$
begin
  alter table public.grand_juries drop constraint if exists grand_juries_active_grand_jurors_check;
  update public.grand_juries
     set active_grand_jurors = least(15, greatest(5, coalesce(active_grand_jurors, 9))),
         updated_at = now()
   where active_grand_jurors is null or active_grand_jurors not between 5 and 15;
  alter table public.grand_juries add constraint grand_juries_active_grand_jurors_check check (active_grand_jurors between 5 and 15);
exception when undefined_table then null;
end $$;

alter table if exists public.grand_juries
  add column if not exists panel_name text,
  add column if not exists proceeding_number text,
  add column if not exists constitution_date date,
  add column if not exists discharge_date date,
  add column if not exists internal_description text,
  add column if not exists supervisor_judge_id uuid references public.profiles(id),
  add column if not exists responsible_clerk_id uuid references public.profiles(id),
  add column if not exists selected_panel_size integer not null default 9,
  add column if not exists foreperson_member_id uuid,
  add column if not exists deputy_foreperson_member_id uuid,
  add column if not exists foreperson_selected_by uuid references public.profiles(id),
  add column if not exists foreperson_selected_at timestamptz,
  add column if not exists foreperson_selection_method text,
  add column if not exists foreperson_order_reference text,
  add column if not exists jury_instructions text;

alter table if exists public.trial_juries
  add column if not exists panel_name text,
  add column if not exists proceeding_number text,
  add column if not exists district text,
  add column if not exists constitution_date date,
  add column if not exists expiration_date date,
  add column if not exists internal_description text,
  add column if not exists judge_id uuid references public.profiles(id),
  add column if not exists responsible_clerk_id uuid references public.profiles(id),
  add column if not exists selected_panel_size integer not null default 9,
  add column if not exists foreperson_panel_id uuid,
  add column if not exists foreperson_selected_by uuid references public.profiles(id),
  add column if not exists foreperson_selected_at timestamptz,
  add column if not exists foreperson_selection_method text,
  add column if not exists foreperson_order_reference text,
  add column if not exists final_jury_instructions text;

alter table if exists public.grand_jury_members
  add column if not exists juror_user_id uuid references public.profiles(id),
  add column if not exists member_type text not null default 'juror',
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles(id),
  add column if not exists removal_reason text,
  add column if not exists replacement_for_member_id uuid references public.grand_jury_members(id),
  add column if not exists attendance_status text not null default 'present';

alter table if exists public.trial_jury_panels
  add column if not exists juror_user_id uuid references public.profiles(id),
  add column if not exists member_type text not null default 'juror',
  add column if not exists display_name text,
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles(id),
  add column if not exists removal_reason text,
  add column if not exists replacement_for_panel_id uuid references public.trial_jury_panels(id),
  add column if not exists attendance_status text not null default 'present';

do $$
begin
  update public.grand_juries
     set selected_panel_size = least(15, greatest(5, coalesce(selected_panel_size, active_grand_jurors, 9))),
         updated_at = now()
   where selected_panel_size is null or selected_panel_size not between 5 and 15;
  update public.trial_juries
     set selected_panel_size = least(15, greatest(5, coalesce(selected_panel_size, required_jury_size, 9))),
         required_jury_size = case when required_jury_size is null then null else least(15, greatest(5, required_jury_size)) end,
         updated_at = now()
   where selected_panel_size is null or selected_panel_size not between 5 and 15 or required_jury_size not between 5 and 15;
  alter table public.grand_juries drop constraint if exists grand_juries_selected_panel_size_check;
  alter table public.grand_juries add constraint grand_juries_selected_panel_size_check check (selected_panel_size between 5 and 15);
  alter table public.trial_juries drop constraint if exists trial_juries_selected_panel_size_check;
  alter table public.trial_juries add constraint trial_juries_selected_panel_size_check check (selected_panel_size between 5 and 15);
  alter table public.trial_juries drop constraint if exists trial_juries_required_jury_size_check;
  alter table public.trial_juries add constraint trial_juries_required_jury_size_check check (required_jury_size is null or required_jury_size between 5 and 15);
exception when undefined_table then null;
end $$;

create unique index if not exists grand_jury_members_unique_user_active
  on public.grand_jury_members(grand_jury_id, juror_user_id)
  where juror_user_id is not null and removed_at is null;

create unique index if not exists trial_jury_panels_unique_user_active
  on public.trial_jury_panels(trial_jury_id, juror_user_id)
  where juror_user_id is not null and removed_at is null;

create table if not exists public.grand_jury_vote_records (
  id uuid primary key default gen_random_uuid(),
  voting_round_id uuid not null references public.grand_jury_voting_rounds(id) on delete cascade,
  vote_record_number text not null unique default ('GJ-VOTE-' || extract(year from now())::int || '-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  snapshot jsonb not null,
  pdf_sha256 text,
  certified_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id),
  download_count integer not null default 0,
  last_downloaded_at timestamptz,
  created_at timestamptz not null default now(),
  unique(voting_round_id)
);

alter table public.grand_jury_vote_records enable row level security;

drop policy if exists grand_jury_vote_records_staff_access on public.grand_jury_vote_records;
create policy grand_jury_vote_records_staff_access on public.grand_jury_vote_records
for all to authenticated
using (public.has_effective_permission('juries','view') or public.is_federal_staff())
with check (public.has_effective_permission('juries','edit') or public.is_federal_staff());

create or replace function public.compact_grand_jury_threshold(p_panel_size integer)
returns integer
language sql
immutable
as $$
  select ceil(greatest(5, least(15, coalesce(p_panel_size, 9))) * 2.0 / 3.0)::integer
$$;

create or replace function public.is_compact_jury_status_eligible(p_status text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_status, 'present') in ('present','active','Present','Active','impaneled','Impaneled')
$$;

create or replace function public.create_grand_jury_for_matter(p_matter_id uuid, p_court_id uuid, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_court public.federal_courts%rowtype;
  v_id uuid;
  v_number text;
  v_size integer := coalesce(nullif(p_payload->>'selected_panel_size','')::integer, nullif(p_payload->>'active_grand_jurors','')::integer, 9);
  v_name text := nullif(trim(coalesce(p_payload->>'panel_name', p_payload->>'name')), '');
begin
  perform public.assert_doj_relationship_permission('juries','create');
  select * into v_court from public.federal_courts where id = p_court_id and active;
  if not found or v_court.court_level <> 'District Court' then raise exception 'Grand Jury must be created in an active District Court'; end if;
  if v_size < 5 or v_size > 15 then raise exception 'Compact Grand Jury size must be between 5 and 15'; end if;
  insert into public.grand_juries(
    primary_matter_id, court_id, district, jury_division, supervising_judge, active_grand_jurors,
    term_start, term_end, discharge_date, expected_schedule, status, access_classification, notes, created_by,
    panel_name, proceeding_number, constitution_date, internal_description, supervisor_judge_id,
    responsible_clerk_id, selected_panel_size, jury_instructions
  )
  values (
    p_matter_id, p_court_id, coalesce(nullif(p_payload->>'district',''), v_court.district), p_payload->>'jury_division',
    p_payload->>'supervising_judge', v_size, nullif(p_payload->>'constitution_date','')::date,
    nullif(coalesce(p_payload->>'expiration_date', p_payload->>'term_end'),'')::date, nullif(p_payload->>'discharge_date','')::date,
    p_payload->>'expected_schedule', coalesce(nullif(p_payload->>'status',''),'Draft'), 'SEALED - GRAND JURY MATERIAL',
    p_payload->>'notes', auth.uid(), coalesce(v_name, 'Grand Jury ' || to_char(now(), 'YY-MM')),
    nullif(p_payload->>'proceeding_number',''), nullif(p_payload->>'constitution_date','')::date,
    p_payload->>'internal_description', nullif(p_payload->>'supervisor_judge_id','')::uuid,
    nullif(p_payload->>'responsible_clerk_id','')::uuid, v_size, p_payload->>'jury_instructions'
  )
  returning id, grand_jury_number into v_id, v_number;
  insert into public.grand_jury_matters(grand_jury_id, matter_id, created_by) values (v_id, p_matter_id, auth.uid()) on conflict do nothing;
  insert into public.workflow_events(matter_id, event_scope, event_code, title, description, new_status, metadata, created_by)
  values (p_matter_id, 'grand_jury', 'grand_jury_created', 'Grand Jury created for Matter', 'Compact Grand Jury panel created; individual ballots remain sealed.', coalesce(nullif(p_payload->>'status',''),'Draft'), jsonb_build_object('grand_jury_id', v_id, 'grand_jury_number', v_number, 'selected_panel_size', v_size), auth.uid());
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'grand_jury_created', 'grand_juries', v_id, 'Compact Grand Jury created for DOJ Matter.', jsonb_build_object('matter_id', p_matter_id, 'court_id', p_court_id, 'selected_panel_size', v_size));
  return jsonb_build_object('ok', true, 'grand_jury_id', v_id, 'grand_jury_number', v_number);
end $$;

create or replace function public.create_trial_jury_for_case(p_case_id uuid, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_case public.cases%rowtype;
  v_court public.federal_courts%rowtype;
  v_id uuid;
  v_number text;
  v_size integer := coalesce(nullif(p_payload->>'selected_panel_size','')::integer, nullif(p_payload->>'required_jury_size','')::integer, 9);
  v_name text := nullif(trim(coalesce(p_payload->>'panel_name', p_payload->>'name')), '');
begin
  perform public.assert_doj_relationship_permission('juries','create');
  select * into v_case from public.cases where id = p_case_id and archived_at is null;
  if not found then raise exception 'Federal Case not found'; end if;
  if v_case.case_category not in ('Criminal','Civil') then raise exception 'Trial Jury is available only for Criminal and Civil Cases'; end if;
  select * into v_court from public.federal_courts where id = v_case.court_id and active;
  if not found or v_court.court_level <> 'District Court' then raise exception 'Trial Jury requires an active District Court Case'; end if;
  if exists(select 1 from public.trial_juries where case_id = p_case_id and status not in ('Discharged','Cancelled')) then raise exception 'An active Trial Jury already exists for this Case'; end if;
  if v_size < 5 or v_size > 15 then raise exception 'Compact Trial Jury size must be between 5 and 15'; end if;
  insert into public.trial_juries(
    case_id, court_id, judge, jury_selection_date, trial_start_date, courtroom, jury_type,
    required_jury_size, alternates_count, prospective_panel_size, anonymous_jury, special_protections,
    status, created_by, panel_name, proceeding_number, district, constitution_date, expiration_date,
    internal_description, judge_id, responsible_clerk_id, selected_panel_size, final_jury_instructions
  )
  values (
    p_case_id, v_case.court_id, p_payload->>'judge', nullif(p_payload->>'constitution_date','')::date,
    nullif(p_payload->>'trial_start_date','')::date, p_payload->>'courtroom',
    coalesce(nullif(p_payload->>'jury_type',''), case when v_case.case_category = 'Civil' then 'Civil Petit Jury' else 'Criminal Petit Jury' end),
    v_size, coalesce(nullif(p_payload->>'alternates_count','')::integer,0), nullif(p_payload->>'prospective_panel_size','')::integer,
    coalesce(nullif(p_payload->>'anonymous_jury','')::boolean,false), p_payload->>'special_protections',
    coalesce(nullif(p_payload->>'status',''),'Draft'), auth.uid(), coalesce(v_name, 'Trial Jury - ' || coalesce(v_case.case_caption, v_case.title)),
    nullif(p_payload->>'proceeding_number',''), coalesce(nullif(p_payload->>'district',''), v_court.district),
    nullif(p_payload->>'constitution_date','')::date, nullif(p_payload->>'expiration_date','')::date,
    p_payload->>'internal_description', nullif(p_payload->>'judge_id','')::uuid, nullif(p_payload->>'responsible_clerk_id','')::uuid,
    v_size, p_payload->>'final_jury_instructions'
  )
  returning id, trial_jury_number into v_id, v_number;
  insert into public.workflow_events(case_id, event_scope, event_code, title, description, new_status, metadata, created_by)
  values (p_case_id, 'trial_jury', 'trial_jury_created', 'Trial Jury created for Federal Case', 'Compact Trial Jury workflow created with private juror voting.', coalesce(nullif(p_payload->>'status',''),'Draft'), jsonb_build_object('trial_jury_id', v_id, 'trial_jury_number', v_number, 'selected_panel_size', v_size), auth.uid());
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'trial_jury_created', 'trial_juries', v_id, 'Compact Trial Jury created for Federal Case.', jsonb_build_object('case_id', p_case_id, 'selected_panel_size', v_size));
  return jsonb_build_object('ok', true, 'trial_jury_id', v_id, 'trial_jury_number', v_number);
end $$;

create or replace function public.add_grand_jury_member(p_grand_jury_id uuid, p_juror_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_votes integer; v_profile public.profiles%rowtype;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  select count(*) into v_votes from public.grand_jury_voting_rounds where grand_jury_id = p_grand_jury_id;
  if v_votes > 0 then raise exception 'Jury members cannot be changed after voting has opened'; end if;
  select * into v_profile from public.profiles where id = p_juror_user_id and is_active;
  if not found then raise exception 'Active juror account not found'; end if;
  if v_profile.role::text <> 'GRAND_JUROR' then raise exception 'Grand Jury member must use role GRAND_JUROR'; end if;
  insert into public.grand_jury_members(
    grand_jury_id, juror_user_id, juror_participant_number, display_name, seat_sequence, member_type,
    status, attendance_status, date_sworn, secrecy_acknowledgment, created_by
  )
  values (
    p_grand_jury_id, p_juror_user_id, coalesce(nullif(p_payload->>'juror_participant_number',''), 'GJ-' || upper(substr(gen_random_uuid()::text,1,6))),
    coalesce(nullif(p_payload->>'display_name',''), v_profile.full_name), nullif(p_payload->>'seat_sequence','')::integer,
    coalesce(nullif(p_payload->>'member_type',''), 'juror'), coalesce(nullif(p_payload->>'status',''), 'active'),
    coalesce(nullif(p_payload->>'attendance_status',''), 'present'), nullif(p_payload->>'date_sworn','')::date,
    coalesce(nullif(p_payload->>'secrecy_acknowledgment','')::boolean, false), auth.uid()
  ) returning id into v_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'grand_jury_member_added', 'grand_jury_members', v_id, 'Grand Jury member account assigned.', jsonb_build_object('grand_jury_id', p_grand_jury_id, 'juror_user_id', p_juror_user_id));
  return jsonb_build_object('ok', true, 'member_id', v_id);
end $$;

create or replace function public.remove_grand_jury_member(p_member_id uuid, p_status text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_gj uuid; v_votes integer;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  select grand_jury_id into v_gj from public.grand_jury_members where id = p_member_id;
  if v_gj is null then raise exception 'Grand Jury member not found'; end if;
  select count(*) into v_votes from public.grand_jury_voting_rounds where grand_jury_id = v_gj and status = 'Open';
  if v_votes > 0 then raise exception 'Cannot remove a juror during an open voting round'; end if;
  update public.grand_jury_members
     set status = coalesce(nullif(p_status,''), 'discharged'), attendance_status = coalesce(nullif(p_status,''), 'discharged'),
         removed_at = now(), removed_by = auth.uid(), removal_reason = p_reason, date_discharged = current_date
   where id = p_member_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'grand_jury_member_removed', 'grand_jury_members', p_member_id, 'Grand Jury member removed without deleting history.', jsonb_build_object('reason', p_reason, 'status', p_status));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.add_trial_jury_member(p_trial_jury_id uuid, p_juror_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_votes integer; v_profile public.profiles%rowtype;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  select count(*) into v_votes from public.trial_jury_voting_rounds where trial_jury_id = p_trial_jury_id;
  if v_votes > 0 then raise exception 'Trial Jury members cannot be changed after voting has opened'; end if;
  select * into v_profile from public.profiles where id = p_juror_user_id and is_active;
  if not found then raise exception 'Active juror account not found'; end if;
  if v_profile.role::text <> 'TRIAL_JUROR' then raise exception 'Trial Jury member must use role TRIAL_JUROR'; end if;
  insert into public.trial_jury_panels(
    trial_jury_id, juror_user_id, juror_participant_number, display_name, panel_sequence, member_type,
    qualification_status, summons_status, reporting_status, voir_dire_status, final_seat, alternate_order,
    attendance_status, created_by
  )
  values (
    p_trial_jury_id, p_juror_user_id, coalesce(nullif(p_payload->>'juror_participant_number',''), 'TJ-' || upper(substr(gen_random_uuid()::text,1,6))),
    coalesce(nullif(p_payload->>'display_name',''), v_profile.full_name), coalesce(nullif(p_payload->>'panel_sequence','')::integer, (select coalesce(max(panel_sequence),0)+1 from public.trial_jury_panels where trial_jury_id = p_trial_jury_id)),
    coalesce(nullif(p_payload->>'member_type',''), 'juror'), coalesce(nullif(p_payload->>'qualification_status',''), 'Qualified'),
    coalesce(nullif(p_payload->>'summons_status',''), 'Served'), coalesce(nullif(p_payload->>'reporting_status',''), 'Present'),
    coalesce(nullif(p_payload->>'voir_dire_status',''), 'Selected'), nullif(p_payload->>'final_seat','')::integer,
    nullif(p_payload->>'alternate_order','')::integer, coalesce(nullif(p_payload->>'attendance_status',''), 'present'), auth.uid()
  ) returning id into v_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'trial_jury_member_added', 'trial_jury_panels', v_id, 'Trial Jury member account assigned.', jsonb_build_object('trial_jury_id', p_trial_jury_id, 'juror_user_id', p_juror_user_id));
  return jsonb_build_object('ok', true, 'panel_member_id', v_id);
end $$;

create or replace function public.remove_trial_jury_member(p_panel_id uuid, p_status text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tj uuid; v_votes integer;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  select trial_jury_id into v_tj from public.trial_jury_panels where id = p_panel_id;
  if v_tj is null then raise exception 'Trial Jury member not found'; end if;
  select count(*) into v_votes from public.trial_jury_voting_rounds where trial_jury_id = v_tj and status = 'Open';
  if v_votes > 0 then raise exception 'Cannot remove a juror during an open voting round'; end if;
  update public.trial_jury_panels
     set qualification_status = coalesce(nullif(p_status,''), 'Discharged'), attendance_status = coalesce(nullif(p_status,''), 'discharged'),
         removed_at = now(), removed_by = auth.uid(), removal_reason = p_reason
   where id = p_panel_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'trial_jury_member_removed', 'trial_jury_panels', p_panel_id, 'Trial Jury member removed without deleting history.', jsonb_build_object('reason', p_reason, 'status', p_status));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.designate_grand_jury_foreperson(p_grand_jury_id uuid, p_member_id uuid, p_deputy_member_id uuid default null, p_order_reference text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor_role text; v_is_judicial boolean;
begin
  select role::text into v_actor_role from public.profiles where id = auth.uid() and is_active;
  v_is_judicial := v_actor_role in ('JUDGE','JUEZ','CLERK','SECRETARIO_DESPACHO','SECRETARIO_GENERAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','OWNER','SUPER_ADMIN');
  if not v_is_judicial then raise exception 'Grand Jury foreperson must be designated by an authorized judicial officer or Clerk'; end if;
  if not exists(select 1 from public.grand_jury_members where id = p_member_id and grand_jury_id = p_grand_jury_id and member_type = 'juror' and removed_at is null and public.is_compact_jury_status_eligible(status)) then raise exception 'Foreperson must be an active seated Grand Jury member'; end if;
  if p_deputy_member_id is not null and not exists(select 1 from public.grand_jury_members where id = p_deputy_member_id and grand_jury_id = p_grand_jury_id and member_type = 'juror' and removed_at is null and public.is_compact_jury_status_eligible(status)) then raise exception 'Deputy foreperson must be an active seated Grand Jury member'; end if;
  update public.grand_jury_members set is_foreperson = (id = p_member_id), is_deputy_foreperson = (p_deputy_member_id is not null and id = p_deputy_member_id) where grand_jury_id = p_grand_jury_id;
  update public.grand_juries set foreperson_member_id = p_member_id, deputy_foreperson_member_id = p_deputy_member_id, foreperson_selected_by = auth.uid(), foreperson_selected_at = now(), foreperson_selection_method = 'Appointed by court order', foreperson_order_reference = p_order_reference, foreperson = (select display_name from public.grand_jury_members where id = p_member_id), deputy_foreperson = (select display_name from public.grand_jury_members where id = p_deputy_member_id), updated_at = now() where id = p_grand_jury_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'grand_jury_foreperson_designated', 'grand_juries', p_grand_jury_id, 'Grand Jury foreperson/deputy designated by authorized court-side actor.', jsonb_build_object('member_id', p_member_id, 'deputy_member_id', p_deputy_member_id, 'order_reference', p_order_reference));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.record_trial_jury_foreperson_selection(p_trial_jury_id uuid, p_panel_id uuid, p_method text default 'Selected by the jury')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor_role text;
begin
  select role::text into v_actor_role from public.profiles where id = auth.uid() and is_active;
  if v_actor_role in ('FISCAL','DOJ_ATTORNEY','ATTORNEY_GENERAL','DEPUTY_ATTORNEY_GENERAL') then raise exception 'Prosecutors cannot appoint a Trial Jury foreperson'; end if;
  if not (public.has_effective_permission('juries','edit') or exists(select 1 from public.trial_jury_panels where id = p_panel_id and trial_jury_id = p_trial_jury_id and juror_user_id = auth.uid())) then raise exception 'Not authorized to record Trial Jury foreperson'; end if;
  if not exists(select 1 from public.trial_jury_panels where id = p_panel_id and trial_jury_id = p_trial_jury_id and member_type = 'juror' and removed_at is null and public.is_compact_jury_status_eligible(attendance_status)) then raise exception 'Foreperson must be an active deliberating Trial Jury member'; end if;
  update public.trial_juries set foreperson_panel_id = p_panel_id, foreperson_selected_by = auth.uid(), foreperson_selected_at = now(), foreperson_selection_method = 'Selected by the jury', updated_at = now() where id = p_trial_jury_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'trial_jury_foreperson_selected', 'trial_juries', p_trial_jury_id, 'Trial Jury foreperson recorded as selected by the jury; no individual selection votes exposed.', jsonb_build_object('panel_id', p_panel_id, 'method', coalesce(nullif(p_method,''), 'Selected by the jury')));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.open_grand_jury_vote_round(p_grand_jury_id uuid, p_title text default 'Grand Jury vote')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_size integer; v_ready integer; v_threshold integer; v_foreperson uuid;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  select selected_panel_size, foreperson_member_id into v_size, v_foreperson from public.grand_juries where id = p_grand_jury_id;
  if v_size is null then raise exception 'Grand Jury not found'; end if;
  if v_size < 5 or v_size > 15 then raise exception 'Compact Grand Jury size must be between 5 and 15'; end if;
  if v_foreperson is null then raise exception 'Grand Jury foreperson must be designated before voting'; end if;
  select count(*) into v_ready from public.grand_jury_members where grand_jury_id = p_grand_jury_id and member_type = 'juror' and removed_at is null and public.is_compact_jury_status_eligible(status) and public.is_compact_jury_status_eligible(attendance_status);
  if v_ready < v_size then raise exception 'Grand Jury does not have the selected number of present eligible jurors'; end if;
  v_threshold := public.compact_grand_jury_threshold(v_size);
  insert into public.grand_jury_voting_rounds(grand_jury_id, title, opened_by, metadata)
  values (p_grand_jury_id, coalesce(nullif(p_title,''),'Grand Jury vote'), auth.uid(), jsonb_build_object('selected_panel_size', v_size, 'eligible_jurors', v_ready, 'true_bill_threshold', v_threshold))
  returning id into v_id;
  update public.grand_juries set status = 'Voting', updated_at = now() where id = p_grand_jury_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'grand_jury_vote_opened', 'grand_jury_voting_rounds', v_id, 'Grand Jury voting round opened. No vote tally is exposed while open.', jsonb_build_object('threshold', v_threshold));
  return jsonb_build_object('ok', true, 'voting_round_id', v_id, 'threshold', v_threshold);
end $$;

create or replace function public.open_trial_jury_vote_round(p_trial_jury_id uuid, p_title text default 'Trial Jury vote')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_size integer; v_ready integer; v_foreperson uuid;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  select selected_panel_size, foreperson_panel_id into v_size, v_foreperson from public.trial_juries where id = p_trial_jury_id;
  if v_size is null then raise exception 'Trial Jury not found'; end if;
  if v_size < 5 or v_size > 15 then raise exception 'Compact Trial Jury size must be between 5 and 15'; end if;
  if v_foreperson is null then raise exception 'Trial Jury foreperson must be recorded as selected by the jury before voting'; end if;
  select count(*) into v_ready from public.trial_jury_panels where trial_jury_id = p_trial_jury_id and member_type = 'juror' and removed_at is null and public.is_compact_jury_status_eligible(attendance_status);
  if v_ready < v_size then raise exception 'Trial Jury does not have the selected number of present deliberating jurors'; end if;
  insert into public.trial_jury_voting_rounds(trial_jury_id, title, opened_by, metadata)
  values (p_trial_jury_id, coalesce(nullif(p_title,''),'Trial Jury vote'), auth.uid(), jsonb_build_object('selected_panel_size', v_size, 'eligible_jurors', v_ready, 'unanimity_required', true))
  returning id into v_id;
  update public.trial_juries set deliberation_status = 'Deliberating', status = 'Voting', updated_at = now() where id = p_trial_jury_id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description)
  values (auth.uid(), 'trial_jury_vote_opened', 'trial_jury_voting_rounds', v_id, 'Trial Jury voting round opened. No vote tally is exposed while open.');
  return jsonb_build_object('ok', true, 'voting_round_id', v_id);
end $$;

create or replace function public.submit_grand_jury_ballot(p_round_id uuid, p_count_id uuid, p_member_id uuid, p_ballot_value text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_status text; v_member public.grand_jury_members%rowtype; v_count_gj uuid; v_round_gj uuid; v_role text;
begin
  select status, grand_jury_id into v_status, v_round_gj from public.grand_jury_voting_rounds where id = p_round_id;
  if v_status is distinct from 'Open' then raise exception 'Voting round is closed'; end if;
  select * into v_member from public.grand_jury_members where id = p_member_id;
  if not found or v_member.juror_user_id is distinct from auth.uid() then raise exception 'Not authorized for this Grand Jury ballot'; end if;
  select role::text into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role <> 'GRAND_JUROR' then raise exception 'Grand Jury ballots require GRAND_JUROR role'; end if;
  select grand_jury_id into v_count_gj from public.grand_jury_counts where id = p_count_id;
  if v_count_gj is distinct from v_round_gj or v_member.grand_jury_id is distinct from v_round_gj then raise exception 'Ballot target does not match proceeding'; end if;
  if v_member.member_type <> 'juror' or v_member.removed_at is not null or not public.is_compact_jury_status_eligible(v_member.status) or not public.is_compact_jury_status_eligible(v_member.attendance_status) then raise exception 'Juror is not eligible to vote'; end if;
  if p_ballot_value not in ('True Bill','No Bill','Recused') then raise exception 'Invalid Grand Jury ballot value'; end if;
  if p_ballot_value = 'Recused' and coalesce(v_member.conflict_status,'') not in ('Recused','recused','Authorized recusal') then raise exception 'Recused ballot requires an authorized recusal status'; end if;
  insert into public.grand_jury_secret_ballots(voting_round_id, count_id, juror_member_id, ballot_value, sealed_integrity_hash)
  values (p_round_id, p_count_id, p_member_id, p_ballot_value, encode(extensions.digest(convert_to(p_round_id::text || p_count_id::text || p_member_id::text || p_ballot_value || now()::text, 'UTF8'), 'sha256'), 'hex'))
  on conflict (voting_round_id, count_id, juror_member_id) do update
     set ballot_value = excluded.ballot_value, updated_at = now(), sealed_integrity_hash = excluded.sealed_integrity_hash
   where exists(select 1 from public.grand_jury_voting_rounds where id = p_round_id and status = 'Open');
  insert into public.audit_logs(user_id, action, table_name, record_id, description)
  values (auth.uid(), 'grand_jury_ballot_submitted', 'grand_jury_secret_ballots', p_round_id, 'Sealed Grand Jury ballot submitted. Audit records voter activity but not public vote content.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.submit_trial_jury_ballot(p_round_id uuid, p_question_id uuid, p_panel_id uuid, p_ballot_value text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_status text; v_panel public.trial_jury_panels%rowtype; v_question_tj uuid; v_round_tj uuid; v_role text;
begin
  select status, trial_jury_id into v_status, v_round_tj from public.trial_jury_voting_rounds where id = p_round_id;
  if v_status is distinct from 'Open' then raise exception 'Voting round is closed'; end if;
  select * into v_panel from public.trial_jury_panels where id = p_panel_id;
  if not found or v_panel.juror_user_id is distinct from auth.uid() then raise exception 'Not authorized for this Trial Jury ballot'; end if;
  select role::text into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role <> 'TRIAL_JUROR' then raise exception 'Trial Jury ballots require TRIAL_JUROR role'; end if;
  select trial_jury_id into v_question_tj from public.trial_verdict_questions where id = p_question_id;
  if v_question_tj is distinct from v_round_tj or v_panel.trial_jury_id is distinct from v_round_tj then raise exception 'Ballot target does not match proceeding'; end if;
  if v_panel.member_type <> 'juror' or v_panel.removed_at is not null or not public.is_compact_jury_status_eligible(v_panel.attendance_status) then raise exception 'Juror is not eligible to vote'; end if;
  if p_ballot_value not in ('Guilty','Not Guilty') then raise exception 'Invalid Trial Jury ballot value'; end if;
  insert into public.trial_jury_secret_ballots(voting_round_id, question_id, juror_panel_id, ballot_value, sealed_integrity_hash)
  values (p_round_id, p_question_id, p_panel_id, p_ballot_value, encode(extensions.digest(convert_to(p_round_id::text || p_question_id::text || p_panel_id::text || p_ballot_value || now()::text, 'UTF8'), 'sha256'), 'hex'))
  on conflict (voting_round_id, question_id, juror_panel_id) do update
     set ballot_value = excluded.ballot_value, updated_at = now(), sealed_integrity_hash = excluded.sealed_integrity_hash
   where exists(select 1 from public.trial_jury_voting_rounds where id = p_round_id and status = 'Open');
  insert into public.audit_logs(user_id, action, table_name, record_id, description)
  values (auth.uid(), 'trial_jury_ballot_submitted', 'trial_jury_secret_ballots', p_round_id, 'Sealed Trial Jury ballot submitted. Audit records voter activity but not public vote content.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.close_grand_jury_vote_round(p_round_id uuid, p_certification text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_gj public.grand_juries%rowtype; v_present integer; v_threshold integer; v_record uuid; v_snapshot jsonb;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  select g.* into v_gj from public.grand_juries g join public.grand_jury_voting_rounds vr on vr.grand_jury_id = g.id where vr.id = p_round_id;
  if not found then raise exception 'Grand Jury voting round not found'; end if;
  if not exists(select 1 from public.grand_jury_voting_rounds where id = p_round_id and status = 'Open') then raise exception 'Voting round is not open'; end if;
  select count(*) into v_present from public.grand_jury_members where grand_jury_id = v_gj.id and member_type = 'juror' and removed_at is null and public.is_compact_jury_status_eligible(status) and public.is_compact_jury_status_eligible(attendance_status);
  v_threshold := public.compact_grand_jury_threshold(v_gj.selected_panel_size);
  if v_present < v_gj.selected_panel_size then raise exception 'Grand Jury quorum is incomplete'; end if;
  for r in
    select c.id as count_id,
           count(*) filter (where b.ballot_value = 'True Bill') as true_bill_votes,
           count(*) filter (where b.ballot_value = 'No Bill') as no_bill_votes,
           count(*) filter (where b.ballot_value = 'Recused') as abstain_or_recused
      from public.grand_jury_counts c
      left join public.grand_jury_secret_ballots b on b.count_id = c.id and b.voting_round_id = p_round_id
     where c.grand_jury_id = v_gj.id
     group by c.id
  loop
    insert into public.grand_jury_vote_results(voting_round_id, count_id, true_bill_votes, no_bill_votes, abstain_or_recused, concurrence_required, result)
    values (p_round_id, r.count_id, r.true_bill_votes, r.no_bill_votes, r.abstain_or_recused, v_threshold, case when r.true_bill_votes >= v_threshold then 'True Bill' else 'No Bill' end)
    on conflict (voting_round_id, count_id) do update set true_bill_votes = excluded.true_bill_votes, no_bill_votes = excluded.no_bill_votes, abstain_or_recused = excluded.abstain_or_recused, concurrence_required = excluded.concurrence_required, result = excluded.result, certified_at = now();
    update public.grand_jury_counts set approved_for_indictment = r.true_bill_votes >= v_threshold, status = case when r.true_bill_votes >= v_threshold then 'True Bill' else 'No Bill' end where id = r.count_id;
  end loop;
  update public.grand_jury_voting_rounds set status = 'Certified', closed_by = auth.uid(), closed_at = now(), foreperson_certification = p_certification where id = p_round_id;
  update public.grand_juries set status = 'Returned', updated_at = now() where id = v_gj.id;
  v_snapshot := public.build_grand_jury_vote_record_snapshot(p_round_id);
  insert into public.grand_jury_vote_records(voting_round_id, snapshot, generated_by)
  values (p_round_id, v_snapshot, auth.uid())
  on conflict (voting_round_id) do nothing
  returning id into v_record;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), 'grand_jury_vote_certified', 'grand_jury_voting_rounds', p_round_id, 'Grand Jury vote certified; sealed individual ballots remain protected.', jsonb_build_object('threshold', v_threshold, 'vote_record_id', v_record));
  return jsonb_build_object('ok', true, 'threshold', v_threshold, 'vote_record_id', v_record);
end $$;

create or replace function public.close_trial_jury_vote_round(p_round_id uuid, p_certification text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_tj public.trial_juries%rowtype; v_present integer;
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  select t.* into v_tj from public.trial_juries t join public.trial_jury_voting_rounds vr on vr.trial_jury_id = t.id where vr.id = p_round_id;
  if not found then raise exception 'Trial Jury voting round not found'; end if;
  if not exists(select 1 from public.trial_jury_voting_rounds where id = p_round_id and status = 'Open') then raise exception 'Voting round is not open'; end if;
  select count(*) into v_present from public.trial_jury_panels where trial_jury_id = v_tj.id and member_type = 'juror' and removed_at is null and public.is_compact_jury_status_eligible(attendance_status);
  if v_present < v_tj.selected_panel_size then raise exception 'Trial Jury deliberating panel is incomplete'; end if;
  for r in
    select q.id as question_id,
           count(*) filter (where b.ballot_value = 'Guilty') as guilty_votes,
           count(*) filter (where b.ballot_value = 'Not Guilty') as not_guilty_votes,
           count(b.id) as total_votes
      from public.trial_verdict_questions q
      left join public.trial_jury_secret_ballots b on b.question_id = q.id and b.voting_round_id = p_round_id
     where q.trial_jury_id = v_tj.id
     group by q.id
  loop
    insert into public.trial_jury_vote_results(voting_round_id, question_id, guilty_votes, not_guilty_votes, result)
    values (p_round_id, r.question_id, r.guilty_votes, r.not_guilty_votes, case when r.guilty_votes = v_present and r.total_votes = v_present then 'Guilty' when r.not_guilty_votes = v_present and r.total_votes = v_present then 'Not Guilty' else 'No unanimous verdict — deliberations continue' end)
    on conflict (voting_round_id, question_id) do update set guilty_votes = excluded.guilty_votes, not_guilty_votes = excluded.not_guilty_votes, result = excluded.result, certified_at = now();
  end loop;
  update public.trial_jury_voting_rounds set status = 'Certified', closed_by = auth.uid(), closed_at = now(), verdict_form_submitted = true, foreperson_certification = p_certification where id = p_round_id;
  update public.trial_juries set deliberation_status = case when exists(select 1 from public.trial_jury_vote_results where voting_round_id = p_round_id and result = 'No unanimous verdict — deliberations continue') then 'Deliberations continue' else 'Verdict form submitted' end, status = case when exists(select 1 from public.trial_jury_vote_results where voting_round_id = p_round_id and result = 'No unanimous verdict — deliberations continue') then 'Deliberating' else 'Returned' end, updated_at = now() where id = v_tj.id;
  insert into public.audit_logs(user_id, action, table_name, record_id, description) values (auth.uid(), 'trial_jury_vote_certified', 'trial_jury_voting_rounds', p_round_id, 'Trial Jury vote certified; individual ballots remain sealed.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.build_grand_jury_vote_record_snapshot(p_round_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'voting_round_id', vr.id,
    'vote_record_number', coalesce((select vote_record_number from public.grand_jury_vote_records where voting_round_id = vr.id), 'PENDING'),
    'panel_name', coalesce(g.panel_name, g.grand_jury_number),
    'grand_jury_number', g.grand_jury_number,
    'proceeding_number', g.proceeding_number,
    'matter_number', m.matter_number,
    'matter_title', m.title,
    'court', coalesce(fc.display_name, fc.official_name),
    'district', coalesce(g.district, fc.district),
    'session_title', vr.title,
    'opened_at', vr.opened_at,
    'certified_at', coalesce(vr.closed_at, now()),
    'supervising_judge', g.supervising_judge,
    'foreperson', coalesce(fm.display_name, g.foreperson),
    'deputy_foreperson', coalesce(dm.display_name, g.deputy_foreperson),
    'clerk', cp.full_name,
    'selected_panel_size', g.selected_panel_size,
    'present_members', (select count(*) from public.grand_jury_members gm where gm.grand_jury_id = g.id and gm.member_type = 'juror' and gm.removed_at is null and public.is_compact_jury_status_eligible(gm.status) and public.is_compact_jury_status_eligible(gm.attendance_status)),
    'threshold', public.compact_grand_jury_threshold(g.selected_panel_size),
    'classification', 'SEALED — GRAND JURY MATERIAL',
    'counts', coalesce((select jsonb_agg(jsonb_build_object(
      'count_number', c.count_number,
      'person_or_entity', c.person_or_entity,
      'statute', c.statute,
      'offense_title', c.offense_title,
      'allegation_summary', c.allegation_summary,
      'true_bill_votes', r.true_bill_votes,
      'no_bill_votes', r.no_bill_votes,
      'recused_votes', r.abstain_or_recused,
      'threshold', r.concurrence_required,
      'result', r.result
    ) order by c.count_number) from public.grand_jury_counts c left join public.grand_jury_vote_results r on r.count_id = c.id and r.voting_round_id = vr.id where c.grand_jury_id = g.id), '[]'::jsonb)
  )
  from public.grand_jury_voting_rounds vr
  join public.grand_juries g on g.id = vr.grand_jury_id
  left join public.matters m on m.id = g.primary_matter_id
  left join public.federal_courts fc on fc.id = g.court_id
  left join public.grand_jury_members fm on fm.id = g.foreperson_member_id
  left join public.grand_jury_members dm on dm.id = g.deputy_foreperson_member_id
  left join public.profiles cp on cp.id = g.responsible_clerk_id
  where vr.id = p_round_id
$$;

create or replace function public.ensure_grand_jury_vote_record(p_round_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_record public.grand_jury_vote_records%rowtype; v_snapshot jsonb;
begin
  perform public.assert_doj_relationship_permission('juries','view');
  select * into v_record from public.grand_jury_vote_records where voting_round_id = p_round_id;
  if found then
    return jsonb_build_object('ok', true, 'record_id', v_record.id, 'vote_record_number', v_record.vote_record_number, 'snapshot', v_record.snapshot, 'pdf_sha256', v_record.pdf_sha256);
  end if;
  if not exists(select 1 from public.grand_jury_voting_rounds where id = p_round_id and status = 'Certified') then raise exception 'Grand Jury vote record is available only after certification'; end if;
  v_snapshot := public.build_grand_jury_vote_record_snapshot(p_round_id);
  insert into public.grand_jury_vote_records(voting_round_id, snapshot, generated_by) values (p_round_id, v_snapshot, auth.uid()) returning * into v_record;
  return jsonb_build_object('ok', true, 'record_id', v_record.id, 'vote_record_number', v_record.vote_record_number, 'snapshot', v_record.snapshot, 'pdf_sha256', v_record.pdf_sha256);
end $$;

drop policy if exists grand_jury_secret_ballots_self_or_certified on public.grand_jury_secret_ballots;
drop policy if exists trial_jury_secret_ballots_self_or_certified on public.trial_jury_secret_ballots;

create policy grand_jury_secret_ballots_own_read on public.grand_jury_secret_ballots
for select to authenticated
using (exists(select 1 from public.grand_jury_members m where m.id = juror_member_id and m.juror_user_id = auth.uid()));

create policy trial_jury_secret_ballots_own_read on public.trial_jury_secret_ballots
for select to authenticated
using (exists(select 1 from public.trial_jury_panels p where p.id = juror_panel_id and p.juror_user_id = auth.uid()));

drop policy if exists grand_jury_members_juror_read on public.grand_jury_members;
create policy grand_jury_members_juror_read on public.grand_jury_members
for select to authenticated
using (juror_user_id = auth.uid());

drop policy if exists trial_jury_panels_juror_read on public.trial_jury_panels;
create policy trial_jury_panels_juror_read on public.trial_jury_panels
for select to authenticated
using (juror_user_id = auth.uid());

drop policy if exists grand_juries_assigned_juror_read on public.grand_juries;
create policy grand_juries_assigned_juror_read on public.grand_juries
for select to authenticated
using (exists(select 1 from public.grand_jury_members m where m.grand_jury_id = id and m.juror_user_id = auth.uid() and m.removed_at is null));

drop policy if exists trial_juries_assigned_juror_read on public.trial_juries;
create policy trial_juries_assigned_juror_read on public.trial_juries
for select to authenticated
using (exists(select 1 from public.trial_jury_panels p where p.trial_jury_id = id and p.juror_user_id = auth.uid() and p.removed_at is null));

drop policy if exists grand_jury_counts_assigned_juror_read on public.grand_jury_counts;
create policy grand_jury_counts_assigned_juror_read on public.grand_jury_counts
for select to authenticated
using (exists(select 1 from public.grand_jury_members m where m.grand_jury_id = grand_jury_counts.grand_jury_id and m.juror_user_id = auth.uid() and m.removed_at is null));

drop policy if exists grand_jury_voting_rounds_assigned_juror_read on public.grand_jury_voting_rounds;
create policy grand_jury_voting_rounds_assigned_juror_read on public.grand_jury_voting_rounds
for select to authenticated
using (exists(select 1 from public.grand_jury_members m where m.grand_jury_id = grand_jury_voting_rounds.grand_jury_id and m.juror_user_id = auth.uid() and m.removed_at is null));

drop policy if exists trial_verdict_questions_assigned_juror_read on public.trial_verdict_questions;
create policy trial_verdict_questions_assigned_juror_read on public.trial_verdict_questions
for select to authenticated
using (exists(select 1 from public.trial_jury_panels p where p.trial_jury_id = trial_verdict_questions.trial_jury_id and p.juror_user_id = auth.uid() and p.removed_at is null));

drop policy if exists trial_jury_voting_rounds_assigned_juror_read on public.trial_jury_voting_rounds;
create policy trial_jury_voting_rounds_assigned_juror_read on public.trial_jury_voting_rounds
for select to authenticated
using (exists(select 1 from public.trial_jury_panels p where p.trial_jury_id = trial_jury_voting_rounds.trial_jury_id and p.juror_user_id = auth.uid() and p.removed_at is null));

drop policy if exists evidence_items_grand_juror_read on public.evidence_items;
create policy evidence_items_grand_juror_read on public.evidence_items
for select to authenticated
using (
  sealed is false
  and coalesce(grand_jury_status, '') in ('Grand-jury material','Grand-jury authorized','Not grand-jury material')
  and exists(select 1 from public.grand_juries g join public.grand_jury_members m on m.grand_jury_id = g.id where g.primary_matter_id = evidence_items.matter_id and m.juror_user_id = auth.uid() and m.removed_at is null)
);

drop policy if exists evidence_items_trial_juror_read on public.evidence_items;
create policy evidence_items_trial_juror_read on public.evidence_items
for select to authenticated
using (
  sealed is false
  and coalesce(grand_jury_status, '') <> 'Grand-jury material'
  and exists(select 1 from public.trial_juries t join public.trial_jury_panels p on p.trial_jury_id = t.id where t.case_id = evidence_items.case_id and p.juror_user_id = auth.uid() and p.removed_at is null)
);

grant execute on function public.compact_grand_jury_threshold(integer) to authenticated, anon, service_role;
grant execute on function public.is_compact_jury_status_eligible(text) to authenticated, service_role;
grant execute on function public.add_grand_jury_member(uuid,uuid,jsonb) to authenticated, service_role;
grant execute on function public.remove_grand_jury_member(uuid,text,text) to authenticated, service_role;
grant execute on function public.add_trial_jury_member(uuid,uuid,jsonb) to authenticated, service_role;
grant execute on function public.remove_trial_jury_member(uuid,text,text) to authenticated, service_role;
grant execute on function public.designate_grand_jury_foreperson(uuid,uuid,uuid,text) to authenticated, service_role;
grant execute on function public.record_trial_jury_foreperson_selection(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.build_grand_jury_vote_record_snapshot(uuid) to authenticated, service_role;
grant execute on function public.ensure_grand_jury_vote_record(uuid) to authenticated, service_role;

do $$
begin
  alter publication supabase_realtime add table public.grand_jury_vote_records;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
