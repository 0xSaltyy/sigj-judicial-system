-- Módulo de elecciones institucionales: votación, validación humana,
-- escrutinio, resultados y comprobantes con privacidad.

alter table public.role_permission_rules drop constraint if exists role_permission_rules_resource_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_resource_check;
alter table public.role_permission_rules add constraint role_permission_rules_resource_check check (resource in (
  'expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones','instituciones','dependencias','perfil','seleccion','elecciones'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_resource_check check (resource in (
  'expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones','instituciones','dependencias','perfil','seleccion','elecciones'
));

alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria'
));

with permissions(resource,action) as (values
  ('elecciones','ver'),('elecciones','crear'),('elecciones','editar'),('elecciones','configurar_tarjeta'),('elecciones','abrir'),('elecciones','suspender'),('elecciones','reabrir'),('elecciones','cerrar'),('elecciones','cerrar_definitivo'),('elecciones','votar'),('elecciones','ver_votos'),('elecciones','validar_votos'),('elecciones','anular_votos'),('elecciones','gestionar_escrutinio'),('elecciones','agregar_votos_manuales'),('elecciones','validar_votos_manuales'),('elecciones','publicar_preliminares'),('elecciones','publicar_resultados'),('elecciones','declarar_ganador'),('elecciones','ver_auditoria')
), roles(role) as (select unnest(enum_range(null::public.app_role)))
insert into public.role_permission_rules(role,resource,action,allowed)
select role,resource,action,
  case
    when role='SUPER_ADMIN' then true
    when role='ADMIN_INSTITUCIONAL' then action <> 'declarar_ganador'
    when role in ('SECRETARIO_GENERAL','OFICIAL_MAYOR') then action in ('ver','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares')
    when role in ('AUXILIAR','SECRETARIO_DESPACHO') then action in ('ver','votar','ver_votos','gestionar_escrutinio')
    else action in ('ver','votar')
  end
from roles cross join permissions
on conflict(role,resource,action) do nothing;

create table public.elections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title varchar(220) not null,
  office varchar(180) not null,
  territory varchar(160) not null,
  period varchar(80) not null,
  round_label varchar(80) not null default 'Primera vuelta',
  institution_id uuid references public.dependencies(id) on delete restrict,
  status text not null default 'draft' check(status in ('draft','prepared','open','suspended','reopened','closed','scrutiny','preliminary_results','definitively_closed','final_results_published','archived')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  definitive_closed_at timestamptz,
  results_published_at timestamptz,
  winner_published_at timestamptz,
  description text not null,
  instructions text,
  ballot_image_path text,
  ballot_zones jsonb not null default '{}'::jsonb,
  winner_option_id uuid,
  winner_published_by uuid references public.profiles(id) on delete set null,
  final_results_published_by uuid references public.profiles(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint election_dates check(closes_at > opens_at)
);

create table public.election_options (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  option_number integer not null,
  candidate_name varchar(180) not null,
  office_label varchar(180),
  party_name varchar(180),
  party_logo_path text,
  candidate_image_path text,
  ballot_card_image_path text,
  is_blank_vote boolean not null default false,
  active boolean not null default true,
  display_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(election_id, option_number)
);
alter table public.elections add constraint elections_winner_option_fk foreign key (winner_option_id) references public.election_options(id) on delete set null;

create table public.election_votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete restrict,
  selected_option_id uuid not null references public.election_options(id) on delete restrict,
  source text not null default 'online' check(source in ('online','manual')),
  discord_username text,
  discord_id text,
  discord_normalized text,
  visible_name text,
  roblox_username text,
  contact_note text,
  receipt_code text not null unique,
  status text not null default 'pending_validation' check(status in ('pending_validation','valid','observed','annulled','rejected','duplicate','cancelled')),
  duplicate_candidate boolean not null default false,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  internal_note text,
  manual_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index election_votes_election_status_idx on public.election_votes(election_id,status,source);
create index election_votes_discord_idx on public.election_votes(election_id,discord_normalized) where discord_normalized is not null;

create table public.election_manual_vote_batches (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete restrict,
  selected_option_id uuid not null references public.election_options(id) on delete restrict,
  quantity integer not null check(quantity between 1 and 100000),
  source_label varchar(180) not null,
  polling_station varchar(120),
  witness_name varchar(180),
  notes text,
  status text not null default 'pending_validation' check(status in ('draft','submitted','pending_validation','validated','rejected','annulled')),
  entered_by uuid not null references public.profiles(id) on delete restrict,
  entered_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.election_votes add constraint election_votes_manual_batch_fk foreign key (manual_batch_id) references public.election_manual_vote_batches(id) on delete set null;

create table public.election_results_snapshots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  snapshot_type text not null check(snapshot_type in ('preliminary','final','winner')),
  totals jsonb not null,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  note text
);

create trigger elections_updated before update on public.elections for each row execute function public.set_updated_at();
create trigger election_options_updated before update on public.election_options for each row execute function public.set_updated_at();
create trigger election_votes_updated before update on public.election_votes for each row execute function public.set_updated_at();
create trigger election_manual_batches_updated before update on public.election_manual_vote_batches for each row execute function public.set_updated_at();

create or replace function public.can_manage_election(p_election_id uuid, p_action text default 'ver')
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles p
    left join public.elections e on e.id=p_election_id
    where p.id=auth.uid() and p.is_active
      and public.has_effective_permission('elecciones',p_action,p.id)
      and ((p.is_owner and p.role='SUPER_ADMIN') or p.role='SUPER_ADMIN' or e.id is null or p.institution_id is null or e.institution_id is null or e.institution_id=p.institution_id)
  )
