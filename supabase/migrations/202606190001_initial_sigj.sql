-- SIGJ / Palacio Judicial · esquema inicial completo
-- Diseñado para un proyecto Supabase nuevo. Aplicar con `supabase db push`.
create extension if not exists pgcrypto;

create type public.app_role as enum (
  'SUPER_ADMIN', 'ADMIN_INSTITUCIONAL', 'MAGISTRADO_CORTE_SUPREMA',
  'MAGISTRADO_TRIBUNAL', 'JUEZ_CIRCUITO', 'JUEZ_MUNICIPAL',
  'SECRETARIO_GENERAL', 'SECRETARIO_DESPACHO', 'OFICIAL_MAYOR',
  'RADICADOR', 'REPARTO', 'ARCHIVO', 'GOBERNACION_COMUNICACIONES',
  'CONSULTA_PUBLICA'
);
create type public.visibility_level as enum ('public', 'internal', 'reserved');

-- La tabla dependencies representa instituciones, cortes, salas, juzgados y oficinas.
create table public.dependencies (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.dependencies(id) on delete restrict,
  name text not null,
  code text not null unique,
  type text not null,
  level smallint not null default 1 check (level between 1 and 10),
  competence text not null,
  jurisdiction text not null,
  route_slug text not null unique,
  document_templates text[] not null default '{}',
  department text not null default 'República Judicial ficticia',
  municipality text not null default 'Distrito Capital Simulado',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.app_role not null default 'CONSULTA_PUBLICA',
  dependency_id uuid references public.dependencies(id) on delete restrict,
  position_title text,
  is_active boolean not null default true,
  is_owner boolean not null default false,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_must_be_super_admin check (not is_owner or (role = 'SUPER_ADMIN' and is_active))
);
create unique index profiles_email_lower_idx on public.profiles (lower(email));
create unique index single_system_owner_idx on public.profiles ((is_owner)) where is_owner;

create table public.role_permissions (
  role public.app_role primary key,
  label text not null,
  scope_description text not null,
  permissions jsonb not null default '[]'::jsonb,
  can_manage_users boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  internal_number text not null unique,
  judicial_number text not null unique,
  title text not null,
  authority_type text not null,
  chamber text not null,
  process_type text not null,
  process_subtype text not null,
  claimant_name text not null,
  defendant_name text not null,
  summary text not null,
  claims text not null,
  amount numeric(18,2),
  department text not null,
  municipality text not null,
  reception_method text not null,
  confidentiality_level text not null check (confidentiality_level in ('Público','Reservado','Confidencial')),
  status text not null default 'Radicado',
  assigned_judge_id uuid references public.profiles(id) on delete set null,
  dependency_id uuid references public.dependencies(id) on delete restrict,
  public_visibility boolean not null default false,
  filed_at timestamptz not null default now(),
  observations text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index cases_internal_number_idx on public.cases(internal_number);
create index cases_judicial_number_idx on public.cases(judicial_number);
create index cases_status_dependency_idx on public.cases(status, dependency_id);
create index cases_assigned_judge_idx on public.cases(assigned_judge_id);

create table public.radications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  received_by uuid references auth.users(id) on delete set null,
  received_at timestamptz not null default now(),
  reception_method text not null,
  validated_at timestamptz,
  validation_status text not null default 'Pendiente',
  distribution_method text check (distribution_method in ('Automático','Manual')),
  distributed_by uuid references auth.users(id) on delete set null,
  distributed_at timestamptz,
  destination_dependency_id uuid references public.dependencies(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);

create table public.case_parties (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null,
  party_type text not null,
  document_type text,
  document_number text,
  email text,
  phone text,
  address text,
  is_confidential boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  providence_id uuid,
  uploaded_by uuid references auth.users(id) on delete set null,
  title text not null,
  file_path text not null unique,
  file_type text not null,
  visibility public.visibility_level not null default 'internal',
  checksum text,
  created_at timestamptz not null default now()
);

create table public.case_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  action_type text not null,
  title text not null,
  description text not null,
  visibility public.visibility_level not null default 'internal',
  created_by uuid references auth.users(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  action_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index case_actions_case_date_idx on public.case_actions(case_id, action_date desc);

create table public.hearings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  hearing_type text not null,
  scheduled_at timestamptz not null,
  end_at timestamptz,
  room text not null,
  virtual_link text,
  status text not null default 'Programada',
  is_public boolean not null default false,
  participants jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.proceedings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  providence_number text not null unique,
  title text not null,
  type text not null,
  chamber text not null,
  judge_id uuid references public.profiles(id) on delete set null,
  content_markdown text not null,
  status text not null default 'Borrador',
  visibility public.visibility_level not null default 'internal',
  signed_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_proceeding_check check (status <> 'Publicado' or (published_at is not null and length(content_markdown) > 0))
);
alter table public.documents add constraint documents_providence_fk foreign key (providence_id) references public.proceedings(id) on delete cascade;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  recipient_name text not null,
  recipient_email text,
  notification_type text not null,
  status text not null default 'Pendiente',
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  certificate_number text not null unique,
  certificate_type text not null,
  content text not null,
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz not null default now(),
  document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.public_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null,
  issuing_entity text not null,
  content_markdown text not null,
  image_path text,
  status text not null default 'Borrador',
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_notice_check check (status <> 'Publicado' or (published_at is not null and length(title) > 0 and length(content_markdown) > 0))
);

