alter table public.role_permission_rules drop constraint if exists role_permission_rules_resource_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_resource_check;
alter table public.role_permission_rules add constraint role_permission_rules_resource_check check (resource in (
  'expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones','instituciones','dependencias','perfil','seleccion','elecciones','recordatorios','verificaciones'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_resource_check check (resource in (
  'expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones','instituciones','dependencias','perfil','seleccion','elecciones','recordatorios','verificaciones'
));

alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export','mark_completed','create_minutes','view_institution','view_applications','edit_applications','evaluate_applications','close','update_application_status','edit_public_message','generar_cartas','editar_cartas_publicas',
  'ver','crear','editar','configurar_tarjeta','abrir','suspender','reabrir','cerrar','cerrar_definitivo','votar','ver_votos','validar_votos','anular_votos','gestionar_escrutinio','agregar_votos_manuales','validar_votos_manuales','publicar_preliminares','publicar_resultados','declarar_ganador','ver_auditoria','ver_mapa','editar_mapa','ver_sala_en_vivo','generar_acta','ver_actualizaciones','publicar_actualizacion','ver_agenda','gestionar','generar','revocar','ver_admin'
));

insert into public.role_permission_rules(role, resource, action, allowed)
select role, resource, action, true
from (select distinct role from public.role_permission_rules union select 'SUPER_ADMIN') roles
cross join (values
  ('elecciones','ver_mapa'),('elecciones','editar_mapa'),('elecciones','ver_sala_en_vivo'),('elecciones','generar_acta'),('elecciones','ver_actualizaciones'),('elecciones','publicar_actualizacion'),
  ('audiencias','ver_agenda'),
  ('recordatorios','ver'),('recordatorios','gestionar'),
  ('seleccion','generar_cartas'),('seleccion','editar_cartas_publicas'),
  ('verificaciones','generar'),('verificaciones','revocar'),('verificaciones','ver_admin')
) as p(resource, action)
where role in ('SUPER_ADMIN','ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR','AUXILIAR')
on conflict(role, resource, action) do nothing;

create table if not exists public.election_territorial_results (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  zone_name varchar(120) not null,
  zone_type varchar(80) not null default 'municipio',
  expected_votes integer not null default 100 check(expected_votes >= 1),
  counted_percentage numeric(6,2) not null default 0 check(counted_percentage between 0 and 100),
  option_percentages jsonb not null default '{}'::jsonb,
  status text not null default 'sin_reporte' check(status in ('sin_reporte','en_escrutinio','preliminar','final','observado')),
  updated_by uuid references public.profiles(id) on delete set null,
  public_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(election_id, zone_name)
);
create index if not exists election_territorial_results_election_idx on public.election_territorial_results(election_id, status, zone_name);
drop trigger if exists election_territorial_results_updated on public.election_territorial_results;
create trigger election_territorial_results_updated before update on public.election_territorial_results for each row execute function public.set_updated_at();
alter table public.election_territorial_results enable row level security;
drop policy if exists election_territorial_results_read on public.election_territorial_results;
drop policy if exists election_territorial_results_write on public.election_territorial_results;
create policy election_territorial_results_read on public.election_territorial_results for select to authenticated using(public.can_manage_election(election_id,'ver_mapa'));
create policy election_territorial_results_write on public.election_territorial_results for all to authenticated using(public.can_manage_election(election_id,'editar_mapa')) with check(public.can_manage_election(election_id,'editar_mapa'));
grant select, insert, update on public.election_territorial_results to authenticated;

create or replace view public.public_election_territorial_results with (security_barrier=true) as
select r.election_id, e.slug, r.zone_name, r.zone_type, r.counted_percentage, r.option_percentages, r.status, r.public_updated_at
from public.election_territorial_results r
join public.elections e on e.id = r.election_id
where e.status in ('scrutiny','preliminary_results','definitively_closed','final_results_published');
grant select on public.public_election_territorial_results to anon, authenticated;

create table if not exists public.election_public_updates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  update_number integer not null,
  snapshot_type text not null default 'preliminary' check(snapshot_type in ('preliminary','final','winner','map','act')),
  status_at_time text not null,
  progress_percentage numeric(6,2) not null default 0,
  option_percentages jsonb not null default '[]'::jsonb,
  public_visible boolean not null default true,
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(election_id, update_number)
);
alter table public.election_public_updates enable row level security;
drop policy if exists election_public_updates_read on public.election_public_updates;
drop policy if exists election_public_updates_insert on public.election_public_updates;
create policy election_public_updates_read on public.election_public_updates for select to authenticated using(public.can_manage_election(election_id,'ver_actualizaciones'));
create policy election_public_updates_insert on public.election_public_updates for insert to authenticated with check(public.can_manage_election(election_id,'publicar_actualizacion'));
grant select, insert on public.election_public_updates to authenticated;

