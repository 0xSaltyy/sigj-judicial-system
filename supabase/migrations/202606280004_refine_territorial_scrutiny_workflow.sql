alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales','enviar_mapa_escrutinio','ver_votos_territoriales','rechazar_votos_territoriales','devolver_votos_territoriales','ver_historial_municipio'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales','enviar_mapa_escrutinio','ver_votos_territoriales','rechazar_votos_territoriales','devolver_votos_territoriales','ver_historial_municipio'
));

insert into public.role_permission_rules(role, resource, action, allowed)
select role, 'elecciones', action, true
from (select distinct role from public.role_permission_rules union select 'SUPER_ADMIN') roles
cross join (values('devolver_votos_territoriales'),('ver_historial_municipio')) as p(action)
where role in ('SUPER_ADMIN','ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')
on conflict(role, resource, action) do nothing;

alter table public.election_territorial_results
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists review_note text;

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
  p_submit boolean default false
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_id uuid;
  v_counted numeric;
  v_percentages jsonb := '{}'::jsonb;
  v_key text;
  v_value numeric;
  v_previous_status text;
  v_next_status text;
  v_expected integer;
begin
  if not public.can_manage_election(p_election_id,'agregar_votos_territoriales')
     and not public.can_manage_election(p_election_id,'editar_mapa') then
    perform public.log_security_event('ELECTION_MAP_DRAFT_DENIED','election_territorial_results',null,'Intento no autorizado de editar datos territoriales',jsonb_build_object('election_id',p_election_id,'zone_name',p_zone_name));
    raise exception 'No tiene permiso para agregar votos territoriales';
  end if;

  v_expected := greatest(coalesce(p_expected_votes,0),0);
  if p_submit and v_expected <= 0 then
    raise exception 'Debe ingresar el total esperado antes de enviar al escrutinio.';
  end if;

  select validation_status into v_previous_status
  from public.election_territorial_results
  where election_id=p_election_id and zone_name=trim(p_zone_name);

  if p_submit and not public.can_manage_election(p_election_id,'enviar_mapa_escrutinio') then
    perform public.log_security_event('ELECTION_MAP_SUBMIT_DENIED','election_territorial_results',null,'Intento no autorizado de enviar mapa al escrutinio',jsonb_build_object('election_id',p_election_id,'zone_name',p_zone_name));
    raise exception 'No tiene permiso para enviar resultados territoriales al escrutinio';
  end if;

  v_counted := 0;
  for v_key, v_value in select key, value::numeric from jsonb_each_text(coalesce(p_option_counts,'{}'::jsonb))
  loop
    v_counted := v_counted + greatest(v_value,0);
  end loop;
  v_counted := v_counted + greatest(coalesce(p_annulled_votes,0),0) + greatest(coalesce(p_rejected_votes,0),0);

  if v_counted > greatest(v_expected,1) then
    raise exception 'La suma de votos no puede superar el total esperado del municipio.';
  end if;

  for v_key, v_value in select key, value::numeric from jsonb_each_text(coalesce(p_option_counts,'{}'::jsonb))
  loop
    v_percentages := v_percentages || jsonb_build_object(v_key, round((greatest(v_value,0) / greatest(v_expected,1)::numeric) * 100, 2));
  end loop;

  v_next_status := case when p_submit then 'submitted' else 'pending_submission' end;

  insert into public.election_territorial_results(
    election_id, department, zone_name, zone_type, zone_label, expected_votes,
    counted_percentage, option_counts, option_percentages, annulled_votes, rejected_votes,
    status, validation_status, submitted_at, submitted_by, updated_by, public_updated_at, review_note
  )
  values(
    p_election_id,
    coalesce(nullif(trim(p_department),''),'Valle del Cauca'),
    trim(p_zone_name),
    coalesce(nullif(trim(p_zone_type),''),'municipio'),
    nullif(trim(coalesce(p_zone_label,'')),''),
    greatest(v_expected,1),
    least(100, round((v_counted / greatest(v_expected,1)::numeric) * 100, 2)),
    coalesce(p_option_counts,'{}'::jsonb),
    v_percentages,
    greatest(coalesce(p_annulled_votes,0),0),
    greatest(coalesce(p_rejected_votes,0),0),
    case when p_submit then 'en_escrutinio' else 'sin_reporte' end,
    v_next_status,
    case when p_submit then now() else null end,
    case when p_submit then auth.uid() else null end,
    auth.uid(),
    now(),
    null
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
    submitted_by=coalesce(excluded.submitted_by, public.election_territorial_results.submitted_by),
    updated_by=auth.uid(),
    public_updated_at=now(),
    review_note=null
  returning id into v_id;

  perform public.log_security_event(
    case when p_submit and v_previous_status in ('rejected','pending_submission') then 'ELECTION_MAP_RESUBMITTED'
         when p_submit then 'ELECTION_MAP_SENT_TO_SCRUTINY'
         when v_previous_status is null then 'ELECTION_MAP_DRAFT_CREATED'
         else 'ELECTION_MAP_DRAFT_EDITED' end,
    'election_territorial_results',
    v_id,
    case when p_submit then 'Resultado territorial enviado al escrutinio' else 'Resultado territorial guardado como borrador pendiente de envío' end,
    jsonb_build_object('election_id',p_election_id,'zone_name',p_zone_name,'old_status',v_previous_status,'new_status',v_next_status,'counted_percentage',least(100, round((v_counted / greatest(v_expected,1)::numeric) * 100, 2)),'expected_votes',greatest(v_expected,1),'entered_votes',v_counted,'complete',v_counted=greatest(v_expected,1))
  );
  return v_id;
end $$;
grant execute on function public.upsert_election_zone_counts(uuid,text,text,text,text,integer,jsonb,integer,integer,boolean) to authenticated;

create or replace function public.validate_election_zone_result(p_zone_id uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_zone public.election_territorial_results%rowtype; v_permission text; v_next_public_status text; v_action text;
begin
  select * into v_zone from public.election_territorial_results where id=p_zone_id for update;
  if not found then raise exception 'Resultado territorial no disponible'; end if;
  if p_status not in ('validated','rejected','pending_submission','pending_validation','cancelled') then
    raise exception 'Estado territorial no permitido';
  end if;
  if p_status in ('rejected','pending_submission','pending_validation') and length(trim(coalesce(p_note,''))) < 3 then
    raise exception 'Debe registrar una razón o nota para esta decisión.';
  end if;
  v_permission := case
    when p_status='rejected' then 'rechazar_votos_territoriales'
    when p_status='pending_submission' then 'devolver_votos_territoriales'
    else 'validar_votos_territoriales'
  end;
  if not public.can_manage_election(v_zone.election_id,v_permission) then
    perform public.log_security_event('ELECTION_TERRITORIAL_REVIEW_DENIED','election_territorial_results',p_zone_id,'Intento no autorizado de revisar votos territoriales',jsonb_build_object('election_id',v_zone.election_id,'zone_name',v_zone.zone_name,'requested_status',p_status));
    raise exception 'No tiene permiso para revisar votos territoriales';
  end if;
  v_next_public_status := case when p_status='validated' and v_zone.counted_percentage >= 100 then 'final' when p_status='validated' then 'preliminar' when p_status in ('rejected','pending_submission') then 'observado' else 'en_escrutinio' end;
  v_action := case
    when p_status='validated' then 'ELECTION_TERRITORIAL_VOTES_VALIDATED'
    when p_status='rejected' then 'ELECTION_TERRITORIAL_VOTES_REJECTED'
    when p_status='pending_submission' then 'ELECTION_TERRITORIAL_RETURNED_FOR_CORRECTION'
    when p_status='pending_validation' then 'ELECTION_TERRITORIAL_MARKED_IN_REVIEW'
    else 'ELECTION_TERRITORIAL_VOTES_CANCELLED'
  end;
  update public.election_territorial_results
  set validation_status=p_status, validated_by=auth.uid(), validated_at=now(), status=v_next_public_status, review_note=nullif(trim(coalesce(p_note,'')),'')
  where id=p_zone_id;
  perform public.log_security_event(v_action,'election_territorial_results',p_zone_id,'Resultado territorial revisado en escrutinio',jsonb_build_object('election_id',v_zone.election_id,'zone_name',v_zone.zone_name,'old_status',v_zone.validation_status,'new_status',p_status,'note',nullif(trim(coalesce(p_note,'')),'')));
  return true;
end $$;
grant execute on function public.validate_election_zone_result(uuid,text,text) to authenticated;

create or replace function public.get_election_zone_history(p_zone_id uuid)
returns table(action text, description text, actor_name text, created_at timestamptz, old_status text, new_status text, note text)
language plpgsql stable security definer set search_path=public as $$
declare v_election_id uuid;
begin
  select election_id into v_election_id from public.election_territorial_results where id=p_zone_id;
  if v_election_id is null then raise exception 'Resultado territorial no disponible'; end if;
  if not public.can_manage_election(v_election_id,'ver_historial_municipio') and not public.can_manage_election(v_election_id,'ver_mapa') then
    raise exception 'No tiene permiso para ver historial municipal';
  end if;
  return query
  select l.action::text, l.description::text, coalesce(p.full_name,'Usuario institucional')::text, l.created_at,
    (l.metadata->>'old_status')::text, (l.metadata->>'new_status')::text, (l.metadata->>'note')::text
  from public.audit_logs l
  left join public.profiles p on p.id=l.user_id
  where l.table_name='election_territorial_results' and l.record_id=p_zone_id
  order by l.created_at desc
  limit 50;
end $$;
grant execute on function public.get_election_zone_history(uuid) to authenticated;

notify pgrst,'reload schema';
