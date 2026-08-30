set check_function_bodies = off;

alter table if exists public.grand_jury_members
  add column if not exists assignment_notes text,
  add column if not exists eligibility_confirmed_at timestamptz,
  add column if not exists eligibility_confirmed_by uuid references public.profiles(id),
  add column if not exists effective_from timestamptz not null default now(),
  add column if not exists effective_to timestamptz;

with ranked as (
  select id,
         row_number() over (partition by grand_jury_id, seat_sequence order by created_at, id) as rn
    from public.grand_jury_members
   where removed_at is null
     and seat_sequence is not null
)
update public.grand_jury_members m
   set seat_sequence = null,
       assignment_notes = concat_ws(E'\n', nullif(m.assignment_notes, ''), 'Seat cleared by migration because another active member already used the same seat.')
  from ranked r
 where m.id = r.id
   and r.rn > 1;

create unique index if not exists grand_jury_members_unique_seat_active
  on public.grand_jury_members(grand_jury_id, seat_sequence)
  where seat_sequence is not null and removed_at is null;

create or replace function public.add_grand_jury_member(p_grand_jury_id uuid, p_juror_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_votes integer;
  v_profile public.profiles%rowtype;
  v_member_type text := lower(coalesce(nullif(p_payload->>'member_type',''), 'juror'));
  v_status text := coalesce(nullif(p_payload->>'status',''), 'Selected');
  v_attendance text := coalesce(nullif(p_payload->>'attendance_status',''), 'present');
  v_juror_number text := nullif(trim(coalesce(p_payload->>'juror_participant_number','')), '');
  v_seat integer := nullif(p_payload->>'seat_sequence','')::integer;
  v_confirmed boolean := coalesce(nullif(p_payload->>'eligibility_confirmed','')::boolean, false);
  v_assignment_notes text := nullif(trim(coalesce(p_payload->>'assignment_notes', p_payload->>'notes')), '');
begin
  perform public.assert_doj_relationship_permission('juries','edit');
  if p_grand_jury_id is null or p_juror_user_id is null then
    raise exception 'Grand Jury and juror account are required';
  end if;
  if v_member_type not in ('juror', 'alternate') then
    raise exception 'Member type must be juror or alternate';
  end if;
  if not v_confirmed then
    raise exception 'Eligibility confirmation is required before assigning a Grand Jury member';
  end if;
  select count(*) into v_votes from public.grand_jury_voting_rounds where grand_jury_id = p_grand_jury_id;
  if v_votes > 0 then raise exception 'Jury members cannot be changed after voting has opened'; end if;
  if not exists(select 1 from public.grand_juries where id = p_grand_jury_id) then
    raise exception 'Grand Jury proceeding not found';
  end if;
  select * into v_profile from public.profiles where id = p_juror_user_id;
  if not found then raise exception 'Juror account not found'; end if;
  if not coalesce(v_profile.is_active, false) or v_profile.suspended_at is not null then
    raise exception 'Selected account is inactive or suspended';
  end if;
  if coalesce(v_profile.is_owner, false) or v_profile.role::text in ('SUPER_ADMIN','OWNER','ATTORNEY_GENERAL','DEPUTY_ATTORNEY_GENERAL','JUDGE','FOREPERSON') then
    raise exception 'Selected account has an incompatible institutional role for Grand Jury service';
  end if;
  if exists(select 1 from public.grand_jury_members where grand_jury_id = p_grand_jury_id and juror_user_id = p_juror_user_id and removed_at is null) then
    raise exception 'Selected account is already assigned to this Grand Jury';
  end if;
  if v_seat is null then
    select coalesce(max(seat_sequence), 0) + 1 into v_seat
      from public.grand_jury_members
     where grand_jury_id = p_grand_jury_id
       and removed_at is null;
  end if;
  if v_seat < 1 then raise exception 'Seat number must be positive'; end if;
  if exists(select 1 from public.grand_jury_members where grand_jury_id = p_grand_jury_id and seat_sequence = v_seat and removed_at is null) then
    raise exception 'Seat number is already assigned in this Grand Jury';
  end if;
  if v_juror_number is null then
    select 'GJ-' || lpad((coalesce(count(*), 0) + 1)::text, 2, '0') into v_juror_number
      from public.grand_jury_members
     where grand_jury_id = p_grand_jury_id;
  end if;

  insert into public.grand_jury_members(
    grand_jury_id, juror_user_id, juror_participant_number, display_name, seat_sequence, member_type,
    status, attendance_status, date_sworn, secrecy_acknowledgment, created_by, assignment_notes,
    eligibility_confirmed_at, eligibility_confirmed_by, effective_from
  )
  values (
    p_grand_jury_id,
    p_juror_user_id,
    v_juror_number,
    coalesce(nullif(p_payload->>'display_name',''), nullif(v_profile.public_display_name, ''), v_profile.full_name),
    v_seat,
    v_member_type,
    v_status,
    v_attendance,
    nullif(p_payload->>'date_sworn','')::date,
    coalesce(nullif(p_payload->>'secrecy_acknowledgment','')::boolean, false),
    auth.uid(),
    v_assignment_notes,
    now(),
    auth.uid(),
    now()
  ) returning id into v_id;

  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (
    auth.uid(),
    'grand_jury_member_added',
    'grand_jury_members',
    v_id,
    'Grand Jury member assigned by panel-specific membership record; global institutional role preserved.',
    jsonb_build_object(
      'grand_jury_id', p_grand_jury_id,
      'juror_user_id', p_juror_user_id,
      'juror_role', v_profile.role::text,
      'member_type', v_member_type,
      'seat_sequence', v_seat,
      'eligibility_confirmed', v_confirmed
    )
  );
  return jsonb_build_object('ok', true, 'member_id', v_id, 'seat_sequence', v_seat, 'juror_participant_number', v_juror_number);
end $$;

grant execute on function public.add_grand_jury_member(uuid, uuid, jsonb) to authenticated, service_role;