create or replace view public.public_election_update_history with (security_barrier=true) as
select u.election_id, e.slug, u.update_number, u.snapshot_type, u.status_at_time, u.progress_percentage, u.option_percentages, u.note, u.updated_at
from public.election_public_updates u
join public.elections e on e.id = u.election_id
where u.public_visible and e.status in ('preliminary_results','definitively_closed','final_results_published');
grant select on public.public_election_update_history to anon, authenticated;

create or replace function public.create_election_public_update(p_election_id uuid, p_snapshot_type text default 'preliminary', p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_election public.elections%rowtype; v_next integer; v_rows jsonb; v_progress numeric; v_id uuid;
begin
  if not public.can_manage_election(p_election_id,'publicar_actualizacion') then raise exception 'No tiene permiso para publicar actualizaciones electorales'; end if;
  select * into v_election from public.elections where id=p_election_id;
  if not found then raise exception 'Elección no disponible'; end if;
  select coalesce(max(update_number),0)+1 into v_next from public.election_public_updates where election_id=p_election_id;
  select coalesce(jsonb_agg(jsonb_build_object('option_id',option_id,'label',card_label,'candidate_name',candidate_name,'percent',public_percent,'display_order',display_order) order by display_order),'[]'::jsonb), coalesce(max(progress_percent),0)
    into v_rows, v_progress
  from public.election_public_percentage_totals(p_election_id);
  insert into public.election_public_updates(election_id,update_number,snapshot_type,status_at_time,progress_percentage,option_percentages,note,updated_by)
  values(p_election_id,v_next,coalesce(nullif(p_snapshot_type,''),'preliminary'),v_election.status,coalesce(v_progress,0),coalesce(v_rows,'[]'::jsonb),nullif(trim(coalesce(p_note,'')),''),auth.uid())
  returning id into v_id;
  perform public.log_security_event('ELECTION_PUBLIC_UPDATE_CREATED','election_public_updates',v_id,'Actualización pública de resultados electorales registrada',jsonb_build_object('election_id',p_election_id,'update_number',v_next,'snapshot_type',p_snapshot_type));
  return v_id;
end $$;
grant execute on function public.create_election_public_update(uuid,text,text) to authenticated;

create or replace function public.upsert_election_zone_result(p_election_id uuid,p_zone_name text,p_zone_type text,p_expected_votes integer,p_counted_percentage numeric,p_option_percentages jsonb,p_status text default 'preliminar')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.can_manage_election(p_election_id,'editar_mapa') then raise exception 'No tiene permiso para actualizar el mapa electoral'; end if;
  insert into public.election_territorial_results(election_id,zone_name,zone_type,expected_votes,counted_percentage,option_percentages,status,updated_by,public_updated_at)
  values(p_election_id,trim(p_zone_name),coalesce(nullif(trim(p_zone_type),''),'municipio'),greatest(coalesce(p_expected_votes,1),1),least(greatest(coalesce(p_counted_percentage,0),0),100),coalesce(p_option_percentages,'{}'::jsonb),coalesce(nullif(p_status,''),'preliminar'),auth.uid(),now())
  on conflict(election_id,zone_name) do update set zone_type=excluded.zone_type,expected_votes=excluded.expected_votes,counted_percentage=excluded.counted_percentage,option_percentages=excluded.option_percentages,status=excluded.status,updated_by=auth.uid(),public_updated_at=now()
  returning id into v_id;
  perform public.log_security_event('ELECTION_MAP_UPDATED','election_territorial_results',v_id,'Mapa territorial electoral actualizado',jsonb_build_object('election_id',p_election_id,'zone_name',p_zone_name));
  return v_id;
end $$;
grant execute on function public.upsert_election_zone_result(uuid,text,text,integer,numeric,jsonb,text) to authenticated;

create table if not exists public.document_verifications (
  id uuid primary key default gen_random_uuid(),
  verification_code varchar(40) not null unique,
  document_type varchar(80) not null,
  source_table varchar(80),
  source_id uuid,
  title text not null,
  institution text,
  status text not null default 'valid' check(status in ('valid','revoked','archived')),
  reserved boolean not null default false,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  public_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists document_verifications_source_idx on public.document_verifications(source_table, source_id);
alter table public.document_verifications enable row level security;
drop policy if exists document_verifications_admin_read on public.document_verifications;
drop policy if exists document_verifications_admin_write on public.document_verifications;
create policy document_verifications_admin_read on public.document_verifications for select to authenticated using(public.has_effective_permission('verificaciones','ver_admin'));
create policy document_verifications_admin_write on public.document_verifications for all to authenticated using(public.has_effective_permission('verificaciones','generar') or public.has_effective_permission('verificaciones','revocar')) with check(public.has_effective_permission('verificaciones','generar') or public.has_effective_permission('verificaciones','revocar'));
grant select, insert, update on public.document_verifications to authenticated;

create or replace function public.public_verification_lookup(p_code text)
returns table(verification_code text,document_type text,title text,institution text,status text,reserved boolean,issued_at timestamptz,public_metadata jsonb)
language sql stable security definer set search_path=public as $$
  select verification_code::text, document_type::text, title::text, institution::text, status::text, reserved, issued_at, public_metadata
  from public.document_verifications
  where upper(verification_code)=upper(trim(coalesce(p_code,'')))
  limit 1
$$;
grant execute on function public.public_verification_lookup(text) to anon, authenticated;

create table if not exists public.election_acts (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  act_type varchar(120) not null default 'Acta General de Escrutinio',
  verification_id uuid references public.document_verifications(id) on delete set null,
  public_summary jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.election_acts enable row level security;
drop policy if exists election_acts_read on public.election_acts;
drop policy if exists election_acts_insert on public.election_acts;
create policy election_acts_read on public.election_acts for select to authenticated using(public.can_manage_election(election_id,'generar_acta'));
create policy election_acts_insert on public.election_acts for insert to authenticated with check(public.can_manage_election(election_id,'generar_acta'));
grant select, insert on public.election_acts to authenticated;

create or replace function public.generate_election_act(p_election_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_election public.elections%rowtype; v_act uuid; v_verification uuid; v_code text; v_rows jsonb; v_institution text;
begin
  if not public.can_manage_election(p_election_id,'generar_acta') then raise exception 'No tiene permiso para generar actas electorales'; end if;
  select * into v_election from public.elections where id=p_election_id;
  if not found then raise exception 'Elección no disponible'; end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by display_order),'[]'::jsonb) into v_rows from public.election_public_percentage_totals(p_election_id) t;
  select d.name into v_institution from public.dependencies d where d.id=v_election.institution_id;
  loop
    v_code := 'SIGJ-ELEC-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    exit when not exists(select 1 from public.document_verifications where verification_code=v_code);
  end loop;
  insert into public.document_verifications(verification_code,document_type,source_table,source_id,title,institution,reserved,issued_by,public_metadata)
  values(v_code,'Acta electoral','election_acts',null,'Acta General de Escrutinio · '||v_election.title,coalesce(v_institution,'Palacio Judicial'),false,auth.uid(),jsonb_build_object('election_id',p_election_id,'office',v_election.office,'territory',v_election.territory,'status',v_election.status))
  returning id into v_verification;
  insert into public.election_acts(election_id,verification_id,public_summary,generated_by)
  values(p_election_id,v_verification,jsonb_build_object('results',coalesce(v_rows,'[]'::jsonb),'status',v_election.status,'office',v_election.office,'territory',v_election.territory,'period',v_election.period,'round_label',v_election.round_label),auth.uid())
  returning id into v_act;
  update public.document_verifications set source_id=v_act where id=v_verification;
  perform public.create_election_public_update(p_election_id,'act','Acta electoral generada');
  perform public.log_security_event('ELECTION_ACT_GENERATED','election_acts',v_act,'Acta General de Escrutinio generada',jsonb_build_object('election_id',p_election_id,'verification_code',v_code));
  return v_act;
end $$;
grant execute on function public.generate_election_act(uuid) to authenticated;

create table if not exists public.selection_application_letters (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.selection_applications(id) on delete cascade,
  process_id uuid not null references public.selection_processes(id) on delete cascade,
  letter_type text not null check(letter_type in ('aceptacion','no_seleccion','entrevista','continuacion')),
  body text not null,
  public_visible boolean not null default true,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists selection_application_letters_updated on public.selection_application_letters;
create trigger selection_application_letters_updated before update on public.selection_application_letters for each row execute function public.set_updated_at();
alter table public.selection_application_letters enable row level security;
drop policy if exists selection_letters_read on public.selection_application_letters;
drop policy if exists selection_letters_write on public.selection_application_letters;
create policy selection_letters_read on public.selection_application_letters for select to authenticated using(exists(select 1 from public.selection_processes p where p.id=process_id and public.can_access_selection_scope(p.institution_id,p.dependency_id,'view_applications')));
create policy selection_letters_write on public.selection_application_letters for all to authenticated using(exists(select 1 from public.selection_processes p where p.id=process_id and public.can_access_selection_scope(p.institution_id,p.dependency_id,'edit_applications')) and public.has_effective_permission('seleccion','generar_cartas')) with check(exists(select 1 from public.selection_processes p where p.id=process_id and public.can_access_selection_scope(p.institution_id,p.dependency_id,'edit_applications')) and public.has_effective_permission('seleccion','generar_cartas'));
grant select, insert, update on public.selection_application_letters to authenticated;

create or replace function public.generate_selection_application_letter(p_application_id uuid,p_letter_type text,p_body text default null,p_public_visible boolean default true)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_app public.selection_applications%rowtype; v_process public.selection_processes%rowtype; v_body text; v_id uuid;
begin
  select * into v_app from public.selection_applications where id=p_application_id;
  if not found then raise exception 'Postulación no disponible'; end if;
  select * into v_process from public.selection_processes where id=v_app.process_id;
  if not public.can_access_selection_scope(v_process.institution_id,v_process.dependency_id,'edit_applications') or not public.has_effective_permission('seleccion','generar_cartas') then raise exception 'No tiene permiso para generar comunicaciones de postulación'; end if;
  v_body := coalesce(nullif(trim(p_body),''), case p_letter_type
    when 'aceptacion' then format('Se informa que la postulación de %s para el cargo %s fue aceptada. El despacho comunicará los pasos siguientes por los canales oficiales.', v_app.applicant_name, v_process.position_title)
    when 'entrevista' then format('La postulación de %s avanzó a etapa de entrevista para el cargo %s. Esté atento a las instrucciones oficiales del despacho.', v_app.applicant_name, v_process.position_title)
    when 'continuacion' then format('La postulación de %s continúa en el proceso de selección para el cargo %s.', v_app.applicant_name, v_process.position_title)
    else format('Se informa que la postulación de %s para el cargo %s no fue seleccionada en esta etapa.', v_app.applicant_name, v_process.position_title)
  end);
  insert into public.selection_application_letters(application_id,process_id,letter_type,body,public_visible,generated_by)
  values(v_app.id,v_app.process_id,p_letter_type,v_body,p_public_visible,auth.uid())
  returning id into v_id;
  if p_public_visible then
    update public.selection_applications set public_message=v_body where id=v_app.id;
  end if;
  perform public.log_security_event('SELECTION_APPLICATION_LETTER_GENERATED','selection_application_letters',v_id,'Comunicación pública de postulación generada',jsonb_build_object('process_id',v_app.process_id,'letter_type',p_letter_type,'public_visible',p_public_visible));
  return v_id;
end $$;
grant execute on function public.generate_selection_application_letter(uuid,text,text,boolean) to authenticated;

do $$
declare v_election uuid;
begin
  select id into v_election from public.elections where slug='eleccion-gobernador-valle-del-cauca-2026' limit 1;
  if v_election is not null then
    insert into public.election_territorial_results(election_id,zone_name,zone_type,expected_votes,counted_percentage,option_percentages,status)
    values
      (v_election,'Cali','municipio',100,0,'{}'::jsonb,'sin_reporte'),
      (v_election,'Palmira','municipio',100,0,'{}'::jsonb,'sin_reporte'),
      (v_election,'Buenaventura','municipio',100,0,'{}'::jsonb,'sin_reporte'),
      (v_election,'Tuluá','municipio',100,0,'{}'::jsonb,'sin_reporte'),
      (v_election,'Cartago','municipio',100,0,'{}'::jsonb,'sin_reporte'),
      (v_election,'Buga','municipio',100,0,'{}'::jsonb,'sin_reporte'),
      (v_election,'Jamundí','municipio',100,0,'{}'::jsonb,'sin_reporte'),
      (v_election,'Yumbo','municipio',100,0,'{}'::jsonb,'sin_reporte'),
      (v_election,'Otros municipios','territorio',100,0,'{}'::jsonb,'sin_reporte')
    on conflict(election_id, zone_name) do nothing;
  end if;
end $$;

notify pgrst,'reload schema';