create table public.judicial_states (
  id uuid primary key default gen_random_uuid(),
  state_number text not null unique,
  dependency_id uuid not null references public.dependencies(id) on delete restrict,
  state_date date not null,
  status text not null default 'Borrador',
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(dependency_id, state_date)
);

create table public.judicial_state_items (
  id uuid primary key default gen_random_uuid(),
  judicial_state_id uuid not null references public.judicial_states(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  case_action_id uuid references public.case_actions(id) on delete set null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  description text not null,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_target_user_idx on public.audit_logs(target_user_id, created_at desc);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Funciones de identidad. SECURITY DEFINER evita recursión de RLS.
create or replace function public.current_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;
create or replace function public.current_dependency_id() returns uuid
language sql stable security definer set search_path = public as $$
  select dependency_id from public.profiles where id = auth.uid() and is_active
$$;
create or replace function public.is_active_internal() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active)
$$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active and is_owner and role = 'SUPER_ADMIN')
$$;

-- Todo usuario Auth obtiene un perfil mínimo; nunca se confía en metadatos para elevar privilegios.
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email, role, is_active, is_owner)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), 'Usuario interno'),
    coalesce(new.email, new.id::text || '@auth.local'),
    'CONSULTA_PUBLICA', true, false
  ) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger dependencies_updated before update on public.dependencies for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger cases_updated before update on public.cases for each row execute function public.set_updated_at();
create trigger hearings_updated before update on public.hearings for each row execute function public.set_updated_at();
create trigger proceedings_updated before update on public.proceedings for each row execute function public.set_updated_at();
create trigger notices_updated before update on public.public_notices for each row execute function public.set_updated_at();

-- El propietario no puede eliminarse, desactivarse, degradarse ni cambiar de institución.
-- Las mutaciones privilegiadas de perfiles exigen la sesión del propietario.
create or replace function public.guard_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.is_owner then raise exception 'The owner account cannot be deleted'; end if;
    if auth.uid() is not null and not public.is_owner() then raise exception 'Only the owner may delete profiles'; end if;
    return old;
  end if;

  if old.is_owner and (
    not new.is_owner or new.role <> 'SUPER_ADMIN' or not new.is_active
    or new.dependency_id is distinct from old.dependency_id
  ) then raise exception 'The owner account is protected'; end if;

  if (
    old.role is distinct from new.role or old.is_active is distinct from new.is_active
    or old.email is distinct from new.email
    or old.dependency_id is distinct from new.dependency_id or old.is_owner is distinct from new.is_owner
  ) and auth.uid() is not null and not public.is_owner() then
    raise exception 'Only the owner may change user access';
  end if;
  return new;
end $$;
create trigger profiles_privilege_guard before update or delete on public.profiles for each row execute function public.guard_profile_privileges();

create or replace function public.guard_case_security() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.confidentiality_level in ('Reservado','Confidencial') then new.public_visibility := false; end if;
  if tg_op = 'UPDATE' and old.archived_at is not null and not public.is_owner() then raise exception 'Archived cases are read-only'; end if;
  return new;
end $$;
create trigger cases_security_guard before insert or update on public.cases for each row execute function public.guard_case_security();

