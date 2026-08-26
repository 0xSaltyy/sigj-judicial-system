-- DOJ Roleplay · Extensiones de dominio sin tocar la migración inicial.
-- Mantiene claro que el sistema es ficticio y no afiliado al DOJ real.

alter type public.app_role add value if not exists 'OWNER';
alter type public.app_role add value if not exists 'ATTORNEY_GENERAL';
alter type public.app_role add value if not exists 'DEPUTY_ATTORNEY_GENERAL';
alter type public.app_role add value if not exists 'JUEZ';
alter type public.app_role add value if not exists 'FISCAL';
alter type public.app_role add value if not exists 'ABOGADO';
alter type public.app_role add value if not exists 'INVESTIGADOR';
alter type public.app_role add value if not exists 'ADMINISTRADOR';
alter type public.app_role add value if not exists 'PERSONAL_AUTORIZADO';

create table if not exists public.roleplay_applications (
  id uuid primary key default gen_random_uuid(),
  application_type text not null check (application_type in ('juez','abogado','investigador','personal')),
  tracking_code text not null unique default (
    replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)
  ),
  applicant_name text not null,
  contact_info text,
  experience text,
  education text,
  statement text,
  answers jsonb not null default '{}',
  status text not null default 'Recibida' check (status in ('Recibida','En revisión','Entrevista','Aprobada','Rechazada','Retirada')),
  evaluator_id uuid references public.profiles(id),
  internal_notes text,
  public_message text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.roleplay_warrants (
  id uuid primary key default gen_random_uuid(),
  warrant_number text not null unique,
  warrant_type text not null,
  case_id uuid references public.cases(id) on delete set null,
  target_description text not null,
  reason text not null,
  legal_basis text not null,
  requested_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  issued_at timestamptz,
  expires_at timestamptz,
  status text not null default 'Borrador' check (status in ('Borrador','Pendiente','Aprobada','Denegada','Activa','Ejecutada','Vencida','Revocada')),
  confidentiality text not null default 'internal' check (confidentiality in ('public','internal','reserved','confidential')),
  observations text,
  execution_history jsonb not null default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null,
  effect text not null check (effect in ('allow','deny')),
  reason text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(user_id, permission_key)
);

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role()::text in ('SUPER_ADMIN','OWNER','ATTORNEY_GENERAL'), false)
$$;

drop trigger if exists roleplay_applications_updated on public.roleplay_applications;
create trigger roleplay_applications_updated before update on public.roleplay_applications for each row execute function public.set_updated_at();
drop trigger if exists roleplay_warrants_updated on public.roleplay_warrants;
create trigger roleplay_warrants_updated before update on public.roleplay_warrants for each row execute function public.set_updated_at();

drop trigger if exists audit_roleplay_applications on public.roleplay_applications;
create trigger audit_roleplay_applications after insert or update or delete on public.roleplay_applications for each row execute function public.audit_change();
drop trigger if exists audit_roleplay_warrants on public.roleplay_warrants;
create trigger audit_roleplay_warrants after insert or update or delete on public.roleplay_warrants for each row execute function public.audit_change();
drop trigger if exists audit_user_permission_overrides on public.user_permission_overrides;
create trigger audit_user_permission_overrides after insert or update or delete on public.user_permission_overrides for each row execute function public.audit_change();

alter table public.roleplay_applications enable row level security;
alter table public.roleplay_warrants enable row level security;
alter table public.user_permission_overrides enable row level security;

drop policy if exists roleplay_applications_public_insert on public.roleplay_applications;
create policy roleplay_applications_public_insert on public.roleplay_applications
for insert to anon, authenticated
with check (application_type in ('juez','abogado','investigador','personal'));

drop policy if exists roleplay_applications_staff_read on public.roleplay_applications;
create policy roleplay_applications_staff_read on public.roleplay_applications
for select to authenticated
using (public.is_super_admin() or public.current_role()::text in ('DEPUTY_ATTORNEY_GENERAL','ADMINISTRADOR','PERSONAL_AUTORIZADO','SECRETARIA','GOBERNACION'));

drop policy if exists roleplay_applications_staff_update on public.roleplay_applications;
create policy roleplay_applications_staff_update on public.roleplay_applications
for update to authenticated
using (public.is_super_admin() or public.current_role()::text in ('DEPUTY_ATTORNEY_GENERAL','ADMINISTRADOR','PERSONAL_AUTORIZADO'))
with check (public.is_super_admin() or public.current_role()::text in ('DEPUTY_ATTORNEY_GENERAL','ADMINISTRADOR','PERSONAL_AUTORIZADO'));

drop policy if exists roleplay_warrants_public_read on public.roleplay_warrants;
create policy roleplay_warrants_public_read on public.roleplay_warrants
for select to anon, authenticated
using (confidentiality = 'public' and status in ('Aprobada','Activa','Ejecutada','Vencida') or public.is_active_internal());

drop policy if exists roleplay_warrants_staff_write on public.roleplay_warrants;
create policy roleplay_warrants_staff_write on public.roleplay_warrants
for all to authenticated
using (public.is_super_admin() or public.current_role()::text in ('DEPUTY_ATTORNEY_GENERAL','JUEZ','FISCAL','INVESTIGADOR','ADMINISTRADOR','PERSONAL_AUTORIZADO'))
with check (public.is_super_admin() or public.current_role()::text in ('DEPUTY_ATTORNEY_GENERAL','JUEZ','FISCAL','INVESTIGADOR','ADMINISTRADOR','PERSONAL_AUTORIZADO'));

drop policy if exists permission_overrides_owner_only on public.user_permission_overrides;
create policy permission_overrides_owner_only on public.user_permission_overrides
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

do $$
begin
  alter publication supabase_realtime add table public.public_notices;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.cases;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.case_actions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.proceedings;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.hearings;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.roleplay_warrants;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.roleplay_applications;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.audit_logs;
exception when duplicate_object then null;
end $$;

insert into public.system_settings(key,value) values
('roleplay_identity', '{"name":"Department of Justice Roleplay","notice":"ROLEPLAY WEBSITE — This website is fictional and is not affiliated with the real United States Department of Justice.","developed_by":"kcobainn"}')
on conflict (key) do update set value = excluded.value, updated_at = now();
