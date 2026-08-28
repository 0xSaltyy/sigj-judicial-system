-- SIGJ · Esquema inicial demostrativo
-- Ejecutar en un proyecto Supabase nuevo mediante `supabase db push`.
create extension if not exists pgcrypto;

create type public.app_role as enum ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','MAGISTRADO','JUEZ_CIRCUITO','SECRETARIA','RELATORIA','GOBERNACION','CONSULTA');
create type public.visibility_level as enum ('public','internal','reserved');

create table public.dependencies (
  id uuid primary key default gen_random_uuid(), name text not null, code text not null unique,
  type text not null, department text not null, municipality text not null,
  is_active boolean not null default true, created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, full_name text not null,
  email text not null, role public.app_role not null default 'CONSULTA',
  dependency_id uuid references public.dependencies(id), position_title text,
  is_active boolean not null default true, last_access_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(), internal_number text not null unique,
  judicial_number text not null unique, title text not null, authority_type text not null,
  chamber text not null, process_type text not null, process_subtype text not null,
  claimant_name text not null, defendant_name text not null, summary text not null,
  claims text not null, amount numeric(18,2), department text not null, municipality text not null,
  reception_method text not null, confidentiality_level text not null check (confidentiality_level in ('Público','Reservado','Confidencial')),
  status text not null default 'Radicado', assigned_judge_id uuid references public.profiles(id),
  dependency_id uuid references public.dependencies(id), public_visibility boolean not null default false,
  filed_at timestamptz not null default now(), observations text, created_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz
);
create index cases_internal_number_idx on public.cases(internal_number);
create index cases_judicial_number_idx on public.cases(judicial_number);
create index cases_status_chamber_idx on public.cases(status, chamber);
create index cases_assigned_judge_idx on public.cases(assigned_judge_id);

create table public.case_parties (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade,
  name text not null, party_type text not null, document_type text, document_number text,
  email text, phone text, address text, is_confidential boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(), case_id uuid references public.cases(id) on delete cascade,
  providence_id uuid, uploaded_by uuid not null references auth.users(id), title text not null,
  file_path text not null unique, file_type text not null, visibility public.visibility_level not null default 'internal',
  checksum text, created_at timestamptz not null default now()
);

create table public.case_actions (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade,
  action_type text not null, title text not null, description text not null,
  visibility public.visibility_level not null default 'internal', created_by uuid references auth.users(id),
  document_id uuid references public.documents(id) on delete set null,
  action_date timestamptz not null default now(), created_at timestamptz not null default now()
);
create index case_actions_case_date_idx on public.case_actions(case_id, action_date desc);

create table public.hearings (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade,
  title text not null, hearing_type text not null, scheduled_at timestamptz not null,
  end_at timestamptz, room text not null, virtual_link text, status text not null default 'Programada',
  is_public boolean not null default false, participants jsonb not null default '[]', notes text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint hearing_date_check check (scheduled_at >= created_at or status = 'Realizada')
);

create table public.proceedings (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade,
  providence_number text not null unique, title text not null, type text not null, chamber text not null,
  judge_id uuid references public.profiles(id), content_markdown text not null,
  status text not null default 'Borrador', visibility public.visibility_level not null default 'internal',
  signed_at timestamptz, published_at timestamptz, created_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint published_proceeding_check check (status <> 'Publicado' or (published_at is not null and length(content_markdown) > 0))
);
alter table public.documents add constraint documents_providence_fk foreign key (providence_id) references public.proceedings(id) on delete cascade;

create table public.public_notices (
  id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique,
  category text not null, issuing_entity text not null, content_markdown text not null,
  image_path text, status text not null default 'Borrador', published_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint published_notice_check check (status <> 'Publicado' or (published_at is not null and length(title) > 0 and length(content_markdown) > 0))
);

create table public.judicial_states (
  id uuid primary key default gen_random_uuid(), state_number text not null unique,
  dependency_id uuid not null references public.dependencies(id), state_date date not null,
  status text not null default 'Borrador', created_by uuid references auth.users(id),
  published_at timestamptz, created_at timestamptz not null default now(), unique(dependency_id, state_date)
);

create table public.judicial_state_items (
  id uuid primary key default gen_random_uuid(), judicial_state_id uuid not null references public.judicial_states(id) on delete cascade,
  case_id uuid not null references public.cases(id), case_action_id uuid references public.case_actions(id),
  description text not null, created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id),
  recipient_name text not null, recipient_email text, notification_type text not null,
  status text not null default 'Pendiente', sent_at timestamptz, created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id),
  action text not null, table_name text not null, record_id uuid, description text not null,
  metadata jsonb, ip_address inet, created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(), key text not null unique, value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Funciones de autorización. SECURITY DEFINER evita recursión de RLS.