create or replace function public.audit_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare old_row jsonb; new_row jsonb; row_id uuid; target_id uuid;
begin
  old_row := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  row_id := coalesce((new_row->>'id')::uuid, (old_row->>'id')::uuid);
  target_id := case when tg_table_name = 'profiles' then row_id else null end;
  insert into public.audit_logs(user_id, target_user_id, action, table_name, record_id, description, old_values, new_values, metadata)
  values (auth.uid(), target_id, tg_op, tg_table_name, row_id, tg_op || ' on ' || tg_table_name, old_row, new_row, jsonb_build_object('trigger', tg_name));
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function public.audit_change();
create trigger audit_cases after insert or update or delete on public.cases for each row execute function public.audit_change();
create trigger audit_radications after insert or update or delete on public.radications for each row execute function public.audit_change();
create trigger audit_actions after insert or update or delete on public.case_actions for each row execute function public.audit_change();
create trigger audit_proceedings after insert or update or delete on public.proceedings for each row execute function public.audit_change();
create trigger audit_hearings after insert or update or delete on public.hearings for each row execute function public.audit_change();
create trigger audit_notifications after insert or update or delete on public.notifications for each row execute function public.audit_change();
create trigger audit_certificates after insert or update or delete on public.certificates for each row execute function public.audit_change();

-- Bootstrap idempotente: solo service_role/SQL Editor y nunca permite transferir la propiedad.
create or replace function public.bootstrap_system_owner(p_email text, p_display_name text default 'Lilith D''Amico')
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare target_id uuid; existing_owner uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres','supabase_admin') then
    raise exception 'Owner bootstrap requires service_role or SQL Editor';
  end if;
  select id into target_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if target_id is null then raise exception 'Create the Auth user before bootstrapping the owner'; end if;
  select id into existing_owner from public.profiles where is_owner limit 1;
  if existing_owner is not null and existing_owner <> target_id then
    raise exception 'An owner already exists; ownership cannot be transferred';
  end if;
  insert into public.profiles(id, email, full_name, role, is_active, is_owner)
  select id, email, p_display_name, 'SUPER_ADMIN', true, true from auth.users where id = target_id
  on conflict (id) do update set full_name = excluded.full_name, role = 'SUPER_ADMIN', is_active = true, is_owner = true;
  return target_id;
end $$;
revoke all on function public.bootstrap_system_owner(text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_system_owner(text, text) to service_role;

-- Numeración concurrente para cualquier institución.
create or replace function public.generate_internal_case_number(institution_code text) returns text
language plpgsql security definer set search_path = public as $$
declare y text := to_char(current_date, 'YYYY'); next_value integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtext('internal-case-' || institution_code || '-' || y));
  select coalesce(max(substring(internal_number from '([0-9]{6})$')::integer), 0) + 1 into next_value
  from public.cases where internal_number like upper(institution_code) || '-' || y || '-%';
  return format('%s-%s-%s', upper(institution_code), y, lpad(next_value::text, 6, '0'));
end $$;
create or replace function public.generate_judicial_case_number(dependency_code text) returns text
language plpgsql security definer set search_path = public as $$
declare y text := to_char(current_date, 'YYYY'); next_value integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtext('judicial-case-' || dependency_code || '-' || y));
  select count(*) + 1 into next_value from public.cases where extract(year from filed_at) = extract(year from current_date);
  return format('11001-31-03-%s-%s-%s-00', lpad(regexp_replace(dependency_code, '\D', '', 'g'), 3, '0'), y, lpad(next_value::text, 5, '0'));
end $$;
revoke all on function public.generate_internal_case_number(text), public.generate_judicial_case_number(text) from public, anon;
grant execute on function public.generate_internal_case_number(text), public.generate_judicial_case_number(text) to authenticated;

-- Vistas públicas: no incluyen usuarios, correos, partes, identificaciones ni asignaciones internas.
create view public.public_case_lookup with (security_barrier = true) as
select c.id, c.internal_number, c.judicial_number, c.title, c.chamber, c.process_type,
       c.process_subtype, c.status, c.filed_at, d.name as institution_name
from public.cases c left join public.dependencies d on d.id = c.dependency_id
where c.public_visibility and c.confidentiality_level = 'Público';
create view public.public_case_actions with (security_barrier = true) as
select a.id, a.case_id, a.action_type, a.title, a.description, a.action_date
from public.case_actions a join public.cases c on c.id = a.case_id
where a.visibility = 'public' and c.public_visibility and c.confidentiality_level = 'Público';
create view public.public_hearings with (security_barrier = true) as
select h.id, h.case_id, h.title, h.hearing_type, h.scheduled_at, h.end_at, h.room, h.status,
       c.internal_number, c.judicial_number, c.chamber
