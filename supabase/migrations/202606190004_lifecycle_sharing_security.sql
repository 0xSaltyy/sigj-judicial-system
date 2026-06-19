-- Ciclo de vida, compartición interna y refuerzo de privacidad.

alter table public.dependencies add column if not exists archived_at timestamptz;
alter table public.dependencies add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.dependencies add column if not exists archived_status text;
alter table public.radications add column if not exists archived_at timestamptz;
alter table public.radications add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.case_actions add column if not exists archived_at timestamptz;
alter table public.case_actions add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.documents add column if not exists archived_at timestamptz;
alter table public.documents add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.hearings add column if not exists archived_at timestamptz;
alter table public.hearings add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.hearings add column if not exists archived_status text;
alter table public.hearings alter column room drop not null;
alter table public.proceedings add column if not exists archived_at timestamptz;
alter table public.proceedings add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.proceedings add column if not exists archived_status text;
alter table public.public_notices add column if not exists archived_at timestamptz;
alter table public.public_notices add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.public_notices add column if not exists archived_status text;
alter table public.judicial_states add column if not exists archived_at timestamptz;
alter table public.judicial_states add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.judicial_states add column if not exists archived_status text;
alter table public.cases add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table public.cases add column if not exists archived_status text;

create table if not exists public.record_shares (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('case','proceeding','document')),
  resource_id uuid not null,
  case_id uuid not null references public.cases(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete cascade,
  target_role public.app_role,
  target_dependency_id uuid references public.dependencies(id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint record_share_single_target check (
    num_nonnulls(target_user_id, target_role, target_dependency_id) = 1
  )
);
create index if not exists record_shares_case_idx on public.record_shares(case_id, expires_at) where revoked_at is null;
create index if not exists record_shares_resource_idx on public.record_shares(resource_type, resource_id) where revoked_at is null;
alter table public.record_shares enable row level security;

create or replace function public.has_active_case_share(p_case_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.record_shares s
    join public.profiles p on p.id = auth.uid() and p.is_active
    where s.case_id = p_case_id
      and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now())
      and (
        s.target_user_id = p.id
        or s.target_role = p.role
        or (s.target_dependency_id is not null and s.target_dependency_id = p.dependency_id)
      )
  )
$$;
revoke all on function public.has_active_case_share(uuid) from public, anon;
grant execute on function public.has_active_case_share(uuid) to authenticated;

create or replace function public.can_access_case(p_case_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cases c
    join public.profiles p on p.id = auth.uid() and p.is_active
    where c.id = p_case_id and (
      (p.is_owner and p.role = 'SUPER_ADMIN')
      or p.role in ('SUPER_ADMIN','SECRETARIO_GENERAL','RADICADOR','REPARTO','ARCHIVO')
      or (p.role = 'ADMIN_INSTITUCIONAL' and c.dependency_id = p.dependency_id)
      or (p.role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL') and c.assigned_judge_id = p.id)
      or (p.role in ('SECRETARIO_DESPACHO','OFICIAL_MAYOR') and c.dependency_id = p.dependency_id)
      or public.has_active_case_share(c.id)
    )
  )
$$;
revoke all on function public.can_access_case(uuid) from public, anon;
grant execute on function public.can_access_case(uuid) to authenticated;

drop policy if exists record_shares_read on public.record_shares;
create policy record_shares_read on public.record_shares for select to authenticated using (
  public.is_owner() or shared_by = auth.uid() or target_user_id = auth.uid()
  or target_role = public.current_role() or target_dependency_id = public.current_dependency_id()
);
drop policy if exists record_shares_insert on public.record_shares;
create policy record_shares_insert on public.record_shares for insert to authenticated with check (
  shared_by = auth.uid() and public.can_access_case(case_id)
  and (public.is_owner() or public.current_role() in (
    'SUPER_ADMIN','ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL',
    'JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR','ARCHIVO'
  ))
);
drop policy if exists record_shares_revoke on public.record_shares;
create policy record_shares_revoke on public.record_shares for update to authenticated
using (public.is_owner() or shared_by = auth.uid())
with check (public.is_owner() or shared_by = auth.uid());

create or replace function public.log_security_event(
  p_action text,
  p_table text,
  p_record_id uuid,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), left(p_action, 100), left(p_table, 100), p_record_id, left(p_description, 500), coalesce(p_metadata, '{}'::jsonb));
end $$;
revoke all on function public.log_security_event(text, text, uuid, text, jsonb) from public, anon;
grant execute on function public.log_security_event(text, text, uuid, text, jsonb) to authenticated;