create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;
create or replace function public.is_active_internal() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active = true)
$$;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role() = 'SUPER_ADMIN', false)
$$;

-- Todo usuario nuevo obtiene un perfil de solo lectura. La elevación de rol se hace después por SUPER_ADMIN.
create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email, role)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)), new.email, 'CONSULTA')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

-- Numeración serializada mediante advisory locks para evitar duplicados concurrentes.
create or replace function public.generate_internal_case_number(chamber_code text) returns text
language plpgsql security definer set search_path = public as $$
declare y text := to_char(current_date, 'YYYY'); next_value integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtext('internal-case-' || chamber_code || '-' || y));
  select coalesce(max(substring(internal_number from '([0-9]{6})$')::integer), 0) + 1 into next_value
  from public.cases where internal_number like 'TSJ-' || chamber_code || '-' || y || '-%';
  return format('TSJ-%s-%s-%s', upper(chamber_code), y, lpad(next_value::text, 6, '0'));
end $$;

create or replace function public.generate_judicial_case_number(dependency_code text) returns text
language plpgsql security definer set search_path = public as $$
declare y text := to_char(current_date, 'YYYY'); next_value integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtext('judicial-case-' || dependency_code || '-' || y));
  select coalesce(max(substring(judicial_number from '-([0-9]{5})-00$')::integer), 0) + 1 into next_value from public.cases where judicial_number like '%-' || y || '-%-00';
  return format('11001-31-03-%s-%s-%s-00', lpad(regexp_replace(dependency_code, '\D', '', 'g'), 3, '0'), y, lpad(next_value::text, 5, '0'));
end $$;
revoke all on function public.generate_internal_case_number(text) from public, anon;
revoke all on function public.generate_judicial_case_number(text) from public, anon;
grant execute on function public.generate_internal_case_number(text), public.generate_judicial_case_number(text) to authenticated;

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger cases_updated before update on public.cases for each row execute function public.set_updated_at();
create trigger hearings_updated before update on public.hearings for each row execute function public.set_updated_at();
create trigger proceedings_updated before update on public.proceedings for each row execute function public.set_updated_at();
create trigger notices_updated before update on public.public_notices for each row execute function public.set_updated_at();

create or replace function public.guard_profile_privileges() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.role is distinct from new.role or old.is_active is distinct from new.is_active or old.dependency_id is distinct from new.dependency_id) and auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' and not public.is_super_admin() then
    raise exception 'Only SUPER_ADMIN may change roles, activation or dependency';
  end if;
  return new;
end $$;
create trigger profiles_privilege_guard before update on public.profiles for each row execute function public.guard_profile_privileges();

create or replace function public.guard_case_security() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.confidentiality_level in ('Reservado','Confidencial') then new.public_visibility := false; end if;
  if tg_op = 'UPDATE' and old.archived_at is not null and auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' and not public.is_super_admin() then raise exception 'Archived cases are read-only'; end if;
  if tg_op = 'UPDATE' and new.archived_at is distinct from old.archived_at and auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' and not public.is_super_admin() then raise exception 'Only SUPER_ADMIN may archive cases'; end if;
  return new;
end $$;
create trigger cases_security_guard before insert or update on public.cases for each row execute function public.guard_case_security();

create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path = public as $$
declare row_data jsonb; row_id uuid;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  row_id := (row_data->>'id')::uuid;
  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), tg_op, tg_table_name, row_id, tg_op || ' on ' || tg_table_name, jsonb_build_object('record', row_data));
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger audit_cases after insert or update or delete on public.cases for each row execute function public.audit_change();
create trigger audit_actions after insert or update or delete on public.case_actions for each row execute function public.audit_change();
create trigger audit_proceedings after insert or update or delete on public.proceedings for each row execute function public.audit_change();
create trigger audit_hearings after insert or update or delete on public.hearings for each row execute function public.audit_change();
create trigger audit_notices after insert or update or delete on public.public_notices for each row execute function public.audit_change();
create trigger audit_states after insert or update or delete on public.judicial_states for each row execute function public.audit_change();
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function public.audit_change();

