alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','analizar_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales','enviar_mapa_escrutinio','ver_votos_territoriales','rechazar_votos_territoriales','devolver_votos_territoriales','ver_historial_municipio','configurar_totales_territoriales','editar_total_esperado','eliminar_actualizaciones',
  'configurar_total_esperado','agregar_votos','revisar_votos','devolver_votos','rechazar_votos','publicar_resultados_definitivos'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','analizar_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin','actualizar_resultados','agregar_votos_territoriales','validar_votos_territoriales','enviar_mapa_escrutinio','ver_votos_territoriales','rechazar_votos_territoriales','devolver_votos_territoriales','ver_historial_municipio','configurar_totales_territoriales','editar_total_esperado','eliminar_actualizaciones',
  'configurar_total_esperado','agregar_votos','revisar_votos','devolver_votos','rechazar_votos','publicar_resultados_definitivos'
));

insert into public.role_permission_rules(role, resource, action, allowed)
select role, 'elecciones', 'analizar_votos', role::text in ('SUPER_ADMIN','ADMIN_INSTITUCIONAL')
from (
  select unnest(enum_range(null::public.app_role)) role
) roles
on conflict(role, resource, action) do nothing;

alter table public.election_votes add column if not exists ip_hash text;
alter table public.election_votes add column if not exists user_agent_hash text;
alter table public.election_votes add column if not exists device_hint_hash text;
create index if not exists election_votes_ip_hash_idx on public.election_votes(election_id,ip_hash) where ip_hash is not null;
create index if not exists election_votes_user_agent_hash_idx on public.election_votes(election_id,user_agent_hash) where user_agent_hash is not null;
create index if not exists election_votes_device_hint_hash_idx on public.election_votes(election_id,device_hint_hash) where device_hint_hash is not null;

create or replace function public.submit_online_vote(
  p_election_id uuid,
  p_option_id uuid,
  p_discord_username text,
  p_discord_id text default null,
  p_visible_name text default null,
  p_roblox_username text default null,
  p_contact_note text default null,
  p_ip_hash text default null,
  p_user_agent_hash text default null,
  p_device_hint_hash text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_election public.elections%rowtype;
  v_option public.election_options%rowtype;
  v_norm text;
  v_duplicate boolean;
  v_receipt text;
  v_id uuid;
begin
  v_norm:=lower(regexp_replace(trim(coalesce(nullif(p_discord_id,''),p_discord_username,'')),'\s+','','g'));
  if length(v_norm)<2 then raise exception 'Usuario de Discord requerido'; end if;
  select * into v_election from public.elections where id=p_election_id and status in ('open','reopened') and now() between opens_at and closes_at;
  if not found then raise exception 'La elección no está abierta para votación'; end if;
  select * into v_option from public.election_options where id=p_option_id and election_id=p_election_id and active;
  if not found then raise exception 'Opción electoral no disponible'; end if;
  select exists(select 1 from public.election_votes where election_id=p_election_id and discord_normalized=v_norm and status <> 'cancelled') into v_duplicate;
  loop
    v_receipt := 'VOTO-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    exit when not exists(select 1 from public.election_votes where receipt_code=v_receipt);
  end loop;
  insert into public.election_votes(
    election_id,selected_option_id,source,discord_username,discord_id,discord_normalized,visible_name,roblox_username,contact_note,receipt_code,status,duplicate_candidate,ip_hash,user_agent_hash,device_hint_hash
  )
  values(
    p_election_id,p_option_id,'online',trim(p_discord_username),nullif(trim(coalesce(p_discord_id,'')),''),v_norm,nullif(trim(coalesce(p_visible_name,'')),''),nullif(trim(coalesce(p_roblox_username,'')),''),nullif(trim(coalesce(p_contact_note,'')),''),v_receipt,case when v_duplicate then 'observed' else 'pending_validation' end,v_duplicate,nullif(trim(coalesce(p_ip_hash,'')),''),nullif(trim(coalesce(p_user_agent_hash,'')),''),nullif(trim(coalesce(p_device_hint_hash,'')),'')
  )
  returning id into v_id;
  perform public.log_security_event('ELECTION_ONLINE_VOTE_RECEIVED','election_votes',v_id,'Voto en línea recibido para validación humana',jsonb_build_object('election_id',p_election_id,'duplicate_candidate',v_duplicate,'metadata_hashes',jsonb_build_object('ip',p_ip_hash is not null,'user_agent',p_user_agent_hash is not null,'device_hint',p_device_hint_hash is not null)));
  begin
    insert into public.audit_logs(actor_id,action,table_name,record_id,description,metadata)
    values(null,'ELECTION_ONLINE_VOTE_RECEIVED','election_votes',v_id,'Voto en línea recibido para validación humana',jsonb_build_object('election_id',p_election_id,'duplicate_candidate',v_duplicate,'public_submission',true,'metadata_hashes',jsonb_build_object('ip',p_ip_hash is not null,'user_agent',p_user_agent_hash is not null,'device_hint',p_device_hint_hash is not null)));
  exception when undefined_table then
    null;
  end;
  return jsonb_build_object('receipt_code',v_receipt,'status',case when v_duplicate then 'observed' else 'pending_validation' end,'duplicate_candidate',v_duplicate);
end $$;

revoke all on function public.submit_online_vote(uuid,uuid,text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_online_vote(uuid,uuid,text,text,text,text,text,text,text,text) to anon,authenticated;

notify pgrst, 'reload schema';