from public.hearings h join public.cases c on c.id = h.case_id
where h.is_public and c.public_visibility and c.confidentiality_level = 'Público';
create view public.public_institutions with (security_barrier = true) as
select id, parent_id, name, code, type, level, competence, jurisdiction, route_slug
from public.dependencies where is_active;

-- RLS: no hay política pública sobre perfiles, roles, auditoría o asignaciones internas.
alter table public.dependencies enable row level security;
alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.cases enable row level security;
alter table public.radications enable row level security;
alter table public.case_parties enable row level security;
alter table public.documents enable row level security;
alter table public.case_actions enable row level security;
alter table public.hearings enable row level security;
alter table public.proceedings enable row level security;
alter table public.notifications enable row level security;
alter table public.certificates enable row level security;
alter table public.public_notices enable row level security;
alter table public.judicial_states enable row level security;
alter table public.judicial_state_items enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;

create policy dependencies_public_read on public.dependencies for select using (is_active or public.is_owner());
create policy dependencies_owner_write on public.dependencies for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy profiles_private_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_owner());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_owner_update on public.profiles for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy profiles_owner_insert on public.profiles for insert to authenticated with check (public.is_owner() and not is_owner);
create policy profiles_owner_delete on public.profiles for delete to authenticated using (public.is_owner());
create policy roles_authenticated_read on public.role_permissions for select to authenticated using (public.is_active_internal());

create policy cases_internal_read on public.cases for select to authenticated using (
  public.is_owner() or (
    public.is_active_internal() and (
      public.current_role() in ('SECRETARIO_GENERAL','RADICADOR','REPARTO','ARCHIVO')
      or dependency_id = public.current_dependency_id()
      or assigned_judge_id = auth.uid()
    )
  )
);
create policy cases_create on public.cases for insert to authenticated with check (public.current_role() in ('SUPER_ADMIN','RADICADOR','SECRETARIO_GENERAL') and created_by = auth.uid());
create policy cases_update on public.cases for update to authenticated using (
  archived_at is null and (
    public.is_owner() or (
      public.current_role() in ('ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','RADICADOR','REPARTO')
      and (dependency_id = public.current_dependency_id() or public.current_role() in ('RADICADOR','REPARTO','SECRETARIO_GENERAL'))
    )
  )
) with check (public.is_active_internal());
create policy cases_delete on public.cases for delete to authenticated using (public.is_owner());

create policy radications_read on public.radications for select to authenticated using (public.is_active_internal());
create policy radications_write on public.radications for all to authenticated using (public.is_owner() or public.current_role() in ('RADICADOR','REPARTO','SECRETARIO_GENERAL')) with check (public.is_owner() or public.current_role() in ('RADICADOR','REPARTO','SECRETARIO_GENERAL'));
create policy parties_read on public.case_parties for select to authenticated using (public.is_active_internal());
create policy parties_write on public.case_parties for all to authenticated using (public.is_owner() or public.current_role() in ('RADICADOR','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')) with check (public.is_owner() or public.current_role() in ('RADICADOR','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR'));
create policy actions_read on public.case_actions for select to authenticated using (public.is_active_internal());
create policy actions_write on public.case_actions for all to authenticated using (public.is_owner() or public.current_role() in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')) with check (public.is_owner() or public.current_role() in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR'));
create policy documents_read on public.documents for select to authenticated using (public.is_active_internal());
create policy documents_upload on public.documents for insert to authenticated with check (public.is_active_internal() and uploaded_by = auth.uid());
create policy hearings_read on public.hearings for select to authenticated using (public.is_active_internal());
create policy hearings_write on public.hearings for all to authenticated using (public.is_owner() or public.current_role() in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO')) with check (public.is_owner() or public.current_role() in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO'));
create policy proceedings_public_read on public.proceedings for select to anon, authenticated using ((status = 'Publicado' and visibility = 'public') or public.is_active_internal());
create policy proceedings_write on public.proceedings for all to authenticated using (public.is_owner() or public.current_role() in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')) with check (public.is_owner() or public.current_role() in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR'));
create policy notifications_read on public.notifications for select to authenticated using (public.is_active_internal());
create policy notifications_write on public.notifications for all to authenticated using (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')) with check (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR'));
create policy certificates_read on public.certificates for select to authenticated using (public.is_active_internal());
create policy certificates_write on public.certificates for all to authenticated using (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','ARCHIVO')) with check (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','ARCHIVO'));
create policy notices_public_read on public.public_notices for select using (status = 'Publicado' or public.is_active_internal());
create policy notices_write on public.public_notices for all to authenticated using (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','GOBERNACION_COMUNICACIONES')) with check (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','GOBERNACION_COMUNICACIONES'));
create policy states_public_read on public.judicial_states for select using (status = 'Publicado' or public.is_active_internal());
create policy states_write on public.judicial_states for all to authenticated using (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO')) with check (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO'));
create policy state_items_public_read on public.judicial_state_items for select using (exists(select 1 from public.judicial_states s where s.id = judicial_state_id and (s.status = 'Publicado' or public.is_active_internal())));
create policy state_items_write on public.judicial_state_items for all to authenticated using (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO')) with check (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO'));
create policy audit_owner_read on public.audit_logs for select to authenticated using (public.is_owner());
create policy audit_owner_insert on public.audit_logs for insert to authenticated with check (public.is_owner() and user_id = auth.uid());
create policy settings_owner on public.system_settings for all to authenticated using (public.is_owner()) with check (public.is_owner());

