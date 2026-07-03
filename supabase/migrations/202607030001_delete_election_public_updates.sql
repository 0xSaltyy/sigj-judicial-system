alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales','enviar_mapa_escrutinio','ver_votos_territoriales','rechazar_votos_territoriales','devolver_votos_territoriales','ver_historial_municipio','configurar_totales_territoriales','editar_total_esperado','eliminar_actualizaciones'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales','enviar_mapa_escrutinio','ver_votos_territoriales','rechazar_votos_territoriales','devolver_votos_territoriales','ver_historial_municipio','configurar_totales_territoriales','editar_total_esperado','eliminar_actualizaciones'
));

insert into public.role_permission_rules(role, resource, action, allowed)
select role, 'elecciones', 'eliminar_actualizaciones', true
from (select distinct role from public.role_permission_rules union select 'SUPER_ADMIN') roles
where role in ('SUPER_ADMIN','ADMIN_INSTITUCIONAL')
on conflict(role, resource, action) do nothing;

create table if not exists public.election_public_update_territorial_snapshots (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.election_public_updates(id) on delete cascade,
  election_id uuid not null references public.elections(id) on delete cascade,
  department text not null default 'Valle del Cauca',
  zone_name text not null,
  zone_label text,
  zone_type text not null default 'ciudad',
  counted_percentage numeric(6,2) not null check(counted_percentage between 0 and 100),
  option_percentages jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(update_id, zone_name)
);
create index if not exists election_public_update_territorial_update_idx on public.election_public_update_territorial_snapshots(update_id, election_id);
alter table public.election_public_update_territorial_snapshots enable row level security;
drop policy if exists election_public_update_territorial_read on public.election_public_update_territorial_snapshots;
create policy election_public_update_territorial_read on public.election_public_update_territorial_snapshots for select to authenticated using(public.can_manage_election(election_id,'ver_actualizaciones') or public.can_manage_election(election_id,'ver_mapa'));
grant select on public.election_public_update_territorial_snapshots to authenticated;

drop view if exists public.public_election_territorial_results;
create view public.public_election_territorial_results with (security_barrier=true) as
with latest_one as (
  select distinct on (election_id) id, election_id, updated_at
  from public.election_public_updates
  where public_visible
  order by election_id, update_number desc
)
select s.election_id, e.slug, s.department, s.zone_name, s.zone_label, s.zone_type,
  s.counted_percentage, s.option_percentages, 'published'::text as status, l.updated_at as public_updated_at
from public.election_public_update_territorial_snapshots s
join latest_one l on l.id=s.update_id
join public.elections e on e.id=s.election_id
where e.status in ('preliminary_results','definitively_closed','final_results_published');
grant select on public.public_election_territorial_results to anon, authenticated;

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

  select count(*) into v_bad_count
  from public.election_territorial_results
  where election_id=p_election_id
    and validation_status in ('validated','published')
    and (counted_percentage > 100 or public.jsonb_vote_sum(option_counts)+annulled_votes+rejected_votes > expected_votes);
  if coalesce(v_bad_count,0) > 0 then
    perform public.log_security_event('ELECTION_PUBLIC_UPDATE_BLOCKED','election_public_updates',null,'Se bloqueó publicación territorial con votos superiores al total esperado',jsonb_build_object('election_id',p_election_id,'bad_territorial_rows',v_bad_count));
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

  insert into public.election_public_update_territorial_snapshots(update_id,election_id,department,zone_name,zone_label,zone_type,counted_percentage,option_percentages)
  select v_id, r.election_id, r.department, r.zone_name, r.zone_label, r.zone_type, least(100,r.counted_percentage), coalesce(r.option_percentages,'{}'::jsonb)
  from public.election_territorial_results r
  where r.election_id=p_election_id and r.validation_status in ('validated','published');

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

create or replace function public.delete_election_public_update(p_update_id uuid, p_confirmation text, p_reason text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_update public.election_public_updates%rowtype; v_election public.elections%rowtype;
begin
  if trim(coalesce(p_confirmation,'')) <> 'ELIMINAR' then
    raise exception 'Debe escribir ELIMINAR para confirmar.';
  end if;
  select * into v_update from public.election_public_updates where id=p_update_id for update;
  if not found then raise exception 'Actualización electoral no disponible'; end if;
  if not public.can_manage_election(v_update.election_id,'eliminar_actualizaciones') then
    perform public.log_security_event('ELECTION_PUBLIC_UPDATE_DELETE_DENIED','election_public_updates',p_update_id,'Intento no autorizado de eliminar actualización electoral',jsonb_build_object('election_id',v_update.election_id,'update_number',v_update.update_number));
    raise exception 'No tiene permiso para eliminar actualizaciones electorales';
  end if;
  select * into v_election from public.elections where id=v_update.election_id;
  perform public.log_security_event(
    'ELECTION_PUBLIC_UPDATE_DELETED',
    'election_public_updates',
    p_update_id,
    'Actualización electoral eliminada definitivamente',
    jsonb_build_object(
      'election_id',v_update.election_id,
      'election_title',v_election.title,
      'deleted_update_id',v_update.id,
      'update_number',v_update.update_number,
      'snapshot_type',v_update.snapshot_type,
      'status_at_time',v_update.status_at_time,
      'progress_percentage',v_update.progress_percentage,
      'updated_at',v_update.updated_at,
      'note',v_update.note,
      'reason',nullif(trim(coalesce(p_reason,'')),'')
    )
  );
  delete from public.election_public_updates where id=p_update_id;
  if not exists(select 1 from public.election_public_updates where election_id=v_update.election_id and public_visible) then
    update public.election_territorial_results
    set published_counted_percentage=null, published_option_percentages=null, published_at=null
    where election_id=v_update.election_id;
  end if;
  return v_update.election_id;
end $$;
grant execute on function public.delete_election_public_update(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
