-- DOJ Roleplay · Identificación realista de registros.
-- Migración compatible: no elimina ni renombra columnas heredadas.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create table if not exists public.matters (
  id uuid primary key default gen_random_uuid(),
  matter_number text not null unique,
  division_id uuid references public.dependencies(id) on delete set null,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  matter_type text not null default 'Asunto interno',
  title text not null,
  summary text,
  status text not null default 'Abierto',
  access_level text not null default 'Interno' check (access_level in ('Público','Interno','Reservado','Confidencial')),
  opened_at timestamptz not null default now(),
  converted_case_id uuid references public.cases(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.foia_requests (
  id uuid primary key default gen_random_uuid(),
  foia_tracking_number text not null unique,
  component_code text not null default 'DOJ',
  received_at timestamptz not null default now(),
  requester_name text not null,
  records_description text not null,
  date_range text,
  status text not null default 'Recibida' check (status in ('Recibida','En revisión inicial','Asignada','Búsqueda de registros','Procesamiento','Información adicional requerida','Respuesta parcial','Completada','Denegada','Cerrada','En apelación')),
  estimated_response_at timestamptz,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  complexity_level text,
  delivered_documents jsonb not null default '[]',
  exemptions_applied jsonb not null default '[]',
  correspondence jsonb not null default '[]',
  closed_at timestamptz,
  related_case_id uuid references public.cases(id) on delete set null,
  access_level text not null default 'Interno' check (access_level in ('Público','Interno','Reservado','Confidencial')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.cases add column if not exists case_number text;
alter table public.cases add column if not exists docket_number text;
alter table public.cases add column if not exists docket_court text;
alter table public.cases add column if not exists docket_district text;
alter table public.cases add column if not exists docket_division text;
alter table public.cases add column if not exists docket_assigned_at timestamptz;
alter table public.cases add column if not exists docket_recorded_by uuid references public.profiles(id) on delete set null;
alter table public.cases add column if not exists filing_status text not null default 'Sin presentación judicial';
alter table public.cases add column if not exists matter_id uuid references public.matters(id) on delete set null;

alter table public.roleplay_applications add column if not exists application_number text;
alter table public.roleplay_applications add column if not exists tracking_number text;
alter table public.roleplay_applications add column if not exists private_access_code text;

alter table public.complaints add column if not exists reference_number text;

alter table public.roleplay_warrants add column if not exists docket_number text;
alter table public.roleplay_warrants add column if not exists matter_id uuid references public.matters(id) on delete set null;

create unique index if not exists cases_case_number_key on public.cases(case_number) where case_number is not null;
create unique index if not exists cases_docket_number_key on public.cases(docket_number) where docket_number is not null;
create index if not exists cases_matter_id_idx on public.cases(matter_id);
create unique index if not exists roleplay_applications_application_number_key on public.roleplay_applications(application_number) where application_number is not null;
create unique index if not exists roleplay_applications_tracking_number_key on public.roleplay_applications(tracking_number) where tracking_number is not null;
create unique index if not exists complaints_reference_number_key on public.complaints(reference_number) where reference_number is not null;
create index if not exists roleplay_warrants_matter_id_idx on public.roleplay_warrants(matter_id);

create or replace function public.identification_case_type_code(p_process_type text)
returns text
language sql
immutable
as $$
  select case
    when unaccent(lower(coalesce(p_process_type, ''))) like '%penal%' or lower(coalesce(p_process_type, '')) like '%criminal%' then 'CR'
    when unaccent(lower(coalesce(p_process_type, ''))) like '%civil%' then 'CV'
    when unaccent(lower(coalesce(p_process_type, ''))) like '%apel%' or lower(coalesce(p_process_type, '')) like '%appeal%' then 'AP'
    else 'MC'
  end
$$;

create or replace function public.generate_case_number_for_date(
  p_process_type text,
  p_opened_at timestamptz default now()
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := public.identification_case_type_code(p_process_type);
  v_year text := to_char(coalesce(p_opened_at, now()), 'YYYY');
  v_scope text;
  v_initial bigint;
  v_next bigint;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Autenticación institucional requerida';
  end if;

  v_scope := 'case-number:' || v_type || ':' || v_year;

  select greatest(
    100000,
    coalesce(max(substring(c.case_number from ('^RP-' || v_type || '-' || v_year || '-([0-9]{6})$'))::bigint), 0),
    coalesce(max(substring(c.internal_number from ('^RP-' || v_type || '-' || v_year || '-([0-9]{6})$'))::bigint), 0)
  )
    into v_initial
    from public.cases c;

  v_next := public.next_case_number_counter(v_scope, v_initial);
  return format('RP-%s-%s-%s', v_type, v_year, lpad(v_next::text, 6, '0'));
end;
$$;

create or replace function public.generate_matter_number_for_date(
  p_division_code text default 'MAT',
  p_opened_at timestamptz default now()
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_division text := upper(regexp_replace(coalesce(p_division_code, 'MAT'), '[^A-Za-z0-9]', '', 'g'));
  v_year text := to_char(coalesce(p_opened_at, now()), 'YYYY');
  v_scope text;
  v_initial bigint;
  v_next bigint;
begin
  if nullif(v_division, '') is null then v_division := 'MAT'; end if;
  v_scope := 'matter-number:' || v_division || ':' || v_year;
  select greatest(100000, coalesce(max(substring(m.matter_number from ('^RP-' || v_division || '-MAT-' || v_year || '-([0-9]{6})$'))::bigint), 0))
    into v_initial
    from public.matters m;
  v_next := public.next_case_number_counter(v_scope, v_initial);
  return format('RP-%s-MAT-%s-%s', v_division, v_year, lpad(v_next::text, 6, '0'));
end;
$$;

create or replace function public.generate_reference_number(p_prefix text default 'REF')
returns text
language sql
security definer
set search_path = public
as $$
  select format('RP-%s-%s-%s',
    upper(regexp_replace(coalesce(nullif(p_prefix, ''), 'REF'), '[^A-Za-z0-9]', '', 'g')),
    to_char(now(), 'YYYY'),
    upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10))
  )
$$;

create or replace function public.generate_tracking_number(p_prefix text default 'REQ')
returns text
language sql
security definer
set search_path = public
as $$
  select format('RP-%s-%s-%s',
    upper(regexp_replace(coalesce(nullif(p_prefix, ''), 'REQ'), '[^A-Za-z0-9]', '', 'g')),
    to_char(now(), 'YYYY'),
    upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=', 'XYZ'), 1, 6))
  )
$$;

create or replace function public.generate_application_number_for_date(p_submitted_at timestamptz default now())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(coalesce(p_submitted_at, now()), 'YYYY');
  v_next bigint;
begin
  v_next := public.next_case_number_counter('application-number:' || v_year, 100000);
  return format('RP-APP-%s-%s', v_year, lpad(v_next::text, 6, '0'));
end;
$$;

create or replace function public.generate_foia_tracking_number_for_date(
  p_component_code text default 'DOJ',
  p_received_at timestamptz default now()
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_component text := upper(regexp_replace(coalesce(p_component_code, 'DOJ'), '[^A-Za-z0-9]', '', 'g'));
  v_year text := to_char(coalesce(p_received_at, now()), 'YYYY');
  v_next bigint;
begin
  if nullif(v_component, '') is null then v_component := 'DOJ'; end if;
  v_next := public.next_case_number_counter('foia-number:' || v_component || ':' || v_year, 100000);
  return format('RP-%s-FOIA-%s-%s', v_component, v_year, lpad(v_next::text, 6, '0'));
end;
$$;

revoke all on function public.generate_case_number_for_date(text, timestamptz) from public, anon;
revoke all on function public.generate_matter_number_for_date(text, timestamptz) from public, anon;
revoke all on function public.generate_application_number_for_date(timestamptz) from public, anon;
revoke all on function public.generate_foia_tracking_number_for_date(text, timestamptz) from public, anon;
grant execute on function public.generate_case_number_for_date(text, timestamptz) to authenticated, service_role;
grant execute on function public.generate_matter_number_for_date(text, timestamptz) to authenticated, service_role;
grant execute on function public.generate_application_number_for_date(timestamptz) to authenticated, service_role;
grant execute on function public.generate_foia_tracking_number_for_date(text, timestamptz) to authenticated, service_role;

create or replace function public.set_case_identifiers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.case_number, '')), '') is null then
    new.case_number := public.generate_case_number_for_date(new.process_type, new.filed_at);
  end if;
  new.case_number := upper(trim(new.case_number));
  if nullif(trim(coalesce(new.filing_status, '')), '') is null then
    new.filing_status := 'Sin presentación judicial';
  end if;
  new.docket_number := nullif(upper(trim(coalesce(new.docket_number, ''))), '');
  return new;
end;
$$;

create or replace function public.prevent_case_number_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.case_number is not null and new.case_number is distinct from old.case_number then
    raise exception 'El número de caso no puede modificarse después de la creación';
  end if;
  return new;
end;
$$;

drop trigger if exists set_case_identifiers_before_insert on public.cases;
create trigger set_case_identifiers_before_insert
before insert on public.cases
for each row execute function public.set_case_identifiers();

drop trigger if exists prevent_case_number_update_before_update on public.cases;
create trigger prevent_case_number_update_before_update
before update on public.cases
for each row execute function public.prevent_case_number_update();

create or replace function public.set_roleplay_application_identifiers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.application_number, '')), '') is null then
    new.application_number := public.generate_application_number_for_date(new.submitted_at);
  end if;
  if nullif(trim(coalesce(new.tracking_number, '')), '') is null then
    new.tracking_number := public.generate_tracking_number('APP');
  end if;
  if nullif(trim(coalesce(new.tracking_code, '')), '') is null then
    new.tracking_code := new.tracking_number;
  end if;
  new.application_number := upper(trim(new.application_number));
  new.tracking_number := upper(trim(new.tracking_number));
  return new;
