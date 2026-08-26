alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales','enviar_mapa_escrutinio','ver_votos_territoriales','rechazar_votos_territoriales','devolver_votos_territoriales','ver_historial_municipio','configurar_totales_territoriales','editar_total_esperado','eliminar_actualizaciones',
  'configurar_total_esperado','agregar_votos','revisar_votos','devolver_votos','rechazar_votos','publicar_resultados_definitivos'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales','enviar_mapa_escrutinio','ver_votos_territoriales','rechazar_votos_territoriales','devolver_votos_territoriales','ver_historial_municipio','configurar_totales_territoriales','editar_total_esperado','eliminar_actualizaciones',
  'configurar_total_esperado','agregar_votos','revisar_votos','devolver_votos','rechazar_votos','publicar_resultados_definitivos'
));

insert into public.role_permission_rules(role, resource, action, allowed)
select role, 'elecciones', action, true
from (select distinct role from public.role_permission_rules union select 'SUPER_ADMIN') roles
cross join (values('configurar_total_esperado'),('agregar_votos'),('revisar_votos'),('devolver_votos'),('rechazar_votos'),('publicar_resultados_definitivos')) as p(action)
where role in ('SUPER_ADMIN','ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')
on conflict(role, resource, action) do nothing;

create table if not exists public.election_count_batches (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  option_counts jsonb not null default '{}'::jsonb,
  annulled_votes integer not null default 0 check(annulled_votes >= 0),
  rejected_votes integer not null default 0 check(rejected_votes >= 0),
  status text not null default 'draft' check(status in ('draft','submitted','validated','returned','rejected','published')),
  source_type text not null default 'admin' check(source_type in ('admin','manual','online','import')),
  note text,
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists election_count_batches_election_status_idx on public.election_count_batches(election_id,status,created_at desc);
drop trigger if exists election_count_batches_updated on public.election_count_batches;
create trigger election_count_batches_updated before update on public.election_count_batches for each row execute function public.set_updated_at();
alter table public.election_count_batches enable row level security;
drop policy if exists election_count_batches_read on public.election_count_batches;
drop policy if exists election_count_batches_write on public.election_count_batches;
create policy election_count_batches_read on public.election_count_batches for select to authenticated using(public.can_manage_election(election_id,'ver_votos') or public.can_manage_election(election_id,'revisar_votos'));
create policy election_count_batches_write on public.election_count_batches for all to authenticated using(public.can_manage_election(election_id,'agregar_votos') or public.can_manage_election(election_id,'revisar_votos')) with check(public.can_manage_election(election_id,'agregar_votos') or public.can_manage_election(election_id,'revisar_votos'));
grant select, insert, update on public.election_count_batches to authenticated;

create or replace function public.configure_election_expected_total(p_election_id uuid,p_total integer,p_reason text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_old integer; v_counted numeric;
begin
  if not public.can_manage_election(p_election_id,'configurar_total_esperado') and not public.can_manage_election(p_election_id,'editar') then
    raise exception 'No tiene permiso para configurar el total esperado';
  end if;
  if greatest(coalesce(p_total,0),0) <= 0 then raise exception 'El total esperado debe configurarse antes de publicar.'; end if;
  select total_expected_votes into v_old from public.elections where id=p_election_id;
  select coalesce(sum(public.jsonb_vote_sum(option_counts)+annulled_votes+rejected_votes),0) into v_counted from public.election_count_batches where election_id=p_election_id and status in ('submitted','validated','published');
  if p_total < coalesce(v_counted,0) then raise exception 'El total esperado no puede ser menor que los votos ya contabilizados o en revisión.'; end if;
  update public.elections set total_expected_votes=p_total, updated_by=auth.uid() where id=p_election_id;
  perform public.log_security_event(case when v_old is null then 'ELECTION_EXPECTED_TOTAL_CONFIGURED' else 'ELECTION_EXPECTED_TOTAL_CHANGED' end,'elections',p_election_id,'Total esperado de votos configurado',jsonb_build_object('election_id',p_election_id,'old_total',v_old,'new_total',p_total,'reason',nullif(trim(coalesce(p_reason,'')),'') ));
  return true;
end $$;
grant execute on function public.configure_election_expected_total(uuid,integer,text) to authenticated;

create or replace function public.election_count_total(p_election_id uuid)
returns numeric language sql stable security definer set search_path=public as $$
  select coalesce(sum(public.jsonb_vote_sum(option_counts)+annulled_votes+rejected_votes),0)::numeric
  from public.election_count_batches
  where election_id=p_election_id and status in ('validated','published')
$$;

create or replace function public.election_count_totals(p_election_id uuid)
returns table(option_id uuid,candidate_name text,is_blank_vote boolean,display_order integer,card_label text,admin_valid bigint,online_valid bigint,manual_valid bigint,total_valid bigint)
language sql stable security definer set search_path=public as $$
  with admin_totals as (
    select key::uuid option_id, sum(value::numeric)::bigint qty
    from public.election_count_batches b, jsonb_each_text(b.option_counts)
    where b.election_id=p_election_id and b.status in ('validated','published')
    group by key
  ), online_totals as (
    select selected_option_id option_id, count(*)::bigint qty
    from public.election_votes
    where election_id=p_election_id and source='online' and status='valid'
    group by selected_option_id
  ), manual_totals as (
    select selected_option_id option_id, coalesce(sum(quantity),0)::bigint qty
    from public.election_manual_vote_batches
    where election_id=p_election_id and status='validated'
    group by selected_option_id
  )
  select o.id,o.candidate_name::text,o.is_blank_vote,o.display_order,('Tarjeta Electoral '||o.display_order)::text,
    coalesce(a.qty,0),coalesce(ot.qty,0),coalesce(m.qty,0),(coalesce(a.qty,0)+coalesce(ot.qty,0)+coalesce(m.qty,0))::bigint
  from public.election_options o
  left join admin_totals a on a.option_id=o.id
  left join online_totals ot on ot.option_id=o.id
  left join manual_totals m on m.option_id=o.id
  where o.election_id=p_election_id and o.active
  order by o.display_order
$$;
grant execute on function public.election_count_totals(uuid) to authenticated;

create or replace function public.election_public_totals(p_election_id uuid)
returns table(option_id uuid,candidate_name text,is_blank_vote boolean,online_valid bigint,manual_valid bigint,total_valid bigint)
language sql stable security definer set search_path=public as $$
  select option_id,candidate_name,is_blank_vote,online_valid,(manual_valid+admin_valid)::bigint as manual_valid,total_valid
  from public.election_count_totals(p_election_id)
$$;
grant execute on function public.election_public_totals(uuid) to anon,authenticated;

create or replace function public.election_validated_percentage_totals(p_election_id uuid)
returns table(option_id uuid,candidate_name text,is_blank_vote boolean,display_order integer,card_label text,public_percent numeric,progress_percent numeric)
language sql stable security definer set search_path=public as $$
  with totals as (select * from public.election_count_totals(p_election_id)),
  election as (select id,total_expected_votes from public.elections where id=p_election_id),
  sum_total as (select coalesce(sum(total_valid),0)::numeric counted from totals)
  select t.option_id,t.candidate_name,t.is_blank_vote,t.display_order,t.card_label,
    round((t.total_valid::numeric / greatest(e.total_expected_votes,1)::numeric)*100,2)::numeric,
    least(100,round((s.counted / greatest(e.total_expected_votes,1)::numeric)*100,2))::numeric
  from totals t cross join election e cross join sum_total s
  order by t.display_order
$$;
grant execute on function public.election_validated_percentage_totals(uuid) to authenticated;

create or replace function public.election_public_percentage_totals(p_election_id uuid)
returns table(option_id uuid,candidate_name text,is_blank_vote boolean,display_order integer,card_label text,ballot_card_image_path text,candidate_image_path text,public_percent numeric,progress_percent numeric,results_updated_at timestamptz)
language sql stable security definer set search_path=public as $$
  with latest as (
    select option_percentages, progress_percentage, updated_at
    from public.election_public_updates
    where election_id=p_election_id and public_visible
    order by update_number desc
    limit 1
  ), election as (
    select id,total_expected_votes,coalesce(results_published_at,updated_at,created_at) as updated_at
    from public.elections where id=p_election_id and status in ('preliminary_results','definitively_closed','final_results_published')
  )
  select o.id,o.candidate_name::text,o.is_blank_vote,o.display_order,
    ('Tarjeta Electoral '||o.display_order)::text,
    o.ballot_card_image_path::text,o.candidate_image_path::text,
    coalesce((
      select (item->>'percent')::numeric
      from latest, jsonb_array_elements(latest.option_percentages) item
      where item->>'option_id'=o.id::text
      limit 1
    ),0)::numeric,
    least(100,coalesce((select progress_percentage from latest),0))::numeric,
    coalesce((select updated_at from latest), e.updated_at)
  from election e
  join public.election_options o on o.election_id=e.id and o.active
  order by o.display_order
$$;
grant execute on function public.election_public_percentage_totals(uuid) to anon,authenticated;

create or replace function public.save_election_count_batch(p_election_id uuid,p_option_counts jsonb,p_annulled_votes integer default 0,p_rejected_votes integer default 0,p_submit boolean default true,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_expected integer; v_counted numeric; v_review numeric; v_new numeric; v_id uuid; v_status text;
begin
  if not public.can_manage_election(p_election_id,'agregar_votos') and not public.can_manage_election(p_election_id,'agregar_votos_manuales') then
    raise exception 'No tiene permiso para agregar votos';
  end if;
  select total_expected_votes into v_expected from public.elections where id=p_election_id;
  if coalesce(v_expected,0)<=0 then raise exception 'El total esperado debe configurarse antes de publicar.'; end if;
  select coalesce(sum(public.jsonb_vote_sum(option_counts)+annulled_votes+rejected_votes),0) into v_counted from public.election_count_batches where election_id=p_election_id and status in ('validated','published');
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
  select public.election_count_total(v_batch.election_id) into v_counted;
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
declare v_election public.elections%rowtype; v_next integer; v_rows jsonb; v_progress numeric; v_id uuid; v_act uuid; v_bad_count integer; v_expected integer;
begin
  if not public.can_manage_election(p_election_id,'actualizar_resultados')
     and not public.can_manage_election(p_election_id,'publicar_actualizacion') then
    raise exception 'No tiene permiso para actualizar resultados electorales';
  end if;
  select * into v_election from public.elections where id=p_election_id;
  if not found then raise exception 'Elección no disponible'; end if;
  v_expected := greatest(coalesce(v_election.total_expected_votes,0),1);

  select coalesce(jsonb_agg(jsonb_build_object('option_id',option_id,'label',card_label,'candidate_name',candidate_name,'percent',public_percent,'display_order',display_order) order by display_order),'[]'::jsonb), coalesce(max(progress_percent),0)
    into v_rows, v_progress
  from public.election_validated_percentage_totals(p_election_id);

  select count(*) into v_bad_count
  from jsonb_array_elements(coalesce(v_rows,'[]'::jsonb)) item
  where coalesce((item->>'percent')::numeric,0) > 100;

  if coalesce(v_progress,0) > 100 or coalesce(v_bad_count,0) > 0 then
    perform public.log_security_event('ELECTION_PUBLIC_UPDATE_BLOCKED','election_public_updates',null,'Se bloqueó publicación con porcentajes imposibles',jsonb_build_object('election_id',p_election_id,'progress_percent',v_progress,'bad_percentages',v_bad_count,'expected_total',v_expected));
    raise exception 'No se puede publicar esta actualización porque los votos superan el total esperado.';
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
  perform public.log_security_event('ELECTION_RESULTS_UPDATED','election_public_updates',v_id,'Actualización pública publicada con votos validados del conteo general',jsonb_build_object('election_id',p_election_id,'update_number',v_next,'snapshot_type',p_snapshot_type,'progress_percent',v_progress,'act_id',v_act));
  return v_id;
end $$;
grant execute on function public.create_election_public_update(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