revoke all on public.profiles, public.role_permissions, public.audit_logs from anon;
revoke all on public.cases, public.radications, public.case_parties, public.documents, public.case_actions, public.hearings, public.notifications, public.certificates from anon;
grant select on public.public_case_lookup, public.public_case_actions, public.public_hearings, public.public_institutions to anon, authenticated;

-- Buckets privados y públicos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
('case-documents','case-documents',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg']),
('public-notices','public-notices',true,10485760,array['image/png','image/jpeg','image/webp']),
('providence-files','providence-files',false,20971520,array['application/pdf'])
on conflict (id) do nothing;
create policy storage_internal_read on storage.objects for select to authenticated using (bucket_id in ('case-documents','providence-files') and public.is_active_internal());
create policy storage_internal_insert on storage.objects for insert to authenticated with check (bucket_id in ('case-documents','providence-files') and public.is_active_internal());
create policy storage_internal_update on storage.objects for update to authenticated using (owner_id = auth.uid()::text or public.is_owner());
create policy storage_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'public-notices');
create policy storage_public_write on storage.objects for insert to authenticated with check (bucket_id = 'public-notices' and (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','GOBERNACION_COMUNICACIONES')));

-- Matriz declarativa de roles.
insert into public.role_permissions(role,label,scope_description,permissions,can_manage_users) values
('SUPER_ADMIN','Superadministración','Configuración global; la gestión de usuarios exige además is_owner=true.','["settings","audit"]',false),
('ADMIN_INSTITUCIONAL','Administración institucional','Operación limitada a la institución asignada.','["institution_dashboard","assigned_cases"]',false),
('MAGISTRADO_CORTE_SUPREMA','Magistratura de Corte Suprema','Casación, revisión, tutelas y conflictos de competencia.','["supreme_review","proceedings","hearings"]',false),
('MAGISTRADO_TRIBUNAL','Magistratura de Tribunal','Segunda instancia y apelaciones.','["appeals","proceedings","hearings"]',false),
('JUEZ_CIRCUITO','Juez de Circuito','Primera instancia de mayor competencia.','["assigned_cases","proceedings","hearings"]',false),
('JUEZ_MUNICIPAL','Juez Municipal','Asuntos locales y pequeñas causas.','["assigned_cases","proceedings","hearings"]',false),
('SECRETARIO_GENERAL','Secretaría General','Estados, constancias y notificaciones.','["states","certificates","notifications"]',false),
('SECRETARIO_DESPACHO','Secretaría de Despacho','Trámite secretarial del despacho.','["actions","states","certificates"]',false),
('OFICIAL_MAYOR','Oficial Mayor','Apoyo procesal y documental.','["actions","documents"]',false),
('RADICADOR','Radicación','Recepción y validación inicial.','["radications","create_cases"]',false),
('REPARTO','Reparto','Asignación de expedientes.','["distribution"]',false),
('ARCHIVO','Archivo Judicial','Cierre, transferencia y custodia.','["archive","certificates"]',false),
('GOBERNACION_COMUNICACIONES','Gobernación — comunicaciones','Avisos externos sin funciones jurisdiccionales.','["public_notices"]',false),
('CONSULTA_PUBLICA','Consulta limitada','Lectura expresamente autorizada.','["read_only"]',false);

-- Estructura multiinstitucional ficticia.
insert into public.dependencies(id,parent_id,name,code,type,level,competence,jurisdiction,route_slug,document_templates) values
('10000000-0000-0000-0000-000000000001',null,'Palacio Judicial — Coordinación General','PJ','Sistema',1,'Coordinación tecnológica y administrativa del sistema ficticio.','Ámbito demostrativo nacional','palacio-judicial',array['Constancia general']),
('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Corte Suprema de Justicia','CSJ','Corte',2,'Casación, revisión, tutelas contra providencias y conflictos de competencia en alcance ficticio.','Ámbito demostrativo nacional','corte-suprema',array['Auto de admisión','Sentencia de casación','Decisión de tutela']),
('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Tribunal Superior de Justicia','TSJ','Tribunal',2,'Segunda instancia, apelaciones y revisión de jueces inferiores.','Distrito Judicial Simulado','tribunal-superior',array['Auto de avocamiento','Auto interlocutorio','Sentencia de segunda instancia']),
('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000003','Sala Civil','SC','Sala',3,'Procesos civiles y apelaciones de su especialidad.','Distrito Judicial Simulado','sala-civil',array['Auto civil','Sentencia civil']),
('10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000003','Sala Penal','SP','Sala',3,'Procesos penales y recursos de su especialidad.','Distrito Judicial Simulado','sala-penal',array['Auto penal','Sentencia penal']),
('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000003','Sala Laboral','SL','Sala',3,'Procesos laborales y seguridad social.','Distrito Judicial Simulado','sala-laboral',array['Auto laboral','Sentencia laboral']),
('10000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000003','Sala Familia','SF','Sala',3,'Asuntos de familia con protección reforzada de datos.','Distrito Judicial Simulado','sala-familia',array['Auto de familia','Sentencia reservada']),
('10000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000003','Sala Constitucional y Tutelas','SCT','Sala',3,'Acciones constitucionales y tutelas.','Distrito Judicial Simulado','sala-constitucional',array['Auto de tutela','Fallo de tutela']),
('10000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','Juzgados de Circuito','JC','Juzgado',3,'Primera instancia de mayor competencia, procesos ordinarios y tutelas.','Circuitos judiciales simulados','juzgados-circuito',array['Auto de apertura','Decreto de pruebas','Sentencia de primera instancia']),
('10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','Juzgados Municipales','JM','Juzgado',4,'Asuntos locales, pequeñas causas y primeras actuaciones.','Municipios simulados','juzgados-municipales',array['Auto admisorio','Acta de audiencia','Sentencia de mínima cuantía']),
('10000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','Secretaría General','SG','Secretaría',2,'Estados, constancias, notificaciones y certificaciones.','Todas las instituciones del sistema','secretaria-general',array['Constancia secretarial','Estado judicial','Certificación']),
('10000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','Oficina de Radicación','RAD','Oficina',2,'Recepción, validación de anexos y asignación inicial de radicados.','Ventanilla única simulada','oficina-radicacion',array['Constancia de radicación']),
('10000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000001','Oficina de Reparto','REP','Oficina',2,'Reparto automático o manual a despachos competentes.','Todas las jurisdicciones simuladas','oficina-reparto',array['Acta de reparto']),
('10000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000001','Archivo Judicial','ARJ','Archivo',2,'Cierre, transferencia, custodia y consulta archivística.','Archivo central simulado','archivo-judicial',array['Constancia de archivo','Acta de préstamo']),
('10000000-0000-0000-0000-000000000015',null,'Despacho del Gobernador — Comunicaciones','GOB-COM','Autoridad externa',2,'Comunicaciones oficiales y avisos ejecutivos; sin función judicial ni acceso jurisdiccional.','Ámbito externo simulado','gobernacion-comunicaciones',array['Comunicado ejecutivo']);

insert into public.cases(id,internal_number,judicial_number,title,authority_type,chamber,process_type,process_subtype,claimant_name,defendant_name,summary,claims,department,municipality,reception_method,confidentiality_level,status,dependency_id,public_visibility,filed_at) values
('20000000-0000-0000-0000-000000000001','CSJ-2026-000001','11001-31-03-001-2026-00001-00','Revisión constitucional simulada','Corte Suprema','Sala Constitucional y Tutelas','Constitucional','Revisión','Parte solicitante A.','Autoridad ficticia B.','Revisión enteramente ficticia.','Resolver el asunto simulado.','República Judicial ficticia','Distrito Capital Simulado','Remisión','Público','Auto de avocamiento','10000000-0000-0000-0000-000000000002',true,'2026-05-14'),
('20000000-0000-0000-0000-000000000002','TSJ-2026-000002','11001-31-03-002-2026-00002-00','Apelación civil simulada','Tribunal Superior','Sala Civil','Civil','Apelación','Comercial Ejemplo S.A.S.','Servicios Demostrativos S.A.S.','Controversia contractual ficticia.','Decidir la apelación simulada.','República Judicial ficticia','Distrito Capital Simulado','Remisión de juzgado','Público','Pruebas decretadas','10000000-0000-0000-0000-000000000004',true,'2026-04-28'),
('20000000-0000-0000-0000-000000000003','JC-2026-000003','11001-31-03-003-2026-00003-00','Proceso ordinario de circuito simulado','Juzgado de Circuito','Juzgados de Circuito','Civil','Ordinario','Parte demandante C.','Parte demandada D.','Proceso ordinario ficticio.','Pretensiones demostrativas.','República Judicial ficticia','Distrito Capital Simulado','Ventanilla','Reservado','En reparto','10000000-0000-0000-0000-000000000009',false,'2026-06-02'),
('20000000-0000-0000-0000-000000000004','JM-2026-000004','11001-41-89-001-2026-00004-00','Pequeña causa municipal simulada','Juzgado Municipal','Juzgados Municipales','Civil','Mínima cuantía','Persona solicitante E.','Comercio Modelo F.','Asunto local ficticio.','Decisión demostrativa.','República Judicial ficticia','Municipio Simulado','Ventanilla','Público','Audiencia programada','10000000-0000-0000-0000-000000000010',true,'2026-05-20');

insert into public.radications(id,case_id,reception_method,validated_at,validation_status,distribution_method,destination_dependency_id,distributed_at) values
('25000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Remisión','2026-05-14','Validado','Automático','10000000-0000-0000-0000-000000000002','2026-05-14'),
('25000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Remisión de juzgado','2026-04-28','Validado','Manual','10000000-0000-0000-0000-000000000004','2026-04-28');

insert into public.case_actions(id,case_id,action_type,title,description,visibility,action_date) values
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Auto de avocamiento','Despacho avoca conocimiento','Se avoca conocimiento y se ordena comunicar a las partes ficticias.','public','2026-06-16'),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Decreto de pruebas','Pruebas documentales decretadas','Se incorporan los documentos demostrativos.','public','2026-06-14'),
('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004','Fijación de audiencia','Audiencia inicial programada','Se fija audiencia pública demostrativa.','public','2026-06-12');

insert into public.hearings(id,case_id,title,hearing_type,scheduled_at,room,status,is_public) values
('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','Audiencia inicial','Inicial',now() + interval '5 days','Sala virtual 3','Programada',true);

insert into public.proceedings(id,case_id,providence_number,title,type,chamber,content_markdown,status,visibility,published_at) values
('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','CSJ-AV-018-2026','Auto de avocamiento','Auto de avocamiento','Corte Suprema','# Auto de avocamiento\n\nDocumento ficticio de demostración.','Publicado','public','2026-06-16');

insert into public.public_notices(id,title,slug,category,issuing_entity,content_markdown,status,published_at) values
('60000000-0000-0000-0000-000000000001','Jornada de servicios digitales durante el cierre de junio','jornada-servicios-digitales-junio','Institucional','Secretaría General','# Jornada de servicios digitales\n\nInformación ficticia.','Publicado','2026-06-17'),
('60000000-0000-0000-0000-000000000002','Aviso ejecutivo externo de demostración','aviso-ejecutivo-demostrativo','Comunicaciones','Despacho del Gobernador — Comunicaciones','# Aviso ejecutivo\n\nSin función jurisdiccional.','Publicado','2026-06-15');

insert into public.system_settings(key,value) values
('institution', '{"name":"Palacio Judicial","system":"Sistema Integral de Gestión Judicial","demo":true}'),
('case_numbering', '{"mode":"multi_institution","year":2026}'),
('workflow', '{"stages":["radicacion","reparto","asignacion","avocamiento","instruccion","pruebas","traslados","estado","audiencia","sentencia","notificacion","archivo"]}');
