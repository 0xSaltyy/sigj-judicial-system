alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales','enviar_mapa_escrutinio','ver_votos_territoriales','rechazar_votos_territoriales','devolver_votos_territoriales','ver_historial_municipio','configurar_totales_territoriales','editar_total_esperado'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales','enviar_mapa_escrutinio','ver_votos_territoriales','rechazar_votos_territoriales','devolver_votos_territoriales','ver_historial_municipio','configurar_totales_territoriales','editar_total_esperado'
));

insert into public.role_permission_rules(role, resource, action, allowed)
select role, 'elecciones', action, true
from (select distinct role from public.role_permission_rules union select 'SUPER_ADMIN') roles
cross join (values('configurar_totales_territoriales'),('editar_total_esperado')) as p(action)
where role in ('SUPER_ADMIN','ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')
on conflict(role, resource, action) do nothing;

create table if not exists public.election_territorial_city_batches (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  city text not null check(city in ('Cali','Palmira','Buenaventura','Tuluá')),
  option_counts jsonb not null default '{}'::jsonb,
  annulled_votes integer not null default 0 check(annulled_votes >= 0),
  rejected_votes integer not null default 0 check(rejected_votes >= 0),
  status text not null default 'draft' check(status in ('draft','submitted','validated','returned','rejected','published')),
  note text,
  correction_of uuid references public.election_territorial_city_batches(id) on delete set null,
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists election_city_batches_election_city_idx on public.election_territorial_city_batches(election_id, city, status, created_at desc);
drop trigger if exists election_city_batches_updated on public.election_territorial_city_batches;
create trigger election_city_batches_updated before update on public.election_territorial_city_batches for each row execute function public.set_updated_at();
alter table public.election_territorial_city_batches enable row level security;
drop policy if exists election_city_batches_read on public.election_territorial_city_batches;
drop policy if exists election_city_batches_write on public.election_territorial_city_batches;
create policy election_city_batches_read on public.election_territorial_city_batches for select to authenticated using(public.can_manage_election(election_id,'ver_votos_territoriales') or public.can_manage_election(election_id,'ver_mapa'));
create policy election_city_batches_write on public.election_territorial_city_batches for all to authenticated using(public.can_manage_election(election_id,'agregar_votos_territoriales')) with check(public.can_manage_election(election_id,'agregar_votos_territoriales'));
grant select, insert, update on public.election_territorial_city_batches to authenticated;

create or replace function public.jsonb_vote_sum(p_counts jsonb)
returns numeric language sql immutable as $$
  select coalesce(sum(greatest(value::numeric,0)),0)::numeric from jsonb_each_text(coalesce(p_counts,'{}'::jsonb))
$$;

create or replace function public.jsonb_vote_add(p_left jsonb, p_right jsonb)
returns jsonb language sql immutable as $$
  with keys as (
    select key from jsonb_each_text(coalesce(p_left,'{}'::jsonb))
    union
    select key from jsonb_each_text(coalesce(p_right,'{}'::jsonb))
  )
  select coalesce(jsonb_object_agg(key, coalesce((p_left->>key)::numeric,0)+coalesce((p_right->>key)::numeric,0)),'{}'::jsonb) from keys
$$;

create or replace function public.sync_election_total_from_cities(p_election_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_total integer;
begin
  select coalesce(sum(expected_votes),0)::integer into v_total
  from public.election_territorial_results
  where election_id=p_election_id and zone_name in ('Cali','Palmira','Buenaventura','Tuluá');
  if v_total > 0 then
    update public.elections set total_expected_votes=v_total, updated_by=auth.uid() where id=p_election_id;
  end if;
end $$;

create or replace function public.configure_election_city_total(p_election_id uuid,p_city text,p_expected_votes integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_old integer; v_used numeric; v_review numeric;
begin
  if p_city not in ('Cali','Palmira','Buenaventura','Tuluá') then raise exception 'Ciudad territorial no disponible'; end if;
  if greatest(coalesce(p_expected_votes,0),0) <= 0 then raise exception 'Debe configurar el total esperado.'; end if;
  if not public.can_manage_election(p_election_id,'configurar_totales_territoriales') and not public.can_manage_election(p_election_id,'editar_total_esperado') then
    perform public.log_security_event('ELECTION_CITY_TOTAL_DENIED','election_territorial_results',null,'Intento no autorizado de configurar total territorial',jsonb_build_object('election_id',p_election_id,'city',p_city));
    raise exception 'No tiene permiso para configurar totales territoriales';
  end if;
  select expected_votes, public.jsonb_vote_sum(option_counts)+annulled_votes+rejected_votes into v_old, v_used
  from public.election_territorial_results where election_id=p_election_id and zone_name=p_city;
  select coalesce(sum(public.jsonb_vote_sum(option_counts)+annulled_votes+rejected_votes),0) into v_review
  from public.election_territorial_city_batches where election_id=p_election_id and city=p_city and status='submitted';
  if greatest(coalesce(p_expected_votes,0),0) < coalesce(v_used,0)+coalesce(v_review,0) then
    raise exception 'El total esperado no puede ser menor que los votos validados o en revisión.';
  end if;
  insert into public.election_territorial_results(election_id,department,zone_name,zone_type,zone_label,expected_votes,counted_percentage,option_counts,option_percentages,annulled_votes,rejected_votes,status,validation_status,updated_by,public_updated_at)
  values(p_election_id,'Valle del Cauca',p_city,'ciudad',p_city,greatest(p_expected_votes,1),0,'{}'::jsonb,'{}'::jsonb,0,0,'sin_reporte','pending_submission',auth.uid(),now())
  on conflict(election_id,zone_name) do update set expected_votes=excluded.expected_votes, zone_type='ciudad', zone_label=excluded.zone_label, updated_by=auth.uid(), public_updated_at=now()
  returning id into v_id;
  perform public.sync_election_total_from_cities(p_election_id);
  perform public.log_security_event(case when v_old is null then 'ELECTION_CITY_TOTAL_CONFIGURED' else 'ELECTION_CITY_TOTAL_CHANGED' end,'election_territorial_results',v_id,'Total esperado territorial configurado',jsonb_build_object('election_id',p_election_id,'city',p_city,'old_total',v_old,'new_total',p_expected_votes));
  return v_id;
end $$;
grant execute on function public.configure_election_city_total(uuid,text,integer) to authenticated;

create or replace function public.save_election_city_vote_batch(p_election_id uuid,p_city text,p_option_counts jsonb,p_annulled_votes integer default 0,p_rejected_votes integer default 0,p_submit boolean default true,p_correction_of uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_expected integer; v_validated numeric; v_review numeric; v_new numeric; v_status text; v_id uuid;
begin
  if p_city not in ('Cali','Palmira','Buenaventura','Tuluá') then raise exception 'Ciudad territorial no disponible'; end if;
  if not public.can_manage_election(p_election_id,'agregar_votos_territoriales') then
    perform public.log_security_event('ELECTION_CITY_VOTES_DENIED','election_territorial_city_batches',null,'Intento no autorizado de agregar votos territoriales',jsonb_build_object('election_id',p_election_id,'city',p_city));
    raise exception 'No tiene permiso para agregar votos territoriales';
  end if;
  if p_submit and not public.can_manage_election(p_election_id,'enviar_mapa_escrutinio') then
    raise exception 'No tiene permiso para enviar votos a revisión';
  end if;
  select expected_votes, public.jsonb_vote_sum(option_counts)+annulled_votes+rejected_votes into v_expected, v_validated
  from public.election_territorial_results where election_id=p_election_id and zone_name=p_city;
  if coalesce(v_expected,0) <= 0 then raise exception 'Debe configurar el total esperado.'; end if;
  select coalesce(sum(public.jsonb_vote_sum(option_counts)+annulled_votes+rejected_votes),0) into v_review
  from public.election_territorial_city_batches where election_id=p_election_id and city=p_city and status='submitted';
  v_new := public.jsonb_vote_sum(p_option_counts)+greatest(coalesce(p_annulled_votes,0),0)+greatest(coalesce(p_rejected_votes,0),0);
  if v_new <= 0 then raise exception 'Ingrese al menos un voto.'; end if;
  if coalesce(v_validated,0)+coalesce(v_review,0)+v_new > v_expected then
    raise exception 'No puede agregar más votos que el restante de la ciudad.';
  end if;
  v_status := case when p_submit then 'submitted' else 'draft' end;
  insert into public.election_territorial_city_batches(election_id,city,option_counts,annulled_votes,rejected_votes,status,correction_of,submitted_by,submitted_at,created_by)
  values(p_election_id,p_city,coalesce(p_option_counts,'{}'::jsonb),greatest(coalesce(p_annulled_votes,0),0),greatest(coalesce(p_rejected_votes,0),0),v_status,p_correction_of,case when p_submit then auth.uid() else null end,case when p_submit then now() else null end,auth.uid())
  returning id into v_id;
  perform public.log_security_event(case when p_submit then 'ELECTION_CITY_VOTES_SENT_TO_REVIEW' else 'ELECTION_CITY_VOTES_DRAFT_SAVED' end,'election_territorial_city_batches',v_id,case when p_submit then 'Votos territoriales enviados a revisión' else 'Borrador de votos territoriales guardado' end,jsonb_build_object('election_id',p_election_id,'city',p_city,'new_votes',v_new,'validated_before',v_validated,'in_review_before',v_review,'after_review_total',coalesce(v_validated,0)+coalesce(v_review,0)+v_new,'expected_total',v_expected,'correction_of',p_correction_of));
  return v_id;
end $$;
grant execute on function public.save_election_city_vote_batch(uuid,text,jsonb,integer,integer,boolean,uuid) to authenticated;

create or replace function public.review_election_city_vote_batch(p_batch_id uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_batch public.election_territorial_city_batches%rowtype; v_zone public.election_territorial_results%rowtype; v_counts jsonb; v_total numeric; v_percentages jsonb := '{}'::jsonb; v_key text; v_value numeric; v_permission text; v_act uuid;
begin
  select * into v_batch from public.election_territorial_city_batches where id=p_batch_id for update;
  if not found then raise exception 'Lote territorial no disponible'; end if;
  if v_batch.status <> 'submitted' then raise exception 'Solo los lotes en revisión pueden revisarse.'; end if;
  if p_status not in ('validated','returned','rejected') then raise exception 'Estado de lote no permitido'; end if;
  if p_status in ('returned','rejected') and length(trim(coalesce(p_note,''))) < 3 then raise exception 'Explique qué debe corregirse.'; end if;
  v_permission := case when p_status='validated' then 'validar_votos_territoriales' when p_status='returned' then 'devolver_votos_territoriales' else 'rechazar_votos_territoriales' end;
  if not public.can_manage_election(v_batch.election_id,v_permission) then
    perform public.log_security_event('ELECTION_CITY_BATCH_REVIEW_DENIED','election_territorial_city_batches',p_batch_id,'Intento no autorizado de revisar lote territorial',jsonb_build_object('election_id',v_batch.election_id,'city',v_batch.city,'requested_status',p_status));
    raise exception 'No tiene permiso para revisar este lote';
  end if;
  if p_status='validated' then
    select * into v_zone from public.election_territorial_results where election_id=v_batch.election_id and zone_name=v_batch.city for update;
    if not found then raise exception 'La ciudad no tiene total esperado configurado.'; end if;
    v_counts := public.jsonb_vote_add(v_zone.option_counts,v_batch.option_counts);
    v_total := public.jsonb_vote_sum(v_counts)+coalesce(v_zone.annulled_votes,0)+coalesce(v_zone.rejected_votes,0)+v_batch.annulled_votes+v_batch.rejected_votes;
    if v_total > v_zone.expected_votes then raise exception 'No puede agregar más votos que el restante de la ciudad.'; end if;
    for v_key, v_value in select key, value::numeric from jsonb_each_text(v_counts)
    loop
      v_percentages := v_percentages || jsonb_build_object(v_key, round((greatest(v_value,0) / greatest(v_zone.expected_votes,1)::numeric) * 100, 2));
    end loop;
    update public.election_territorial_results
    set option_counts=v_counts,
        annulled_votes=annulled_votes+v_batch.annulled_votes,
        rejected_votes=rejected_votes+v_batch.rejected_votes,
        counted_percentage=least(100,round((v_total / greatest(expected_votes,1)::numeric)*100,2)),
        option_percentages=v_percentages,
        validation_status='validated',
        status=case when v_total>=expected_votes then 'final' else 'preliminar' end,
        validated_by=auth.uid(),
        validated_at=now(),
        updated_by=auth.uid(),
        public_updated_at=now()
    where id=v_zone.id;
  end if;
  update public.election_territorial_city_batches
  set status=p_status, note=nullif(trim(coalesce(p_note,'')),''), reviewed_by=auth.uid(), reviewed_at=now()
  where id=p_batch_id;
  perform public.log_security_event(case when p_status='validated' then 'ELECTION_CITY_BATCH_VALIDATED' when p_status='returned' then 'ELECTION_CITY_BATCH_RETURNED' else 'ELECTION_CITY_BATCH_REJECTED' end,'election_territorial_city_batches',p_batch_id,'Lote territorial revisado',jsonb_build_object('election_id',v_batch.election_id,'city',v_batch.city,'new_status',p_status,'note',nullif(trim(coalesce(p_note,'')),'')));
  if p_status='validated' then
    v_act := public.ensure_election_act_if_complete(v_batch.election_id);
  end if;
  return true;
end $$;
grant execute on function public.review_election_city_vote_batch(uuid,text,text) to authenticated;

create or replace function public.get_election_city_history(p_election_id uuid,p_city text)
returns table(action text, description text, actor_name text, created_at timestamptz, note text, technical jsonb)
language plpgsql stable security definer set search_path=public as $$
begin
  if p_city not in ('Cali','Palmira','Buenaventura','Tuluá') then raise exception 'Ciudad territorial no disponible'; end if;
  if not public.can_manage_election(p_election_id,'ver_historial_municipio') and not public.can_manage_election(p_election_id,'ver_mapa') then
    raise exception 'No tiene permiso para ver historial municipal';
  end if;
  return query
  select l.action::text, l.description::text, coalesce(p.full_name,'Usuario institucional')::text, l.created_at,
    coalesce(l.metadata->>'note', l.metadata->>'new_votes')::text, l.metadata
  from public.audit_logs l
  left join public.profiles p on p.id=l.user_id
  where (l.metadata->>'election_id')=p_election_id::text and (l.metadata->>'city')=p_city
  order by l.created_at desc
  limit 50;
end $$;
grant execute on function public.get_election_city_history(uuid,text) to authenticated;

create or replace function public.create_election_public_update(p_election_id uuid, p_snapshot_type text default 'preliminary', p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_election public.elections%rowtype; v_next integer; v_rows jsonb; v_progress numeric; v_id uuid; v_act uuid;
begin
  if not public.can_manage_election(p_election_id,'actualizar_resultados')
     and not public.can_manage_election(p_election_id,'publicar_actualizacion') then
    raise exception 'No tiene permiso para actualizar resultados electorales';
  end if;
  select * into v_election from public.elections where id=p_election_id;
  if not found then raise exception 'Elección no disponible'; end if;
  if v_election.status not in ('preliminary_results','definitively_closed','final_results_published') then
    update public.elections set status='preliminary_results', results_published_at=now(), updated_by=auth.uid() where id=p_election_id;
    select * into v_election from public.elections where id=p_election_id;
  end if;
  select coalesce(max(update_number),0)+1 into v_next from public.election_public_updates where election_id=p_election_id;
  select coalesce(jsonb_agg(jsonb_build_object('option_id',option_id,'label',card_label,'candidate_name',candidate_name,'percent',public_percent,'display_order',display_order) order by display_order),'[]'::jsonb), coalesce(max(progress_percent),0)
    into v_rows, v_progress
  from public.election_validated_percentage_totals(p_election_id);
  insert into public.election_public_updates(election_id,update_number,snapshot_type,status_at_time,progress_percentage,option_percentages,note,updated_by)
  values(p_election_id,v_next,coalesce(nullif(p_snapshot_type,''),'preliminary'),v_election.status,coalesce(v_progress,0),coalesce(v_rows,'[]'::jsonb),nullif(trim(coalesce(p_note,'')),''),auth.uid())
  returning id into v_id;
  update public.election_territorial_results
  set validation_status='published',
      published_counted_percentage=counted_percentage,
      published_option_percentages=option_percentages,
      published_at=now()
  where election_id=p_election_id and validation_status in ('validated','published');
  update public.election_territorial_city_batches
  set status='published'
  where election_id=p_election_id and status='validated';
  if coalesce(v_progress,0) >= 100 then
    v_act := public.ensure_election_act_if_complete(p_election_id);
  end if;
  perform public.log_security_event('ELECTION_RESULTS_UPDATED','election_public_updates',v_id,'Actualización pública publicada con votos validados',jsonb_build_object('election_id',p_election_id,'update_number',v_next,'snapshot_type',p_snapshot_type,'progress_percent',v_progress,'act_id',v_act));
  return v_id;
end $$;
grant execute on function public.create_election_public_update(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