-- Vistas públicas: jamás exponen partes, identificaciones, documentos ni notas internas.
create view public.public_case_lookup with (security_barrier = true) as
select id, internal_number, judicial_number, title, chamber, process_type, process_subtype, status, filed_at, dependency_id, public_visibility
from public.cases where public_visibility = true and confidentiality_level = 'Público';
create view public.public_case_actions with (security_barrier = true) as
select a.id, a.case_id, a.action_type, a.title, a.description, a.action_date
from public.case_actions a join public.cases c on c.id = a.case_id
where a.visibility = 'public' and c.public_visibility = true and c.confidentiality_level = 'Público';
create view public.public_hearings with (security_barrier = true) as
select h.id, h.case_id, h.title, h.hearing_type, h.scheduled_at, h.end_at, h.room, h.status,
       c.internal_number, c.judicial_number, c.chamber
from public.hearings h join public.cases c on c.id = h.case_id
where h.is_public = true and c.public_visibility = true and c.confidentiality_level = 'Público';
revoke all on public.cases, public.case_actions, public.case_parties, public.documents, public.hearings from anon;
grant select on public.public_case_lookup, public.public_case_actions, public.public_hearings to anon, authenticated;

-- RLS
alter table public.profiles enable row level security; alter table public.dependencies enable row level security;
alter table public.cases enable row level security; alter table public.case_parties enable row level security;
alter table public.case_actions enable row level security; alter table public.documents enable row level security;
alter table public.hearings enable row level security; alter table public.proceedings enable row level security;
alter table public.public_notices enable row level security; alter table public.judicial_states enable row level security;
alter table public.judicial_state_items enable row level security; alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security; alter table public.system_settings enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_super_admin());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid() or public.is_super_admin()) with check (id = auth.uid() or public.is_super_admin());
create policy profiles_admin_insert on public.profiles for insert to authenticated with check (public.is_super_admin());
create policy dependencies_public_read on public.dependencies for select using (is_active = true or public.is_super_admin());
create policy dependencies_admin_write on public.dependencies for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy cases_internal_read on public.cases for select to authenticated using (
  public.is_active_internal() and (
    public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','SECRETARIA','RELATORIA','CONSULTA')
    or (public.current_role() in ('MAGISTRADO','JUEZ_CIRCUITO') and (assigned_judge_id = auth.uid() or dependency_id = (select dependency_id from public.profiles where id = auth.uid())))
    or (public.current_role() = 'GOBERNACION' and process_type = 'Administrativo')
  )
);
create policy cases_create on public.cases for insert to authenticated with check (public.current_role() in ('SUPER_ADMIN','SECRETARIA','JUEZ_CIRCUITO') and created_by = auth.uid());
create policy cases_update on public.cases for update to authenticated using (public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','MAGISTRADO','JUEZ_CIRCUITO','SECRETARIA') and archived_at is null) with check (public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','MAGISTRADO','JUEZ_CIRCUITO','SECRETARIA'));
create policy cases_delete on public.cases for delete to authenticated using (public.is_super_admin());

