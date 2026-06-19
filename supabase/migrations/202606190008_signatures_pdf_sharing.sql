-- Actas, firmas, providencias PDF y acceso externo acotado.
-- Migración incremental: no altera migraciones ya aplicadas.

alter table public.case_parties add column if not exists updated_at timestamptz not null default now();
alter table public.case_parties add column if not exists archived_at timestamptz;
alter table public.case_parties add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.proceedings add column if not exists creation_mode text not null default 'editor'
  check (creation_mode in ('editor','pdf','mixed'));
alter table public.proceedings add column if not exists pdf_path text;
alter table public.proceedings add column if not exists pdf_original_name text;
alter table public.proceedings add column if not exists pdf_size_bytes bigint check (pdf_size_bytes is null or pdf_size_bytes >= 0);
alter table public.proceedings add column if not exists providence_date date;
alter table public.proceedings add column if not exists requires_signature boolean not null default true;

create table if not exists public.hearing_minutes (
  id uuid primary key default gen_random_uuid(),
  hearing_id uuid not null unique references public.hearings(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  started_at timestamptz,
  ended_at timestamptz,
  chamber text,
  interveners text,
  attendees text,
  absences text,
  development_markdown text not null default '',
  decisions_markdown text not null default '',
  evidence_markdown text not null default '',
  records_markdown text not null default '',
  observations_markdown text not null default '',
  closing_markdown text not null default '',
  status text not null default 'Borrador' check (status in ('Borrador','Finalizada')),
  secretary_signature_required boolean not null default true,
  judge_signature_required boolean not null default false,
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hearing_minutes_case_idx on public.hearing_minutes(case_id);

create table if not exists public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  target_type text not null check (target_type in ('proceeding','hearing_minute','certificate','document')),
  target_id uuid not null,
  signer_type text not null check (signer_type in ('internal','role','dependency','external')),
  signer_user_id uuid references auth.users(id) on delete set null,
  signer_role public.app_role,
  signer_dependency_id uuid references public.dependencies(id) on delete set null,
  signer_name text not null,
  signer_title text not null,
  signer_email_masked text,
  signer_email_hash text,
  purpose text not null,
  signature_order smallint not null default 1 check (signature_order between 1 and 20),
  status text not null default 'pending' check (status in ('pending','signed','declined','revoked')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  signed_at timestamptz,
  revoked_at timestamptz,
  requested_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists signature_requests_target_idx on public.signature_requests(target_type,target_id,signature_order);
create index if not exists signature_requests_case_idx on public.signature_requests(case_id,created_at desc);

create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.signature_requests(id) on delete restrict,
  case_id uuid not null references public.cases(id) on delete cascade,
  target_type text not null check (target_type in ('proceeding','hearing_minute','certificate','document')),
  target_id uuid not null,
  signer_user_id uuid references auth.users(id) on delete set null,
  signer_name text not null,
  signer_title text not null,
  signer_email_masked text,
  signature_image_path text not null unique,
  purpose text not null,
  signature_order smallint not null default 1,
  status text not null default 'signed' check (status in ('signed','revoked')),
  signed_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip_hash text,
  user_agent text,
  verification_code text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists signatures_target_idx on public.signatures(target_type,target_id,signature_order);

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  label text not null,
  external_name text,
  external_email_masked text,
  external_email_hash text,
  token_hash text not null unique,
  include_documents boolean not null default false,
  include_proceedings boolean not null default true,
  include_hearings boolean not null default false,
  include_parties boolean not null default false,
  actions_scope text not null default 'public' check (actions_scope in ('public','all')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_access_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists share_links_case_idx on public.share_links(case_id,created_at desc);

create table if not exists public.share_link_access_events (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid references public.share_links(id) on delete cascade,
  event_type text not null check (event_type in ('opened','denied','revoked','expired')),
  ip_hash text,
  user_agent text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create trigger case_parties_updated before update on public.case_parties
for each row execute function public.set_updated_at();
create trigger hearing_minutes_updated before update on public.hearing_minutes
for each row execute function public.set_updated_at();
create trigger signature_requests_updated before update on public.signature_requests
for each row execute function public.set_updated_at();

create trigger audit_case_parties after insert or update or delete on public.case_parties
for each row execute function public.audit_change();
create trigger audit_hearing_minutes after insert or update or delete on public.hearing_minutes
for each row execute function public.audit_change();
create trigger audit_signature_requests after insert or update or delete on public.signature_requests
for each row execute function public.audit_change();
create trigger audit_signatures after insert or update or delete on public.signatures
for each row execute function public.audit_change();
create trigger audit_share_links after insert or update or delete on public.share_links
for each row execute function public.audit_change();

alter table public.hearing_minutes enable row level security;
alter table public.signature_requests enable row level security;
alter table public.signatures enable row level security;
alter table public.share_links enable row level security;
alter table public.share_link_access_events enable row level security;

create policy hearing_minutes_read on public.hearing_minutes for select to authenticated
using (public.can_access_case(case_id));
create policy hearing_minutes_write on public.hearing_minutes for all to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in
  ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO')))
with check (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in
  ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO')));

create policy signature_requests_read on public.signature_requests for select to authenticated
using (public.can_access_case(case_id));
create policy signature_requests_write on public.signature_requests for all to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in
  ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')))
with check (public.can_access_case(case_id) and requested_by = auth.uid());
create policy signatures_read on public.signatures for select to authenticated
using (public.can_access_case(case_id));

create policy share_links_read on public.share_links for select to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or created_by = auth.uid()));
create policy share_links_write on public.share_links for all to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or created_by = auth.uid()))
with check (public.can_access_case(case_id) and created_by = auth.uid());

drop policy if exists parties_read on public.case_parties;
create policy parties_read on public.case_parties for select to authenticated using (public.can_access_case(case_id));
drop policy if exists parties_write on public.case_parties;
create policy parties_write on public.case_parties for all to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or (archived_at is null and public.current_role() in ('RADICADOR','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR'))))
with check (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('RADICADOR','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
  ('signatures','signatures',false,2097152,array['image/png']),
  ('providence-files','providence-files',false,52428800,array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_internal_read on storage.objects;
create policy storage_internal_read on storage.objects for select to authenticated using (
  bucket_id in ('case-documents','providence-files','signatures')
  and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_access_case(split_part(name,'/',1)::uuid)
);
drop policy if exists storage_internal_insert on storage.objects;
create policy storage_internal_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('case-documents','providence-files','signatures')
  and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_access_case(split_part(name,'/',1)::uuid)
);

-- La acción usa este RPC para que una desclasificación requiera confirmación también
-- cuando se llama por PostgREST. El guard existente continúa anulando visibilidad pública
-- para expedientes reservados/confidenciales.
create or replace function public.update_case_secure(
  p_case_id uuid,
  p_payload jsonb,
  p_declassification_confirmation text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_old public.cases%rowtype; v_new_level text;
begin
  if auth.uid() is null or not public.can_access_case(p_case_id) then raise exception 'Acceso no autorizado'; end if;
  if not (public.is_owner() or public.current_role() in ('ADMIN_INSTITUCIONAL','RADICADOR','REPARTO','SECRETARIO_GENERAL','SECRETARIO_DESPACHO')) then
    raise exception 'No tiene permiso para editar el expediente';
  end if;
  select * into v_old from public.cases where id = p_case_id for update;
  if not found then raise exception 'Expediente no encontrado'; end if;
  if v_old.archived_at is not null and not public.is_owner() then raise exception 'Solo el propietario puede editar expedientes archivados'; end if;
  v_new_level := coalesce(p_payload->>'confidentiality_level',v_old.confidentiality_level);
  if v_old.confidentiality_level in ('Reservado','Confidencial') and v_new_level = 'Público'
     and p_declassification_confirmation is distinct from 'CONFIRMAR PUBLICACIÓN' then
    raise exception 'Escriba CONFIRMAR PUBLICACIÓN para reducir el nivel de reserva';
  end if;
  update public.cases set
    title=coalesce(nullif(p_payload->>'title',''),title), authority_type=coalesce(nullif(p_payload->>'authority_type',''),authority_type),
    chamber=coalesce(nullif(p_payload->>'chamber',''),chamber), process_type=coalesce(nullif(p_payload->>'process_type',''),process_type),
    process_subtype=coalesce(nullif(p_payload->>'process_subtype',''),process_subtype), claimant_name=coalesce(nullif(p_payload->>'claimant_name',''),claimant_name),
    defendant_name=coalesce(nullif(p_payload->>'defendant_name',''),defendant_name), summary=coalesce(nullif(p_payload->>'summary',''),summary),
    claims=coalesce(nullif(p_payload->>'claims',''),claims), department=coalesce(nullif(p_payload->>'department',''),department),
    municipality=coalesce(nullif(p_payload->>'municipality',''),municipality), reception_method=coalesce(nullif(p_payload->>'reception_method',''),reception_method),
    confidentiality_level=v_new_level, public_visibility=coalesce((p_payload->>'public_visibility')::boolean,public_visibility),
    assigned_judge_id=case when p_payload ? 'assigned_judge_id' then nullif(p_payload->>'assigned_judge_id','')::uuid else assigned_judge_id end,
    dependency_id=coalesce(nullif(p_payload->>'dependency_id','')::uuid,dependency_id), status=coalesce(nullif(p_payload->>'status',''),status),
    observations=case when p_payload ? 'observations' then nullif(p_payload->>'observations','') else observations end
  where id=p_case_id;
  perform public.log_security_event('CASE_FULL_UPDATE','cases',p_case_id,'Expediente actualizado desde el flujo seguro',
    jsonb_build_object('old_confidentiality',v_old.confidentiality_level,'new_confidentiality',v_new_level,'old_judge',v_old.assigned_judge_id,'new_judge',p_payload->>'assigned_judge_id','old_status',v_old.status,'new_status',p_payload->>'status'));
end $$;
revoke all on function public.update_case_secure(uuid,jsonb,text) from public,anon;
grant execute on function public.update_case_secure(uuid,jsonb,text) to authenticated;

grant select,insert,update on public.hearing_minutes,public.signature_requests,public.signatures,public.share_links to authenticated;

create or replace view public.public_proceedings with (security_barrier = true) as
select p.id,p.case_id,p.providence_number,p.title,p.type,p.chamber,p.content_markdown,p.published_at,
       c.internal_number,c.judicial_number,p.creation_mode,p.providence_date,p.requires_signature
from public.proceedings p join public.cases c on c.id=p.case_id
where p.status='Publicado' and p.visibility='public' and p.archived_at is null
  and c.archived_at is null and c.public_visibility and c.confidentiality_level='Público';
grant select on public.public_proceedings to anon,authenticated;
