alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales'
));

insert into public.role_permission_rules(role, resource, action, allowed)
select role, 'elecciones', action, true
from (select distinct role from public.role_permission_rules union select 'SUPER_ADMIN') roles
cross join (values('actualizar_resultados'),('agregar_votos_territoriales'),('validar_votos_territoriales')) as p(action)
where role in ('SUPER_ADMIN','ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')
on conflict(role, resource, action) do nothing;

alter table public.election_territorial_results
  add column if not exists department varchar(120) not null default 'Valle del Cauca',
  add column if not exists zone_label varchar(160),
  add column if not exists option_counts jsonb not null default '{}'::jsonb,
  add column if not exists annulled_votes integer not null default 0 check(annulled_votes >= 0),
  add column if not exists rejected_votes integer not null default 0 check(rejected_votes >= 0),
  add column if not exists submitted_at timestamptz,
  add column if not exists validated_by uuid references public.profiles(id) on delete set null,
  add column if not exists validated_at timestamptz,
  add column if not exists validation_status text not null default 'draft' check(validation_status in ('draft','submitted','validated','rejected'));

drop view if exists public.public_election_territorial_results;
create view public.public_election_territorial_results with (security_barrier=true) as
select r.election_id, e.slug, r.department, r.zone_name, r.zone_label, r.zone_type, r.counted_percentage, r.option_percentages, r.status, r.public_updated_at
from public.election_territorial_results r
join public.elections e on e.id = r.election_id
where e.status in ('scrutiny','preliminary_results','definitively_closed','final_results_published')
  and r.validation_status in ('submitted','validated');
grant select on public.public_election_territorial_results to anon, authenticated;

