create or replace function public.submit_online_vote(
  p_election_id uuid,p_option_id uuid,p_discord_username text,p_discord_id text default null,p_visible_name text default null,p_roblox_username text default null,p_contact_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_election public.elections%rowtype; v_option public.election_options%rowtype; v_norm text; v_duplicate boolean; v_receipt text; v_id uuid;
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
  insert into public.election_votes(election_id,selected_option_id,source,discord_username,discord_id,discord_normalized,visible_name,roblox_username,contact_note,receipt_code,status,duplicate_candidate)
  values(p_election_id,p_option_id,'online',trim(p_discord_username),nullif(trim(coalesce(p_discord_id,'')),''),v_norm,nullif(trim(coalesce(p_visible_name,'')),''),nullif(trim(coalesce(p_roblox_username,'')),''),nullif(trim(coalesce(p_contact_note,'')),''),v_receipt,case when v_duplicate then 'observed' else 'pending_validation' end,v_duplicate)
  returning id into v_id;
  begin
    perform public.log_security_event('ELECTION_ONLINE_VOTE_RECEIVED','election_votes',v_id,'Voto en línea recibido para validación humana',jsonb_build_object('election_id',p_election_id,'duplicate_candidate',v_duplicate));
  exception when others then
    insert into public.audit_logs(user_id,action,table_name,record_id,description,metadata)
    values(null,'ELECTION_ONLINE_VOTE_RECEIVED','election_votes',v_id,'Voto en línea recibido para validación humana',jsonb_build_object('election_id',p_election_id,'duplicate_candidate',v_duplicate,'public_submission',true));
  end;
  return jsonb_build_object('receipt_code',v_receipt,'status',case when v_duplicate then 'observed' else 'pending_validation' end,'duplicate_candidate',v_duplicate);
end $$;
grant execute on function public.submit_online_vote(uuid,uuid,text,text,text,text,text) to anon,authenticated;
notify pgrst,'reload schema';