$$;
revoke all on function public.can_manage_election(uuid,text) from public,anon;
grant execute on function public.can_manage_election(uuid,text) to authenticated,service_role;

alter table public.elections enable row level security;
alter table public.election_options enable row level security;
alter table public.election_votes enable row level security;
alter table public.election_manual_vote_batches enable row level security;
alter table public.election_results_snapshots enable row level security;

create policy elections_read on public.elections for select to authenticated using(public.can_manage_election(id,'ver'));
create policy elections_insert on public.elections for insert to authenticated with check(public.has_effective_permission('elecciones','crear') and created_by=auth.uid());
create policy elections_update on public.elections for update to authenticated using(public.can_manage_election(id,'editar')) with check(public.can_manage_election(id,'editar'));
create policy election_options_read on public.election_options for select to authenticated using(public.can_manage_election(election_id,'ver'));
create policy election_options_write on public.election_options for all to authenticated using(public.can_manage_election(election_id,'configurar_tarjeta')) with check(public.can_manage_election(election_id,'configurar_tarjeta'));
create policy election_votes_read on public.election_votes for select to authenticated using(public.can_manage_election(election_id,'ver_votos'));
create policy election_votes_update on public.election_votes for update to authenticated using(public.can_manage_election(election_id,'validar_votos') or public.can_manage_election(election_id,'anular_votos')) with check(public.can_manage_election(election_id,'validar_votos') or public.can_manage_election(election_id,'anular_votos'));
create policy election_batches_read on public.election_manual_vote_batches for select to authenticated using(public.can_manage_election(election_id,'ver_votos'));
create policy election_batches_write on public.election_manual_vote_batches for all to authenticated using(public.can_manage_election(election_id,'agregar_votos_manuales') or public.can_manage_election(election_id,'validar_votos_manuales')) with check(public.can_manage_election(election_id,'agregar_votos_manuales') or public.can_manage_election(election_id,'validar_votos_manuales'));
create policy election_snapshots_read on public.election_results_snapshots for select to authenticated using(public.can_manage_election(election_id,'ver'));
create policy election_snapshots_insert on public.election_results_snapshots for insert to authenticated with check(public.can_manage_election(election_id,'publicar_preliminares') or public.can_manage_election(election_id,'publicar_resultados'));