-- Defensa en profundidad: incluso una llamada directa a PostgREST no puede saltarse
-- la confirmación y auditoría del flujo de borrado permanente.
create or replace function public.block_non_owner_hard_delete() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.is_owner() and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'El borrado permanente está reservado al propietario del sistema';
  end if;
  return old;
end $$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'cases','radications','case_actions','documents','hearings','proceedings',
    'public_notices','judicial_states','dependencies'
  ] loop
    execute format('drop trigger if exists protect_%I_hard_delete on public.%I', v_table, v_table);
    execute format(
      'create trigger protect_%I_hard_delete before delete on public.%I for each row execute function public.block_non_owner_hard_delete()',
      v_table,
      v_table
    );
  end loop;
end $$;

create or replace function public.manage_record_lifecycle(
  p_resource text,
  p_record_id uuid,
  p_operation text,
  p_confirmation text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := public.current_role();
  v_owner boolean := public.is_owner();
  v_allowed boolean := false;
  v_table text;
  v_status_column boolean := false;
  v_exists boolean := false;
  v_error text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Autenticación requerida'); end if;
  if p_resource not in ('cases','radications','case_actions','documents','hearings','proceedings','public_notices','judicial_states','dependencies') then
    perform public.log_security_event('LIFECYCLE_DENIED', p_resource, p_record_id, 'Tipo de registro no permitido', jsonb_build_object('operation', p_operation));
    return jsonb_build_object('ok', false, 'error', 'Tipo de registro no permitido');
  end if;
  if p_operation not in ('archive','restore','delete') then
    return jsonb_build_object('ok', false, 'error', 'Operación no permitida');
  end if;

  v_table := p_resource;
  v_status_column := p_resource in ('cases','hearings','proceedings','public_notices','judicial_states');
  execute format('select exists(select 1 from public.%I where id = $1)', v_table) into v_exists using p_record_id;
  if not v_exists then return jsonb_build_object('ok', false, 'error', 'Registro no encontrado'); end if;

  if p_operation in ('restore','delete') then
    v_allowed := v_owner;
  elsif v_owner then
    v_allowed := true;
  elsif p_resource in ('cases','radications','documents') then
    v_allowed := v_role = 'ARCHIVO';
  elsif p_resource = 'case_actions' then
    v_allowed := v_role in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR');
  elsif p_resource = 'hearings' then
    v_allowed := v_role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO');
  elsif p_resource = 'proceedings' then
    v_allowed := v_role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_DESPACHO');
  elsif p_resource = 'public_notices' then
    v_allowed := v_role in ('SECRETARIO_GENERAL','GOBERNACION_COMUNICACIONES');
  elsif p_resource = 'judicial_states' then
    v_allowed := v_role in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO');
  end if;

  if not v_allowed then
    perform public.log_security_event('LIFECYCLE_DENIED', v_table, p_record_id, 'Intento de operación sin permiso', jsonb_build_object('operation', p_operation, 'role', v_role));
    return jsonb_build_object('ok', false, 'error', 'No tiene permiso para realizar esta operación');
  end if;
  if p_operation = 'delete' and p_confirmation is distinct from 'ELIMINAR DEFINITIVAMENTE' then
    perform public.log_security_event('HARD_DELETE_DENIED', v_table, p_record_id, 'Confirmación escrita incorrecta', '{}'::jsonb);
    return jsonb_build_object('ok', false, 'error', 'Escriba ELIMINAR DEFINITIVAMENTE para confirmar');
  end if;

  begin
    if p_operation = 'archive' then
      if v_status_column then
        execute format('update public.%I set archived_status = status, archived_at = now(), archived_by = auth.uid(), status = %L where id = $1 and archived_at is null', v_table, 'Archivado') using p_record_id;
      elsif p_resource = 'dependencies' then
        execute 'update public.dependencies set archived_status = case when is_active then ''Activa'' else ''Inactiva'' end, archived_at = now(), archived_by = auth.uid(), is_active = false where id = $1 and archived_at is null' using p_record_id;
      else
        execute format('update public.%I set archived_at = now(), archived_by = auth.uid() where id = $1 and archived_at is null', v_table) using p_record_id;
      end if;
    elsif p_operation = 'restore' then
      if v_status_column then
        execute format('update public.%I set status = coalesce(archived_status, %L), archived_status = null, archived_at = null, archived_by = null where id = $1 and archived_at is not null', v_table, 'Borrador') using p_record_id;
      elsif p_resource = 'dependencies' then
        execute 'update public.dependencies set is_active = true, archived_status = null, archived_at = null, archived_by = null where id = $1 and archived_at is not null' using p_record_id;
      else
        execute format('update public.%I set archived_at = null, archived_by = null where id = $1 and archived_at is not null', v_table) using p_record_id;
      end if;
    else
      if p_resource = 'cases' and exists(select 1 from public.documents where case_id = p_record_id) then
        return jsonb_build_object('ok', false, 'error', 'El expediente conserva documentos; archívelo para preservar la integridad judicial');
      end if;
      execute format('delete from public.%I where id = $1', v_table) using p_record_id;
    end if;
  exception when others then
    v_error := sqlerrm;
    perform public.log_security_event('LIFECYCLE_FAILED', v_table, p_record_id, 'La operación no pudo completarse', jsonb_build_object('operation', p_operation, 'error', v_error));
    return jsonb_build_object('ok', false, 'error', v_error);
  end;

  perform public.log_security_event(
    case p_operation when 'archive' then 'RECORD_ARCHIVED' when 'restore' then 'RECORD_RESTORED' else 'RECORD_HARD_DELETED' end,
    v_table,
    p_record_id,
    case p_operation when 'archive' then 'Registro archivado' when 'restore' then 'Registro restaurado' else 'Registro eliminado definitivamente' end,
    jsonb_build_object('operation', p_operation)
  );
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.manage_record_lifecycle(text, uuid, text, text) from public, anon;
grant execute on function public.manage_record_lifecycle(text, uuid, text, text) to authenticated;

-- El propietario puede restaurar expedientes archivados; los demás solo actualizan registros activos.
drop policy if exists cases_update on public.cases;
create policy cases_update on public.cases for update to authenticated using (
  public.can_access_case(id) and (
    public.is_owner() or (
      archived_at is null and public.current_role() in ('ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','RADICADOR','REPARTO','ARCHIVO')
    )
  )
) with check (public.can_access_case(id));

create or replace view public.public_case_lookup with (security_barrier = true) as
select c.id, c.internal_number, c.judicial_number, c.title, c.chamber, c.process_type,
       c.process_subtype, c.status, c.filed_at, d.name as institution_name
from public.cases c left join public.dependencies d on d.id = c.dependency_id
where c.public_visibility and c.confidentiality_level = 'Público' and c.archived_at is null;

create or replace view public.public_case_actions with (security_barrier = true) as
select a.id, a.case_id, a.action_type, a.title, a.description, a.action_date
from public.case_actions a join public.cases c on c.id = a.case_id
where a.visibility = 'public' and a.archived_at is null and c.archived_at is null
  and c.public_visibility and c.confidentiality_level = 'Público';

create or replace view public.public_hearings with (security_barrier = true) as
select h.id, h.case_id, h.title, h.hearing_type, h.scheduled_at, h.end_at, h.room, h.status,
       c.internal_number, c.judicial_number, c.chamber
from public.hearings h join public.cases c on c.id = h.case_id
where h.is_public and h.archived_at is null and c.archived_at is null
  and c.public_visibility and c.confidentiality_level = 'Público';

create or replace view public.public_institutions with (security_barrier = true) as
select id, parent_id, name, code, type, level, competence, jurisdiction, route_slug
from public.dependencies where is_active and archived_at is null;

create or replace view public.public_proceedings with (security_barrier = true) as
select p.id, p.case_id, p.providence_number, p.title, p.type, p.chamber,
       p.content_markdown, p.published_at, c.internal_number, c.judicial_number
from public.proceedings p join public.cases c on c.id = p.case_id
where p.status = 'Publicado' and p.visibility = 'public' and p.archived_at is null
  and c.archived_at is null and c.public_visibility and c.confidentiality_level = 'Público';

create or replace view public.public_states with (security_barrier = true) as
select s.id, s.state_number, s.state_date, s.published_at, d.name as institution_name,
       count(c.id)::integer as item_count
from public.judicial_states s
join public.dependencies d on d.id = s.dependency_id
left join public.judicial_state_items i on i.judicial_state_id = s.id
left join public.cases c on c.id = i.case_id
  and c.archived_at is null and c.public_visibility and c.confidentiality_level = 'Público'
where s.status = 'Publicado' and s.archived_at is null
group by s.id, s.state_number, s.state_date, s.published_at, d.name;

drop policy if exists state_items_public_read on public.judicial_state_items;
create policy state_items_public_read on public.judicial_state_items for select using (
  public.is_active_internal() or exists (
    select 1
    from public.judicial_states s
    join public.cases c on c.id = judicial_state_items.case_id
    where s.id = judicial_state_items.judicial_state_id
      and s.status = 'Publicado'
      and s.archived_at is null
      and c.archived_at is null
      and c.public_visibility
      and c.confidentiality_level = 'Público'
  )
);

grant select on public.public_case_lookup, public.public_case_actions, public.public_hearings,
  public.public_institutions, public.public_proceedings, public.public_states to anon, authenticated;