create policy parties_internal on public.case_parties for select to authenticated using (public.is_active_internal());
create policy parties_write on public.case_parties for all to authenticated using (public.current_role() in ('SUPER_ADMIN','SECRETARIA','JUEZ_CIRCUITO')) with check (public.current_role() in ('SUPER_ADMIN','SECRETARIA','JUEZ_CIRCUITO'));
create policy actions_internal_read on public.case_actions for select to authenticated using (public.is_active_internal());
create policy actions_write on public.case_actions for all to authenticated using (public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','MAGISTRADO','JUEZ_CIRCUITO','SECRETARIA')) with check (public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','MAGISTRADO','JUEZ_CIRCUITO','SECRETARIA'));
create policy documents_internal_read on public.documents for select to authenticated using (public.is_active_internal());
create policy documents_upload on public.documents for insert to authenticated with check (public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','MAGISTRADO','JUEZ_CIRCUITO','SECRETARIA','RELATORIA') and uploaded_by = auth.uid());
create policy hearings_internal_read on public.hearings for select to authenticated using (public.is_active_internal());
create policy hearings_write on public.hearings for all to authenticated using (public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','MAGISTRADO','JUEZ_CIRCUITO','SECRETARIA')) with check (public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','MAGISTRADO','JUEZ_CIRCUITO','SECRETARIA'));
create policy proceedings_public_read on public.proceedings for select to anon, authenticated using ((status = 'Publicado' and visibility = 'public') or public.is_active_internal());
create policy proceedings_write on public.proceedings for all to authenticated using (public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','MAGISTRADO','JUEZ_CIRCUITO','RELATORIA')) with check (public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','MAGISTRADO','JUEZ_CIRCUITO','RELATORIA'));
create policy notices_public_read on public.public_notices for select using (status = 'Publicado' or public.is_active_internal());
create policy notices_write on public.public_notices for all to authenticated using (public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','SECRETARIA','GOBERNACION')) with check (public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','SECRETARIA','GOBERNACION'));
create policy states_public_read on public.judicial_states for select using (status = 'Publicado' or public.is_active_internal());
create policy states_write on public.judicial_states for all to authenticated using (public.current_role() in ('SUPER_ADMIN','SECRETARIA')) with check (public.current_role() in ('SUPER_ADMIN','SECRETARIA'));
create policy state_items_public_read on public.judicial_state_items for select using (exists(select 1 from public.judicial_states s where s.id = judicial_state_id and (s.status = 'Publicado' or public.is_active_internal())));
create policy state_items_write on public.judicial_state_items for all to authenticated using (public.current_role() in ('SUPER_ADMIN','SECRETARIA')) with check (public.current_role() in ('SUPER_ADMIN','SECRETARIA'));
create policy notifications_internal on public.notifications for select to authenticated using (public.is_active_internal());
create policy notifications_write on public.notifications for all to authenticated using (public.current_role() in ('SUPER_ADMIN','SECRETARIA')) with check (public.current_role() in ('SUPER_ADMIN','SECRETARIA'));
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_super_admin());
create policy settings_admin on public.system_settings for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Buckets y políticas de Storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
('case-documents','case-documents',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg']),
('public-notices','public-notices',true,10485760,array['image/png','image/jpeg','image/webp']),
('providence-files','providence-files',false,20971520,array['application/pdf'])
on conflict (id) do nothing;
create policy storage_internal_read on storage.objects for select to authenticated using (bucket_id in ('case-documents','providence-files') and public.is_active_internal());
create policy storage_internal_insert on storage.objects for insert to authenticated with check (bucket_id in ('case-documents','providence-files') and public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','MAGISTRADO','JUEZ_CIRCUITO','SECRETARIA','RELATORIA'));
create policy storage_internal_update on storage.objects for update to authenticated using (owner_id = auth.uid()::text or public.is_super_admin());
create policy storage_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'public-notices');
create policy storage_public_write on storage.objects for insert to authenticated with check (bucket_id = 'public-notices' and public.current_role() in ('SUPER_ADMIN','PRESIDENCIA_TRIBUNAL','SECRETARIA','GOBERNACION'));

-- Datos de demostración: nunca se insertan usuarios ni contraseñas.
insert into public.dependencies (id,name,code,type,department,municipality) values
('10000000-0000-0000-0000-000000000001','Tribunal Superior de Justicia de la República Judicial','TSJ','Tribunal','República Judicial','Distrito Capital Simulado'),
('10000000-0000-0000-0000-000000000002','Sala Penal','SP','Sala','República Judicial','Distrito Capital Simulado'),
('10000000-0000-0000-0000-000000000003','Sala Civil','SC','Sala','República Judicial','Distrito Capital Simulado'),
('10000000-0000-0000-0000-000000000004','Sala Laboral','SL','Sala','República Judicial','Distrito Capital Simulado'),
('10000000-0000-0000-0000-000000000005','Sala Administrativa','SA','Sala','República Judicial','Distrito Capital Simulado'),
('10000000-0000-0000-0000-000000000006','Juzgado Primero Civil del Circuito','JC1','Juzgado','República Judicial','Distrito Capital Simulado'),
('10000000-0000-0000-0000-000000000007','Juzgado Segundo Penal del Circuito','JP2','Juzgado','República Judicial','Distrito Capital Simulado'),
('10000000-0000-0000-0000-000000000008','Secretaría General','SG','Oficina','República Judicial','Distrito Capital Simulado'),
('10000000-0000-0000-0000-000000000009','Relatoría','REL','Oficina','República Judicial','Distrito Capital Simulado'),
('10000000-0000-0000-0000-000000000010','Gobernación Judicial Administrativa','GJA','Administrativa','República Judicial','Distrito Capital Simulado')
on conflict (id) do nothing;

insert into public.cases (id,internal_number,judicial_number,title,authority_type,chamber,process_type,process_subtype,claimant_name,defendant_name,summary,claims,department,municipality,reception_method,confidentiality_level,status,dependency_id,public_visibility,filed_at) values
('20000000-0000-0000-0000-000000000001','TSJ-SP-2026-000001','11001-31-03-001-2026-00001-00','Proceso penal simulado','Tribunal','Sala Penal','Penal','Apelación','Parte solicitante A.','Parte convocada B.','Recurso penal enteramente ficticio.','Resolver el recurso simulado.','República Judicial','Distrito Capital Simulado','Recurso','Público','Auto de avocamiento','10000000-0000-0000-0000-000000000002',true,'2026-05-14'),
('20000000-0000-0000-0000-000000000002','TSJ-SC-2026-000002','11001-31-03-002-2026-00002-00','Proceso civil declarativo simulado','Tribunal','Sala Civil','Civil','Declarativo','Comercial Ejemplo S.A.S.','Servicios Demostrativos S.A.S.','Controversia contractual ficticia.','Declaraciones y condenas simuladas.','República Judicial','Distrito Capital Simulado','Remisión de juzgado','Público','Pruebas decretadas','10000000-0000-0000-0000-000000000003',true,'2026-04-28'),
('20000000-0000-0000-0000-000000000003','TSJ-SA-2026-000003','11001-33-01-001-2026-00003-00','Proceso administrativo simulado','Tribunal','Sala Administrativa','Administrativo','Control de legalidad','Solicitante reservado','Entidad administrativa ficticia','Asunto sujeto a reserva demostrativa.','Control simulado.','República Judicial','Distrito Capital Simulado','Reparto interno','Reservado','En reparto','10000000-0000-0000-0000-000000000005',false,'2026-06-02'),
('20000000-0000-0000-0000-000000000004','TSJ-SL-2026-000004','11001-31-05-001-2026-00004-00','Proceso laboral ordinario simulado','Tribunal','Sala Laboral','Laboral','Apelación','Persona trabajadora C.','Empresa Modelo S.A.S.','Controversia laboral ficticia.','Reconocimiento simulado.','República Judicial','Distrito Capital Simulado','Recurso','Público','Audiencia programada','10000000-0000-0000-0000-000000000004',true,'2026-05-20')
on conflict (id) do nothing;

insert into public.case_actions (id,case_id,action_type,title,description,visibility,action_date) values
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Auto de avocamiento','Despacho avoca conocimiento','Se avoca conocimiento del recurso y se ordena comunicar a las partes.','public','2026-06-16'),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Decreto de pruebas','Pruebas documentales decretadas','Se incorporan los documentos allegados oportunamente.','public','2026-06-14'),
('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004','Fijación de audiencia','Audiencia de instrucción programada','Se fija audiencia pública para el 24 de junio de 2026.','public','2026-06-12')
on conflict (id) do nothing;