create or replace view public.public_elections with (security_barrier=true) as
select e.id,e.slug,e.title,e.office,e.territory,e.period,e.round_label,e.status,e.opens_at,e.closes_at,e.description,e.instructions,e.ballot_image_path,e.ballot_zones,d.name institution_name
from public.elections e left join public.dependencies d on d.id=e.institution_id
where e.status in ('prepared','open','reopened','closed','scrutiny','preliminary_results','definitively_closed','final_results_published');
grant select on public.public_elections to anon,authenticated;

create or replace view public.public_election_options with (security_barrier=true) as
select o.id,o.election_id,o.option_number,o.candidate_name,o.office_label,o.party_name,o.party_logo_path,o.candidate_image_path,o.ballot_card_image_path,o.is_blank_vote,o.display_order
from public.election_options o join public.elections e on e.id=o.election_id
where o.active and e.status in ('prepared','open','reopened','closed','scrutiny','preliminary_results','definitively_closed','final_results_published');
grant select on public.public_election_options to anon,authenticated;

create or replace function public.election_public_totals(p_election_id uuid)
returns table(option_id uuid,candidate_name text,is_blank_vote boolean,online_valid bigint,manual_valid bigint,total_valid bigint)
language sql stable security definer set search_path=public as $$
  select o.id,o.candidate_name::text,o.is_blank_vote,
    count(v.id) filter(where v.source='online' and v.status='valid')::bigint,
    coalesce(sum(b.quantity) filter(where b.status='validated'),0)::bigint,
    (count(v.id) filter(where v.source='online' and v.status='valid') + coalesce(sum(b.quantity) filter(where b.status='validated'),0))::bigint
  from public.election_options o
  join public.elections e on e.id=o.election_id
  left join public.election_votes v on v.selected_option_id=o.id and v.election_id=o.election_id
  left join public.election_manual_vote_batches b on b.selected_option_id=o.id and b.election_id=o.election_id
  where o.election_id=p_election_id and e.status in ('preliminary_results','definitively_closed','final_results_published') and o.active
  group by o.id,o.candidate_name,o.is_blank_vote,o.display_order
  order by o.display_order
$$;
grant execute on function public.election_public_totals(uuid) to anon,authenticated;

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
  perform public.log_security_event('ELECTION_ONLINE_VOTE_RECEIVED','election_votes',v_id,'Voto en línea recibido para validación humana',jsonb_build_object('election_id',p_election_id,'duplicate_candidate',v_duplicate));
  return jsonb_build_object('receipt_code',v_receipt,'status',case when v_duplicate then 'observed' else 'pending_validation' end,'duplicate_candidate',v_duplicate);
end $$;
grant execute on function public.submit_online_vote(uuid,uuid,text,text,text,text,text) to anon,authenticated;

create or replace function public.lookup_election_receipt(p_receipt_code text,p_discord text)
returns table(election_title text,receipt_code text,submitted_at timestamptz,status text,public_message text)
language sql stable security definer set search_path=public as $$
  select e.title::text,v.receipt_code::text,v.submitted_at,v.status::text,
    case v.status when 'pending_validation' then 'Su voto fue recibido y está pendiente de validación.'
      when 'valid' then 'Su voto fue validado.'
      when 'observed' then 'Su voto se encuentra en revisión.'
      when 'annulled' then 'Su voto fue anulado por decisión autorizada.'
      when 'rejected' then 'Su voto fue rechazado.'
      when 'duplicate' then 'Su voto fue marcado como posible duplicado.'
      else 'Su voto no se encuentra activo.' end
  from public.election_votes v join public.elections e on e.id=v.election_id
  where upper(v.receipt_code)=upper(trim(coalesce(p_receipt_code,'')))
    and v.discord_normalized=lower(regexp_replace(trim(coalesce(p_discord,'')),'\s+','','g'))
  limit 1