end;
$$;

drop trigger if exists set_roleplay_application_identifiers_before_insert on public.roleplay_applications;
create trigger set_roleplay_application_identifiers_before_insert
before insert on public.roleplay_applications
for each row execute function public.set_roleplay_application_identifiers();

create or replace function public.set_complaint_identifiers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.tracking_number, '')), '') is null or new.tracking_number like 'DEN-%' then
    new.tracking_number := public.generate_tracking_number('CMP');
  end if;
  if nullif(trim(coalesce(new.reference_number, '')), '') is null then
    new.reference_number := public.generate_reference_number('CMP-REF');
  end if;
  new.tracking_number := upper(trim(new.tracking_number));
  new.reference_number := upper(trim(new.reference_number));
  return new;
end;
$$;

drop trigger if exists set_complaint_identifiers_before_insert on public.complaints;
create trigger set_complaint_identifiers_before_insert
before insert on public.complaints
for each row execute function public.set_complaint_identifiers();

create or replace function public.set_matter_identifier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := 'MAT';
begin
  if new.division_id is not null then
    select coalesce(nullif(code, ''), 'MAT') into v_code from public.dependencies where id = new.division_id;
  end if;
  if nullif(trim(coalesce(new.matter_number, '')), '') is null then
    new.matter_number := public.generate_matter_number_for_date(v_code, new.opened_at);
  end if;
  new.matter_number := upper(trim(new.matter_number));
  return new;
