-- Supabase keeps pgcrypto helpers in the extensions schema on this project.

create or replace function public.submit_grand_jury_ballot(p_round_id uuid, p_count_id uuid, p_member_id uuid, p_ballot_value text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_status text;
begin
  select status into v_status from public.grand_jury_voting_rounds where id = p_round_id;
  if v_status is distinct from 'Open' then raise exception 'Voting round is closed'; end if;
  if p_ballot_value not in ('True Bill','No Bill','Abstain','Recused') then raise exception 'Invalid Grand Jury ballot value'; end if;
  insert into public.grand_jury_secret_ballots(voting_round_id, count_id, juror_member_id, ballot_value, sealed_integrity_hash)
  values (
    p_round_id,
    p_count_id,
    p_member_id,
    p_ballot_value,
    encode(extensions.digest(convert_to(p_round_id::text || p_count_id::text || p_member_id::text || p_ballot_value || now()::text, 'UTF8'), 'sha256'), 'hex')
  )
  on conflict (voting_round_id, count_id, juror_member_id) do update
     set ballot_value = excluded.ballot_value,
         updated_at = now(),
         sealed_integrity_hash = excluded.sealed_integrity_hash
   where exists(select 1 from public.grand_jury_voting_rounds where id = p_round_id and status = 'Open');
  insert into public.audit_logs(user_id, action, table_name, record_id, description)
  values (auth.uid(), 'grand_jury_ballot_submitted', 'grand_jury_secret_ballots', p_round_id, 'Sealed Grand Jury ballot submitted. Individual value is not exposed in UI.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.submit_trial_jury_ballot(p_round_id uuid, p_question_id uuid, p_panel_id uuid, p_ballot_value text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_status text;
begin
  select status into v_status from public.trial_jury_voting_rounds where id = p_round_id;
  if v_status is distinct from 'Open' then raise exception 'Voting round is closed'; end if;
  if p_ballot_value not in ('Guilty','Not Guilty') then raise exception 'Invalid Trial Jury ballot value'; end if;
  insert into public.trial_jury_secret_ballots(voting_round_id, question_id, juror_panel_id, ballot_value, sealed_integrity_hash)
  values (
    p_round_id,
    p_question_id,
    p_panel_id,
    p_ballot_value,
    encode(extensions.digest(convert_to(p_round_id::text || p_question_id::text || p_panel_id::text || p_ballot_value || now()::text, 'UTF8'), 'sha256'), 'hex')
  )
  on conflict (voting_round_id, question_id, juror_panel_id) do update
     set ballot_value = excluded.ballot_value,
         updated_at = now(),
         sealed_integrity_hash = excluded.sealed_integrity_hash
   where exists(select 1 from public.trial_jury_voting_rounds where id = p_round_id and status = 'Open');
  insert into public.audit_logs(user_id, action, table_name, record_id, description)
  values (auth.uid(), 'trial_jury_ballot_submitted', 'trial_jury_secret_ballots', p_round_id, 'Sealed Trial Jury ballot submitted. Individual value is not exposed in UI.');
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.submit_grand_jury_ballot(uuid,uuid,uuid,text) to authenticated, service_role;
grant execute on function public.submit_trial_jury_ballot(uuid,uuid,uuid,text) to authenticated, service_role;

notify pgrst, 'reload schema';