$$;
grant execute on function public.lookup_election_receipt(text,text) to anon,authenticated;

create or replace function public.add_manual_vote_batch(p_election_id uuid,p_option_id uuid,p_quantity integer,p_source_label text,p_polling_station text default null,p_witness_name text default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.can_manage_election(p_election_id,'agregar_votos_manuales') then raise exception 'No tiene permiso para agregar votos manuales'; end if;
  insert into public.election_manual_vote_batches(election_id,selected_option_id,quantity,source_label,polling_station,witness_name,notes,entered_by)
  values(p_election_id,p_option_id,p_quantity,trim(p_source_label),nullif(trim(coalesce(p_polling_station,'')),''),nullif(trim(coalesce(p_witness_name,'')),''),nullif(trim(coalesce(p_notes,'')),''),auth.uid()) returning id into v_id;
  perform public.log_security_event('ELECTION_MANUAL_BATCH_CREATED','election_manual_vote_batches',v_id,'Lote manual registrado pendiente de validación',jsonb_build_object('election_id',p_election_id,'quantity',p_quantity));
  return v_id;
end $$;
grant execute on function public.add_manual_vote_batch(uuid,uuid,integer,text,text,text,text) to authenticated;

create or replace function public.review_election_vote(p_vote_id uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_vote public.election_votes%rowtype; v_perm text;
begin
  select * into v_vote from public.election_votes where id=p_vote_id for update;
  if not found then raise exception 'Voto no disponible'; end if;
  v_perm:=case when p_status in ('annulled','rejected','duplicate','cancelled') then 'anular_votos' else 'validar_votos' end;
  if p_status not in ('pending_validation','valid','observed','annulled','rejected','duplicate','cancelled') or not public.can_manage_election(v_vote.election_id,v_perm) then raise exception 'No tiene permiso para revisar este voto'; end if;
  update public.election_votes set status=p_status,internal_note=nullif(trim(coalesce(p_note,'')),''),reviewed_by=auth.uid(),reviewed_at=now() where id=p_vote_id;
  perform public.log_security_event('ELECTION_VOTE_REVIEWED','election_votes',p_vote_id,'Voto revisado durante escrutinio',jsonb_build_object('election_id',v_vote.election_id,'old_status',v_vote.status,'new_status',p_status));
  return true;
end $$;
grant execute on function public.review_election_vote(uuid,text,text) to authenticated;

create or replace function public.review_manual_vote_batch(p_batch_id uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_batch public.election_manual_vote_batches%rowtype;
begin
  select * into v_batch from public.election_manual_vote_batches where id=p_batch_id for update;
  if not found then raise exception 'Lote manual no disponible'; end if;
  if p_status not in ('validated','rejected','annulled','pending_validation') or not public.can_manage_election(v_batch.election_id,'validar_votos_manuales') then raise exception 'No tiene permiso para validar votos manuales'; end if;
  update public.election_manual_vote_batches set status=p_status,notes=coalesce(nullif(trim(coalesce(p_note,'')),''),notes),reviewed_by=auth.uid(),reviewed_at=now() where id=p_batch_id;
  perform public.log_security_event('ELECTION_MANUAL_BATCH_REVIEWED','election_manual_vote_batches',p_batch_id,'Lote manual revisado durante escrutinio',jsonb_build_object('election_id',v_batch.election_id,'old_status',v_batch.status,'new_status',p_status));
  return true;
end $$;
grant execute on function public.review_manual_vote_batch(uuid,text,text) to authenticated;

create or replace function public.publish_election_results(p_election_id uuid,p_kind text,p_winner_option_id uuid default null,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_action text; v_totals jsonb;
begin
  v_action:=case p_kind when 'preliminary' then 'publicar_preliminares' when 'final' then 'publicar_resultados' when 'winner' then 'declarar_ganador' else null end;
  if v_action is null or not public.can_manage_election(p_election_id,v_action) then raise exception 'No tiene permiso para publicar resultados electorales'; end if;
  select jsonb_agg(to_jsonb(t)) into v_totals from public.election_public_totals(p_election_id) t;
  insert into public.election_results_snapshots(election_id,snapshot_type,totals,published_by,note) values(p_election_id,p_kind,coalesce(v_totals,'[]'::jsonb),auth.uid(),nullif(trim(coalesce(p_note,'')),''));
  if p_kind='preliminary' then update public.elections set status='preliminary_results',results_published_at=now(),updated_by=auth.uid() where id=p_election_id;
  elsif p_kind='final' then update public.elections set status='final_results_published',results_published_at=now(),final_results_published_by=auth.uid(),updated_by=auth.uid() where id=p_election_id;
  else update public.elections set winner_option_id=p_winner_option_id,winner_published_at=now(),winner_published_by=auth.uid(),updated_by=auth.uid() where id=p_election_id; end if;
  perform public.log_security_event('ELECTION_RESULTS_PUBLISHED','elections',p_election_id,'Resultados electorales publicados o ganador declarado',jsonb_build_object('kind',p_kind,'winner_option_id',p_winner_option_id));
  return true;
end $$;
grant execute on function public.publish_election_results(uuid,text,uuid,text) to authenticated;

do $$
declare v_institution uuid; v_creator uuid; v_election uuid;
begin
  select id into v_institution from public.dependencies where parent_id is null and is_active and archived_at is null order by created_at limit 1;
  select id into v_creator from public.profiles where is_owner and role='SUPER_ADMIN' limit 1;
  insert into public.elections(slug,title,office,territory,period,round_label,institution_id,status,opens_at,closes_at,description,instructions,ballot_image_path,ballot_zones,created_by)
  values('eleccion-gobernador-valle-del-cauca-2026','Elección de Gobernador del Departamento del Valle del Cauca 2026','Gobernador del Departamento del Valle del Cauca','Valle del Cauca','2026-2026','Primera vuelta',v_institution,'prepared',now()-interval '1 day',now()+interval '30 days','Proceso electoral institucional con validación humana, escrutinio separado y publicación controlada de resultados.','Seleccione una sola opción en la tarjeta electoral. El sistema marcará una X sobre la casilla escogida y pedirá confirmación antes de registrar el voto.','/VOTACIONES/CARTA DE VOTACION.png','{"left":{"x":8,"y":18,"w":28,"h":65},"center":{"x":36,"y":18,"w":28,"h":65},"right":{"x":68,"y":18,"w":24,"h":65}}'::jsonb,v_creator)
  on conflict(slug) do update set ballot_image_path=excluded.ballot_image_path, ballot_zones=excluded.ballot_zones
  returning id into v_election;
  insert into public.election_options(election_id,option_number,candidate_name,office_label,party_name,candidate_image_path,ballot_card_image_path,is_blank_vote,display_order)
  values
    (v_election,1,'Barak Obama Junior','Candidato a Gobernador','Movimiento Institucional','/VOTACIONES/CANDIDATO 1.png','/VOTACIONES/CANDIDATO 1.png',false,1),
    (v_election,2,'Antonio Barbosa','Candidato a Gobernador','Movimiento Ciudadano','/VOTACIONES/CANDIDATO 2.png','/VOTACIONES/CANDIDATO 2.png',false,2),
    (v_election,3,'Voto en blanco','Opción electoral','Voto en blanco',null,null,true,3)
  on conflict(election_id,option_number) do update set candidate_name=excluded.candidate_name,office_label=excluded.office_label,party_name=excluded.party_name,candidate_image_path=excluded.candidate_image_path,ballot_card_image_path=excluded.ballot_card_image_path,is_blank_vote=excluded.is_blank_vote,display_order=excluded.display_order;
end $$;

notify pgrst,'reload schema';