end;
$$;

drop trigger if exists set_matter_identifier_before_insert on public.matters;
create trigger set_matter_identifier_before_insert
before insert on public.matters
for each row execute function public.set_matter_identifier();

create or replace function public.set_foia_identifier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.foia_tracking_number, '')), '') is null then
    new.foia_tracking_number := public.generate_foia_tracking_number_for_date(new.component_code, new.received_at);
  end if;
  new.foia_tracking_number := upper(trim(new.foia_tracking_number));
  return new;
end;
$$;

drop trigger if exists set_foia_identifier_before_insert on public.foia_requests;
create trigger set_foia_identifier_before_insert
before insert on public.foia_requests
for each row execute function public.set_foia_identifier();

update public.cases
   set case_number = coalesce(case_number, internal_number),
       filing_status = coalesce(nullif(filing_status, ''), 'Sin presentación judicial')
 where archived_at is null
   and (case_number is null or nullif(filing_status, '') is null);

with numbered as (
  select id, row_number() over (order by submitted_at, id) as rn
  from public.roleplay_applications
  where application_number is null
)
update public.roleplay_applications a
   set application_number = format('RP-APP-%s-%s', to_char(a.submitted_at, 'YYYY'), lpad((100000 + numbered.rn)::text, 6, '0')),
       tracking_number = coalesce(a.tracking_number, public.generate_tracking_number('APP'))
  from numbered
 where a.id = numbered.id;

update public.roleplay_applications
   set tracking_number = coalesce(tracking_number, public.generate_tracking_number('APP'))
 where tracking_number is null;