create or replace function public.upsert_election_zone_counts(
  p_election_id uuid,
  p_department text,
  p_zone_name text,
  p_zone_type text,
  p_zone_label text,
  p_expected_votes integer,
  p_option_counts jsonb,
  p_annulled_votes integer default 0,
  p_rejected_votes integer default 0,
  p_submit boolean default true
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_id uuid;
  v_counted numeric;
  v_percentages jsonb := '{}'::jsonb;
  v_key text;
  v_value numeric;
begin
  if not public.can_manage_election(p_election_id,'agregar_votos_territoriales')
     and not public.can_manage_election(p_election_id,'editar_mapa') then
    raise exception 'No tiene permiso para agregar votos territoriales';
  end if;

  v_counted := 0;
  for v_key, v_value in select key, value::numeric from jsonb_each_text(coalesce(p_option_counts,'{}'::jsonb))
  loop
    v_counted := v_counted + greatest(v_value,0);
  end loop;
  v_counted := v_counted + greatest(coalesce(p_annulled_votes,0),0) + greatest(coalesce(p_rejected_votes,0),0);

  for v_key, v_value in select key, value::numeric from jsonb_each_text(coalesce(p_option_counts,'{}'::jsonb))
  loop
    v_percentages := v_percentages || jsonb_build_object(v_key, round((greatest(v_value,0) / greatest(coalesce(p_expected_votes,1),1)::numeric) * 100, 2));
  end loop;

  insert into public.election_territorial_results(
    election_id, department, zone_name, zone_type, zone_label, expected_votes,
    counted_percentage, option_counts, option_percentages, annulled_votes, rejected_votes,
    status, validation_status, submitted_at, updated_by, public_updated_at
  )
  values(
    p_election_id,
    coalesce(nullif(trim(p_department),''),'Valle del Cauca'),
    trim(p_zone_name),
    coalesce(nullif(trim(p_zone_type),''),'municipio'),
    nullif(trim(coalesce(p_zone_label,'')),''),
    greatest(coalesce(p_expected_votes,1),1),
    least(100, round((v_counted / greatest(coalesce(p_expected_votes,1),1)::numeric) * 100, 2)),
    coalesce(p_option_counts,'{}'::jsonb),
    v_percentages,
    greatest(coalesce(p_annulled_votes,0),0),
    greatest(coalesce(p_rejected_votes,0),0),
    case when least(100, round((v_counted / greatest(coalesce(p_expected_votes,1),1)::numeric) * 100, 2)) >= 100 then 'final' when p_submit then 'preliminar' else 'en_escrutinio' end,
    case when p_submit then 'submitted' else 'draft' end,
    case when p_submit then now() else null end,
    auth.uid(),
    now()
  )
  on conflict(election_id, zone_name) do update set
    department=excluded.department,
    zone_type=excluded.zone_type,
    zone_label=excluded.zone_label,
    expected_votes=excluded.expected_votes,
    counted_percentage=excluded.counted_percentage,
    option_counts=excluded.option_counts,
    option_percentages=excluded.option_percentages,
    annulled_votes=excluded.annulled_votes,
    rejected_votes=excluded.rejected_votes,
    status=excluded.status,
    validation_status=excluded.validation_status,
    submitted_at=excluded.submitted_at,
    updated_by=auth.uid(),
    public_updated_at=now()
  returning id into v_id;

  perform public.log_security_event('ELECTION_TERRITORIAL_VOTES_ENTERED','election_territorial_results',v_id,'Votos territoriales ingresados o actualizados',jsonb_build_object('election_id',p_election_id,'zone_name',p_zone_name,'submitted',p_submit,'counted_percentage',least(100, round((v_counted / greatest(coalesce(p_expected_votes,1),1)::numeric) * 100, 2))));
  return v_id;
end $$;
grant execute on function public.upsert_election_zone_counts(uuid,text,text,text,text,integer,jsonb,integer,integer,boolean) to authenticated;

create or replace function public.validate_election_zone_result(p_zone_id uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_zone public.election_territorial_results%rowtype;
begin
  select * into v_zone from public.election_territorial_results where id=p_zone_id for update;
  if not found then raise exception 'Resultado territorial no disponible'; end if;
  if p_status not in ('validated','rejected','submitted') or not public.can_manage_election(v_zone.election_id,'validar_votos_territoriales') then
    raise exception 'No tiene permiso para validar votos territoriales';
  end if;
  update public.election_territorial_results
  set validation_status=p_status, validated_by=auth.uid(), validated_at=now(), status=case when p_status='validated' and counted_percentage >= 100 then 'final' when p_status='validated' then 'preliminar' when p_status='rejected' then 'observado' else status end
  where id=p_zone_id;
  perform public.log_security_event('ELECTION_TERRITORIAL_VOTES_VALIDATED','election_territorial_results',p_zone_id,'Resultado territorial validado o rechazado',jsonb_build_object('election_id',v_zone.election_id,'old_status',v_zone.validation_status,'new_status',p_status,'note',nullif(trim(coalesce(p_note,'')),'')));
  return true;
end $$;
grant execute on function public.validate_election_zone_result(uuid,text,text) to authenticated;

create or replace function public.election_public_percentage_totals(p_election_id uuid)
returns table(option_id uuid,candidate_name text,is_blank_vote boolean,display_order integer,card_label text,ballot_card_image_path text,candidate_image_path text,public_percent numeric,progress_percent numeric,results_updated_at timestamptz)
language sql stable security definer set search_path=public as $$
  with totals as (
    select * from public.election_public_totals(p_election_id)
  ), territorial as (
    select coalesce(sum((value)::numeric),0)::numeric as option_total
    from public.election_territorial_results r, jsonb_each_text(r.option_counts)
    where r.election_id=p_election_id and r.validation_status='validated'
  ), election as (
    select id,total_expected_votes,coalesce(results_published_at,updated_at,created_at) as updated_at
    from public.elections where id=p_election_id and status in ('preliminary_results','definitively_closed','final_results_published')
  ), sum_total as (
    select (coalesce(sum(total_valid),0)::numeric + coalesce((select option_total from territorial),0)) as counted from totals
  )
  select o.id,o.candidate_name::text,o.is_blank_vote,o.display_order,
    ('Tarjeta Electoral '||o.display_order)::text,
    o.ballot_card_image_path::text,o.candidate_image_path::text,
    round(((coalesce(t.total_valid,0)::numeric + coalesce((
      select sum((r.option_counts ->> o.id::text)::numeric)
      from public.election_territorial_results r
      where r.election_id=o.election_id and r.validation_status='validated' and r.option_counts ? o.id::text
    ),0)) / greatest(e.total_expected_votes,1)::numeric) * 100, 2),
    round((s.counted / greatest(e.total_expected_votes,1)::numeric) * 100, 2),
    e.updated_at
  from election e
  join public.election_options o on o.election_id=e.id and o.active
  left join totals t on t.option_id=o.id
  cross join sum_total s
  order by o.display_order
$$;
grant execute on function public.election_public_percentage_totals(uuid) to anon,authenticated;

create or replace function public.ensure_election_act_if_complete(p_election_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_progress numeric; v_existing uuid; v_new uuid;
begin
  select max(progress_percent) into v_progress from public.election_public_percentage_totals(p_election_id);
  if coalesce(v_progress,0) < 100 then return null; end if;
  select id into v_existing from public.election_acts where election_id=p_election_id order by generated_at desc limit 1;
  if v_existing is not null then return v_existing; end if;
  v_new := public.generate_election_act(p_election_id);
  perform public.log_security_event('ELECTION_100_PERCENT_REACHED','elections',p_election_id,'Escrutinio alcanzó el 100% y se preparó acta electoral',jsonb_build_object('progress_percent',v_progress,'act_id',v_new));
  return v_new;
end $$;
grant execute on function public.ensure_election_act_if_complete(uuid) to authenticated;

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
  from public.election_public_percentage_totals(p_election_id);
  insert into public.election_public_updates(election_id,update_number,snapshot_type,status_at_time,progress_percentage,option_percentages,note,updated_by)
  values(p_election_id,v_next,coalesce(nullif(p_snapshot_type,''),'preliminary'),v_election.status,coalesce(v_progress,0),coalesce(v_rows,'[]'::jsonb),nullif(trim(coalesce(p_note,'')),''),auth.uid())
  returning id into v_id;
  if coalesce(v_progress,0) >= 100 then
    v_act := public.ensure_election_act_if_complete(p_election_id);
  end if;
  perform public.log_security_event('ELECTION_RESULTS_UPDATED','election_public_updates',v_id,'Resultados electorales calculados y actualización pública registrada',jsonb_build_object('election_id',p_election_id,'update_number',v_next,'snapshot_type',p_snapshot_type,'progress_percent',v_progress,'act_id',v_act));
  return v_id;
end $$;
grant execute on function public.create_election_public_update(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