insert into public.hearings (id,case_id,title,hearing_type,scheduled_at,room,status,is_public) values
('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','Audiencia de instrucción','Instrucción',now() + interval '5 days','Sala virtual 3','Programada',true)
on conflict (id) do nothing;

insert into public.proceedings (id,case_id,providence_number,title,type,chamber,content_markdown,status,visibility,published_at) values
('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','SP-AV-018-2026','Auto de avocamiento','Auto de avocamiento','Sala Penal','# Auto de avocamiento\n\nDocumento ficticio de demostración.','Publicado','public','2026-06-16')
on conflict (id) do nothing;

insert into public.public_notices (id,title,slug,category,issuing_entity,content_markdown,status,published_at) values
('60000000-0000-0000-0000-000000000001','Jornada de servicios digitales durante el cierre de junio','jornada-servicios-digitales-junio','Institucional','Secretaría General','# Jornada de servicios digitales\n\nInformación ficticia de demostración.','Publicado','2026-06-17'),
('60000000-0000-0000-0000-000000000002','Mantenimiento programado de la plataforma demostrativa','mantenimiento-programado-plataforma','Mantenimiento del sistema','Gobernación Judicial Administrativa','# Mantenimiento programado\n\nVentana demostrativa.','Publicado','2026-06-15')
on conflict (id) do nothing;

insert into public.judicial_states (id,state_number,dependency_id,state_date,status,published_at) values
('70000000-0000-0000-0000-000000000001','EST-SP-094-2026','10000000-0000-0000-0000-000000000002','2026-06-18','Publicado','2026-06-18 08:00:00-05')
on conflict (id) do nothing;

insert into public.system_settings(key,value) values
('institution', '{"name":"Tribunal Superior de Justicia de la República Judicial","demo":true}'),
('case_numbering', '{"prefix":"TSJ","year":2026}')
on conflict (key) do nothing;