update public.complaints
   set reference_number = coalesce(reference_number, public.generate_reference_number('CMP-REF'))
 where reference_number is null;

drop function if exists public.lookup_roleplay_application_status(text);

create or replace function public.lookup_roleplay_application_status(p_tracking_code text)
returns table(
  tracking_code text,
  tracking_number text,
  application_number text,
  applicant_name text,
  application_type text,
  status text,
  submitted_at timestamptz,
  updated_at timestamptz,
  public_message text
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(a.tracking_number, a.tracking_code)::text as tracking_code,
    coalesce(a.tracking_number, a.tracking_code)::text as tracking_number,
    a.application_number::text,
    a.applicant_name::text,
    a.application_type::text,
    a.status::text,
    a.submitted_at,
    a.updated_at,
    a.public_message::text
  from public.roleplay_applications a
  where (
      upper(coalesce(a.tracking_number, '')) = upper(trim(coalesce(p_tracking_code, '')))
      or upper(a.tracking_code) = upper(trim(coalesce(p_tracking_code, '')))
    )
    and a.archived_at is null
  limit 1
$$;

revoke all on function public.lookup_roleplay_application_status(text) from public;
grant execute on function public.lookup_roleplay_application_status(text) to anon, authenticated;

drop view if exists public.public_case_lookup;
create view public.public_case_lookup with (security_barrier = true) as
select
  c.id,
  coalesce(c.case_number, c.internal_number) as case_number,
  c.internal_number,
  c.docket_number,
  c.judicial_number,
  c.docket_court,
  c.docket_district,
  c.docket_division,
  c.docket_assigned_at,
  c.filing_status,
  c.title,
  c.chamber,
  c.process_type,
  c.process_subtype,
  c.status,
  c.filed_at,
  d.name as institution_name
from public.cases c
left join public.dependencies d on d.id = c.dependency_id
where c.public_visibility
  and c.confidentiality_level = 'Público'
  and c.archived_at is null;

drop view if exists public.public_hearings;
create view public.public_hearings with (security_barrier = true) as
select h.id, h.case_id, h.title, h.hearing_type, h.scheduled_at, h.end_at, h.room, h.status,
       coalesce(c.case_number, c.internal_number) as case_number,
       c.internal_number, c.docket_number, c.judicial_number, c.chamber
from public.hearings h join public.cases c on c.id = h.case_id
where h.is_public and h.archived_at is null and c.archived_at is null
  and c.public_visibility and c.confidentiality_level = 'Público';

drop view if exists public.public_proceedings;
create view public.public_proceedings with (security_barrier = true) as
select p.id, p.case_id, p.providence_number, p.title, p.type, p.chamber,
       p.content_markdown, p.published_at,
       coalesce(c.case_number, c.internal_number) as case_number,
       c.internal_number, c.docket_number, c.judicial_number
from public.proceedings p join public.cases c on c.id = p.case_id
where p.status = 'Publicado' and p.visibility = 'public' and p.archived_at is null
  and c.archived_at is null and c.public_visibility and c.confidentiality_level = 'Público';

grant select on public.public_case_lookup, public.public_hearings, public.public_proceedings to anon, authenticated;

drop trigger if exists matters_updated on public.matters;
create trigger matters_updated before update on public.matters for each row execute function public.set_updated_at();
drop trigger if exists foia_requests_updated on public.foia_requests;
create trigger foia_requests_updated before update on public.foia_requests for each row execute function public.set_updated_at();

drop trigger if exists audit_matters on public.matters;
create trigger audit_matters after insert or update or delete on public.matters for each row execute function public.audit_change();
drop trigger if exists audit_foia_requests on public.foia_requests;
create trigger audit_foia_requests after insert or update or delete on public.foia_requests for each row execute function public.audit_change();

alter table public.matters enable row level security;
alter table public.foia_requests enable row level security;

drop policy if exists matters_staff_access on public.matters;
create policy matters_staff_access on public.matters
for all to authenticated
using (public.is_active_internal())
with check (public.is_active_internal());

drop policy if exists foia_staff_access on public.foia_requests;
create policy foia_staff_access on public.foia_requests
for all to authenticated
using (public.is_active_internal())
with check (public.is_active_internal());

do $$
begin
  alter publication supabase_realtime add table public.matters;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.foia_requests;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
