create or replace view public.public_elections with (security_barrier=true) as
select e.id,e.slug,e.title,e.office,e.territory,e.period,e.round_label,e.status,e.opens_at,e.closes_at,e.description,e.instructions,e.ballot_image_path,e.ballot_zones,d.name institution_name,e.total_expected_votes,e.winner_option_id,e.winner_published_at
from public.elections e left join public.dependencies d on d.id=e.institution_id
where e.status in ('prepared','open','reopened','closed','scrutiny','preliminary_results','definitively_closed','final_results_published');
grant select on public.public_elections to anon,authenticated;

create or replace function public.configure_election_expected_total(p_election_id uuid,p_total integer,p_reason text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_old integer; v_counted numeric;
begin
  if not public.can_manage_election(p_election_id,'configurar_total_esperado') and not public.can_manage_election(p_election_id,'editar') then
    raise exception 'No tiene permiso para configurar el total esperado';
  end if;
  if greatest(coalesce(p_total,0),0) <= 0 then raise exception 'El total esperado debe configurarse antes de publicar.'; end if;
  select total_expected_votes into v_old from public.elections where id=p_election_id;
  select coalesce(sum(total_valid),0)::numeric into v_counted from public.election_count_totals(p_election_id);
  v_counted := coalesce(v_counted,0) + coalesce((
    select sum(public.jsonb_vote_sum(option_counts)+annulled_votes+rejected_votes)
    from public.election_count_batches
    where election_id=p_election_id and status='submitted'
  ),0);
  if p_total < coalesce(v_counted,0) then raise exception 'El total esperado no puede ser menor que los votos ya contabilizados o en revisión.'; end if;
  update public.elections set total_expected_votes=p_total, updated_by=auth.uid() where id=p_election_id;
  perform public.log_security_event(case when v_old is null then 'ELECTION_EXPECTED_TOTAL_CONFIGURED' else 'ELECTION_EXPECTED_TOTAL_CHANGED' end,'elections',p_election_id,'Total esperado de votos configurado',jsonb_build_object('election_id',p_election_id,'old_total',v_old,'new_total',p_total,'reason',nullif(trim(coalesce(p_reason,'')),'') ));
  return true;
end $$;
grant execute on function public.configure_election_expected_total(uuid,integer,text) to authenticated;

create or replace function public.save_election_count_batch(p_election_id uuid,p_option_counts jsonb,p_annulled_votes integer default 0,p_rejected_votes integer default 0,p_submit boolean default true,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_expected integer; v_counted numeric; v_review numeric; v_new numeric; v_id uuid; v_status text;
begin
  if not public.can_manage_election(p_election_id,'agregar_votos') and not public.can_manage_election(p_election_id,'agregar_votos_manuales') then
    raise exception 'No tiene permiso para agregar votos';
  end if;
  select total_expected_votes into v_expected from public.elections where id=p_election_id;
  if coalesce(v_expected,0)<=0 then raise exception 'El total esperado debe configurarse antes de publicar.'; end if;
  select coalesce(sum(total_valid),0)::numeric into v_counted from public.election_count_totals(p_election_id);
  select coalesce(sum(public.jsonb_vote_sum(option_counts)+annulled_votes+rejected_votes),0) into v_review from public.election_count_batches where election_id=p_election_id and status='submitted';
  v_new := public.jsonb_vote_sum(p_option_counts)+greatest(coalesce(p_annulled_votes,0),0)+greatest(coalesce(p_rejected_votes,0),0);
  if v_new <= 0 then raise exception 'Ingrese al menos un voto.'; end if;
  if v_counted+v_review+v_new > v_expected then raise exception 'No puede agregar más votos que el restante disponible.'; end if;
  v_status := case when p_submit then 'submitted' else 'draft' end;
  insert into public.election_count_batches(election_id,option_counts,annulled_votes,rejected_votes,status,note,submitted_by,submitted_at,created_by)
  values(p_election_id,coalesce(p_option_counts,'{}'::jsonb),greatest(coalesce(p_annulled_votes,0),0),greatest(coalesce(p_rejected_votes,0),0),v_status,nullif(trim(coalesce(p_note,'')),''),case when p_submit then auth.uid() else null end,case when p_submit then now() else null end,auth.uid())
  returning id into v_id;
  perform public.log_security_event(case when p_submit then 'ELECTION_COUNT_BATCH_SENT_TO_REVIEW' else 'ELECTION_COUNT_BATCH_DRAFT_SAVED' end,'election_count_batches',v_id,'Lote de conteo electoral registrado',jsonb_build_object('election_id',p_election_id,'new_votes',v_new,'validated_before',v_counted,'in_review_before',v_review,'after_total',v_counted+v_review+v_new,'expected_total',v_expected,'note',nullif(trim(coalesce(p_note,'')),'') ));
  return v_id;
end $$;
grant execute on function public.save_election_count_batch(uuid,jsonb,integer,integer,boolean,text) to authenticated;

create or replace function public.review_election_count_batch(p_batch_id uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_batch public.election_count_batches%rowtype; v_permission text; v_expected integer; v_counted numeric; v_new numeric; v_act uuid;
begin
  select * into v_batch from public.election_count_batches where id=p_batch_id for update;
  if not found then raise exception 'Lote de conteo no disponible'; end if;
  if v_batch.status <> 'submitted' then raise exception 'Solo los lotes en revisión pueden revisarse.'; end if;
  if p_status not in ('validated','returned','rejected') then raise exception 'Estado de lote no permitido'; end if;
  if p_status in ('returned','rejected') and length(trim(coalesce(p_note,'')))<3 then raise exception 'Explique qué debe corregirse.'; end if;
  v_permission := case when p_status='validated' then 'validar_votos' when p_status='returned' then 'devolver_votos' else 'rechazar_votos' end;
  if not public.can_manage_election(v_batch.election_id,v_permission) and not public.can_manage_election(v_batch.election_id,'revisar_votos') then
    raise exception 'No tiene permiso para revisar votos';
  end if;
  select total_expected_votes into v_expected from public.elections where id=v_batch.election_id;
  select coalesce(sum(total_valid),0)::numeric into v_counted from public.election_count_totals(v_batch.election_id);
  v_new := public.jsonb_vote_sum(v_batch.option_counts)+v_batch.annulled_votes+v_batch.rejected_votes;
  if p_status='validated' and v_counted+v_new > greatest(coalesce(v_expected,0),0) then raise exception 'No puede agregar más votos que el restante disponible.'; end if;
  update public.election_count_batches set status=p_status,note=nullif(trim(coalesce(p_note,'')),''),reviewed_by=auth.uid(),reviewed_at=now() where id=p_batch_id;
  perform public.log_security_event(case when p_status='validated' then 'ELECTION_COUNT_BATCH_VALIDATED' when p_status='returned' then 'ELECTION_COUNT_BATCH_RETURNED' else 'ELECTION_COUNT_BATCH_REJECTED' end,'election_count_batches',p_batch_id,'Lote de conteo electoral revisado',jsonb_build_object('election_id',v_batch.election_id,'new_status',p_status,'votes',v_new,'note',nullif(trim(coalesce(p_note,'')),'') ));
  if p_status='validated' and v_counted+v_new >= v_expected then
    v_act := public.ensure_election_act_if_complete(v_batch.election_id);
    perform public.log_security_event('ELECTION_COUNT_100_PERCENT_REACHED','elections',v_batch.election_id,'El escrutinio alcanzó el 100%',jsonb_build_object('act_id',v_act,'expected_total',v_expected));
  end if;
  return true;
end $$;
grant execute on function public.review_election_count_batch(uuid,text,text) to authenticated;

create or replace function public.create_election_public_update(p_election_id uuid, p_snapshot_type text default 'preliminary', p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_election public.elections%rowtype; v_next integer; v_rows jsonb; v_progress numeric; v_id uuid; v_act uuid; v_bad_count integer; v_expected integer; v_counted numeric;
begin
  if not public.can_manage_election(p_election_id,'actualizar_resultados')
     and not public.can_manage_election(p_election_id,'publicar_actualizacion') then
    raise exception 'No tiene permiso para actualizar resultados electorales';
  end if;
  select * into v_election from public.elections where id=p_election_id;
  if not found then raise exception 'Elección no disponible'; end if;
  v_expected := coalesce(v_election.total_expected_votes,0);
  if v_expected <= 0 then
    perform public.log_security_event('ELECTION_PUBLIC_UPDATE_BLOCKED','election_public_updates',null,'Se bloqueó publicación sin total esperado',jsonb_build_object('election_id',p_election_id));
    raise exception 'Configure el total esperado antes de publicar una actualización.';
  end if;

  select coalesce(sum(total_valid),0)::numeric into v_counted from public.election_count_totals(p_election_id);
  if coalesce(v_counted,0) <= 0 then
    perform public.log_security_event('ELECTION_PUBLIC_UPDATE_BLOCKED','election_public_updates',null,'Se bloqueó publicación sin votos validados',jsonb_build_object('election_id',p_election_id,'expected_total',v_expected));
    raise exception 'No hay votos validados para publicar.';
  end if;
  if v_counted > v_expected then
    perform public.log_security_event('ELECTION_PUBLIC_UPDATE_BLOCKED','election_public_updates',null,'Se bloqueó publicación con votos validados superiores al total esperado',jsonb_build_object('election_id',p_election_id,'validated_total',v_counted,'expected_total',v_expected));
    raise exception 'No se puede publicar esta actualización porque los votos validados superan el total esperado.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('option_id',option_id,'label',card_label,'candidate_name',candidate_name,'percent',public_percent,'display_order',display_order) order by display_order),'[]'::jsonb), coalesce(max(progress_percent),0)
    into v_rows, v_progress
  from public.election_validated_percentage_totals(p_election_id);

  select count(*) into v_bad_count
  from jsonb_array_elements(coalesce(v_rows,'[]'::jsonb)) item
  where coalesce((item->>'percent')::numeric,0) > 100;

  if coalesce(v_progress,0) > 100 or coalesce(v_bad_count,0) > 0 then
    perform public.log_security_event('ELECTION_PUBLIC_UPDATE_BLOCKED','election_public_updates',null,'Se bloqueó publicación con porcentajes imposibles',jsonb_build_object('election_id',p_election_id,'progress_percent',v_progress,'bad_percentages',v_bad_count,'expected_total',v_expected));
    raise exception 'No se puede publicar esta actualización porque los porcentajes superan el 100%%.';
  end if;

  if v_election.status not in ('preliminary_results','definitively_closed','final_results_published') then
    update public.elections set status='preliminary_results', results_published_at=now(), updated_by=auth.uid() where id=p_election_id;
    select * into v_election from public.elections where id=p_election_id;
  end if;

  select coalesce(max(update_number),0)+1 into v_next from public.election_public_updates where election_id=p_election_id;
  insert into public.election_public_updates(election_id,update_number,snapshot_type,status_at_time,progress_percentage,option_percentages,note,updated_by)
  values(p_election_id,v_next,coalesce(nullif(p_snapshot_type,''),'preliminary'),v_election.status,least(100,coalesce(v_progress,0)),coalesce(v_rows,'[]'::jsonb),nullif(trim(coalesce(p_note,'')),''),auth.uid())
  returning id into v_id;

  update public.election_count_batches
  set status='published'
  where election_id=p_election_id and status='validated';

  if coalesce(v_progress,0) >= 100 then
    v_act := public.ensure_election_act_if_complete(p_election_id);
  end if;
  perform public.log_security_event('ELECTION_PUBLIC_UPDATE_CREATED','election_public_updates',v_id,'Actualización pública electoral creada',jsonb_build_object('election_id',p_election_id,'update_number',v_next,'snapshot_type',p_snapshot_type,'progress_percent',v_progress));
  perform public.log_security_event('ELECTION_RESULTS_UPDATED','election_public_updates',v_id,'Actualización pública publicada con votos validados del conteo general',jsonb_build_object('election_id',p_election_id,'update_number',v_next,'snapshot_type',p_snapshot_type,'progress_percent',v_progress,'act_id',v_act));
  return v_id;
end $$;
grant execute on function public.create_election_public_update(uuid,text,text) to authenticated;

create or replace function public.publish_election_results(p_election_id uuid,p_kind text,p_winner_option_id uuid default null,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_action text; v_totals jsonb; v_specific_action text;
begin
  v_action:=case p_kind when 'preliminary' then 'publicar_preliminares' when 'final' then 'publicar_resultados_definitivos' when 'winner' then 'declarar_ganador' else null end;
  if p_kind='final' and not public.can_manage_election(p_election_id,'publicar_resultados_definitivos') and public.can_manage_election(p_election_id,'publicar_resultados') then
    v_action := 'publicar_resultados';
  end if;
  if v_action is null or not public.can_manage_election(p_election_id,v_action) then raise exception 'No tiene permiso para publicar resultados electorales'; end if;
  if p_kind='winner' and p_winner_option_id is null then raise exception 'Seleccione un ganador oficial.'; end if;
  if p_kind='winner' and not exists(select 1 from public.election_options where id=p_winner_option_id and election_id=p_election_id and active) then raise exception 'La opción ganadora no pertenece a esta elección.'; end if;
  select jsonb_agg(to_jsonb(t)) into v_totals from public.election_public_totals(p_election_id) t;
  insert into public.election_results_snapshots(election_id,snapshot_type,totals,published_by,note) values(p_election_id,p_kind,coalesce(v_totals,'[]'::jsonb),auth.uid(),nullif(trim(coalesce(p_note,'')),''));
  if p_kind='preliminary' then
    update public.elections set status='preliminary_results',results_published_at=now(),updated_by=auth.uid() where id=p_election_id;
    v_specific_action := 'ELECTION_RESULTS_PUBLISHED';
  elsif p_kind='final' then
    update public.elections set status='final_results_published',results_published_at=now(),final_results_published_by=auth.uid(),updated_by=auth.uid() where id=p_election_id;
    v_specific_action := 'ELECTION_RESULTS_FINAL_PUBLISHED';
  else
    update public.elections set winner_option_id=p_winner_option_id,winner_published_at=now(),winner_published_by=auth.uid(),updated_by=auth.uid() where id=p_election_id;
    v_specific_action := 'ELECTION_WINNER_DECLARED';
  end if;
  perform public.log_security_event(v_specific_action,'elections',p_election_id,case when p_kind='winner' then 'Ganador oficial declarado manualmente' when p_kind='final' then 'Resultados definitivos publicados manualmente' else 'Resultados electorales preliminares publicados' end,jsonb_build_object('kind',p_kind,'winner_option_id',p_winner_option_id));
  perform public.log_security_event('ELECTION_RESULTS_PUBLISHED','elections',p_election_id,'Resultados electorales publicados o ganador declarado',jsonb_build_object('kind',p_kind,'winner_option_id',p_winner_option_id));
  return true;
end $$;
grant execute on function public.publish_election_results(uuid,text,uuid,text) to authenticated;

create or replace function public.generate_election_act(p_election_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_election public.elections%rowtype; v_act uuid; v_verification uuid; v_code text; v_rows jsonb; v_institution text; v_progress numeric;
begin
  if not public.can_manage_election(p_election_id,'generar_acta') then raise exception 'No tiene permiso para generar actas electorales'; end if;
  select * into v_election from public.elections where id=p_election_id;
  if not found then raise exception 'Elección no disponible'; end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by display_order),'[]'::jsonb), coalesce(max(progress_percent),0)
    into v_rows, v_progress
  from public.election_validated_percentage_totals(p_election_id) t;
  select d.name into v_institution from public.dependencies d where d.id=v_election.institution_id;
  loop
    v_code := 'SIGJ-ELEC-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    exit when not exists(select 1 from public.document_verifications where verification_code=v_code);
  end loop;
  insert into public.document_verifications(verification_code,document_type,source_table,source_id,title,institution,reserved,issued_by,public_metadata)
  values(v_code,'Acta electoral','election_acts',null,'Acta General de Escrutinio · '||v_election.title,coalesce(v_institution,'Palacio Judicial'),false,auth.uid(),jsonb_build_object('election_id',p_election_id,'office',v_election.office,'territory',v_election.territory,'status',v_election.status,'progress_percent',v_progress))
  returning id into v_verification;
  insert into public.election_acts(election_id,verification_id,public_summary,generated_by)
  values(p_election_id,v_verification,jsonb_build_object('results',coalesce(v_rows,'[]'::jsonb),'progress_percent',v_progress,'status',v_election.status,'office',v_election.office,'territory',v_election.territory,'period',v_election.period,'round_label',v_election.round_label),auth.uid())
  returning id into v_act;
  update public.document_verifications set source_id=v_act where id=v_verification;
  perform public.create_election_public_update(p_election_id,'act','Acta electoral generada');
  perform public.log_security_event('ELECTION_ACT_GENERATED','election_acts',v_act,'Acta General de Escrutinio generada desde conteo general validado',jsonb_build_object('election_id',p_election_id,'verification_code',v_code,'progress_percent',v_progress));
  return v_act;
end $$;
grant execute on function public.generate_election_act(uuid) to authenticated;

notify pgrst,'reload schema';
