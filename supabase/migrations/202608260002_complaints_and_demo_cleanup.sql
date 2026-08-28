-- Public complaints/intake system and safe cleanup of known seed/demo records.
-- This migration is additive for schema and targeted for demo cleanup.

create extension if not exists pgcrypto;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null unique default ('DEN-' || extract(year from now())::int || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  private_code_hash text not null,
  anonymous boolean not null default false,
  complainant_name text,
  contact_method text,
  category text not null,
  reported_subject text,
  description text not null,
  occurred_on date,
  location text,
  status text not null default 'Recibida' check (status in ('Recibida','En revisión','Admitida','Información requerida','En investigación','Cerrada','Archivada')),
  priority text not null default 'Normal' check (priority in ('Baja','Normal','Alta','Urgente')),
  assigned_to uuid references public.profiles(id) on delete set null,
  public_response text,
  internal_notes text,
  submitted_at timestamptz not null default now(),
  public_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users(id)
);

create table if not exists public.complaint_attachments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  file_path text not null unique,
  original_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  uploaded_at timestamptz not null default now()
);

drop trigger if exists complaints_updated on public.complaints;
create trigger complaints_updated before update on public.complaints for each row execute function public.set_updated_at();

drop trigger if exists audit_complaints on public.complaints;
create trigger audit_complaints after insert or update or delete on public.complaints for each row execute function public.audit_change();
drop trigger if exists audit_complaint_attachments on public.complaint_attachments;
create trigger audit_complaint_attachments after insert or update or delete on public.complaint_attachments for each row execute function public.audit_change();

alter table public.complaints enable row level security;
alter table public.complaint_attachments enable row level security;

drop policy if exists complaints_public_insert on public.complaints;
create policy complaints_public_insert on public.complaints
for insert to anon, authenticated
with check (length(description) >= 20 and length(category) >= 3);

drop policy if exists complaints_staff_read on public.complaints;
create policy complaints_staff_read on public.complaints
for select to authenticated
using (public.is_super_admin() or public.current_role()::text in ('ATTORNEY_GENERAL','DEPUTY_ATTORNEY_GENERAL','ADMINISTRADOR','PERSONAL_AUTORIZADO','INVESTIGADOR','FISCAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO'));

drop policy if exists complaints_staff_update on public.complaints;
create policy complaints_staff_update on public.complaints
for update to authenticated
using (public.is_super_admin() or public.current_role()::text in ('ATTORNEY_GENERAL','DEPUTY_ATTORNEY_GENERAL','ADMINISTRADOR','PERSONAL_AUTORIZADO','INVESTIGADOR','FISCAL'))
with check (public.is_super_admin() or public.current_role()::text in ('ATTORNEY_GENERAL','DEPUTY_ATTORNEY_GENERAL','ADMINISTRADOR','PERSONAL_AUTORIZADO','INVESTIGADOR','FISCAL'));

drop policy if exists complaint_attachments_staff_read on public.complaint_attachments;
create policy complaint_attachments_staff_read on public.complaint_attachments
for select to authenticated
using (exists(select 1 from public.complaints c where c.id=complaint_id and (public.is_super_admin() or public.current_role()::text in ('ATTORNEY_GENERAL','DEPUTY_ATTORNEY_GENERAL','ADMINISTRADOR','PERSONAL_AUTORIZADO','INVESTIGADOR','FISCAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO'))));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('complaint-files','complaint-files',false,10485760,array['application/pdf','image/png','image/jpeg','text/plain'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists complaint_files_staff_read on storage.objects;
create policy complaint_files_staff_read on storage.objects for select to authenticated using (
  bucket_id='complaint-files' and (public.is_super_admin() or public.current_role()::text in ('ATTORNEY_GENERAL','DEPUTY_ATTORNEY_GENERAL','ADMINISTRADOR','PERSONAL_AUTORIZADO','INVESTIGADOR','FISCAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO'))
);

create or replace function public.lookup_complaint_status(p_tracking_number text, p_private_code text)
returns table(
  tracking_number text,
  status text,
  category text,
  reported_subject text,
  submitted_at timestamptz,
  public_updated_at timestamptz,
  public_response text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_sleep(0.25);
  return query
  select c.tracking_number, c.status, c.category, c.reported_subject, c.submitted_at, c.public_updated_at, c.public_response
  from public.complaints c
  where c.tracking_number = upper(trim(p_tracking_number))
    and c.private_code_hash = encode(digest(trim(p_private_code), 'sha256'), 'hex')
    and c.archived_at is null
  limit 1;
end;
$$;
revoke all on function public.lookup_complaint_status(text,text) from public;
grant execute on function public.lookup_complaint_status(text,text) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.complaints;
exception when duplicate_object then null;
end $$;

-- Remove only known initial demo/seed data by fixed IDs and unmistakable demo text.
delete from public.judicial_state_items where judicial_state_id in ('70000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002');
delete from public.judicial_states where id in ('70000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002') or state_number like 'EST-DEMO-%';
delete from public.public_notices where id in ('60000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002') or content_markdown ilike '%demostrativa%' or content_markdown ilike '%ficticia de demostración%';
delete from public.proceedings where id in ('50000000-0000-0000-0000-000000000001') or content_markdown ilike '%Documento ficticio de demostración%';
delete from public.hearings where id in ('40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002');
delete from public.case_actions where id in ('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000004');
delete from public.case_parties where case_id in ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004');
delete from public.cases where id in ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004')
  or title ilike '%simulado%' or summary ilike '%fictic%' or summary ilike '%demostr%';
