-- Rich expediente document metadata and guarded private Storage paths.

alter table public.documents
  add column if not exists description text,
  add column if not exists document_type text not null default 'Otro',
  add column if not exists document_date date,
  add column if not exists folios integer,
  add column if not exists source text,
  add column if not exists status text not null default 'active',
  add column if not exists uploaded_by_name text;

alter table public.documents drop constraint if exists documents_folios_check;
alter table public.documents
  add constraint documents_folios_check
  check (folios is null or folios between 1 and 100000);

alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents
  add constraint documents_status_check
  check (status in ('active', 'archived'));

update storage.buckets
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]::text[]
where id = 'case-documents';

create or replace function public.storage_case_id(p_name text)
returns uuid
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  v_part text;
begin
  v_part := case
    when split_part(p_name, '/', 1) = 'cases' then split_part(p_name, '/', 2)
    else split_part(p_name, '/', 1)
  end;

  if v_part !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_part::uuid;
end;
$$;

drop policy if exists storage_internal_read on storage.objects;
create policy storage_internal_read on storage.objects
for select to authenticated
using (
  bucket_id in ('case-documents', 'providence-files', 'signatures')
  and public.storage_case_id(name) is not null
  and public.can_access_case(public.storage_case_id(name))
);

drop policy if exists storage_internal_insert on storage.objects;
create policy storage_internal_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('case-documents', 'providence-files', 'signatures')
  and public.storage_case_id(name) is not null
  and public.can_access_case(public.storage_case_id(name))
);

drop policy if exists storage_internal_delete on storage.objects;
create policy storage_internal_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('case-documents', 'providence-files', 'signatures')
  and public.storage_case_id(name) is not null
  and public.can_access_case(public.storage_case_id(name))
  and (
    owner_id = auth.uid()::text
    or public.is_owner()
    or public.current_role() in ('SUPER_ADMIN', 'SECRETARIO_GENERAL', 'SECRETARIO_DESPACHO', 'ARCHIVO')
    or public.has_effective_permission('documentos', 'archive')
    or public.has_effective_permission('documentos', 'hard_delete')
  )
);

create or replace function public.enforce_document_public_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.visibility = 'public' and new.case_id is not null and not exists (
    select 1
    from public.cases c
    where c.id = new.case_id
      and c.confidentiality_level = 'Público'
      and c.public_visibility = true
  ) then
    raise exception 'El expediente no permite documentos públicos';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_public_visibility_guard on public.documents;
create trigger documents_public_visibility_guard
before insert or update of visibility, case_id on public.documents
for each row execute function public.enforce_document_public_visibility();

create or replace function public.audit_document_visibility_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.visibility is distinct from new.visibility then
    insert into public.audit_logs (
      user_id, action, table_name, record_id, description, old_values, new_values, metadata
    ) values (
      auth.uid(),
      'DOCUMENT_VISIBILITY_CHANGED',
      'documents',
      new.id,
      'Visibilidad del documento actualizada',
      jsonb_build_object('visibility', old.visibility),
      jsonb_build_object('visibility', new.visibility),
      jsonb_build_object('case_id', new.case_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists documents_visibility_audit on public.documents;
create trigger documents_visibility_audit
after update of visibility on public.documents
for each row execute function public.audit_document_visibility_change();

create or replace function public.sync_document_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.status := case when new.archived_at is null then 'active' else 'archived' end;
  return new;
end;
$$;

drop trigger if exists documents_status_sync on public.documents;
create trigger documents_status_sync
before insert or update of archived_at on public.documents
for each row execute function public.sync_document_status();

create or replace function public.register_case_document(
  p_case_id uuid,
  p_document_id uuid,
  p_title text,
  p_document_type text,
  p_custom_type text,
  p_description text,
  p_visibility public.visibility_level,
  p_public_confirmed boolean,
  p_document_date date,
  p_folios integer,
  p_source text,
  p_original_name text,
  p_file_path text,
  p_file_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.cases%rowtype;
  v_profile public.profiles%rowtype;
  v_type text;
  v_prefix text;
begin
  if auth.uid() is null then
    raise exception 'Autenticación requerida';
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid() and is_active = true;
  if not found then
    raise exception 'Perfil activo requerido';
  end if;

  select * into v_case from public.cases where id = p_case_id;
  if not found then
    raise exception 'Expediente no encontrado';
  end if;

  if not public.can_access_case(p_case_id)
     or not public.has_effective_permission('documentos', 'create') then
    raise exception 'No tiene permiso para agregar documentos';
  end if;

  if v_case.archived_at is not null and not public.is_owner() then
    raise exception 'Solo la cuenta propietaria puede agregar documentos a un expediente archivado';
  end if;

  if p_visibility = 'public' and (
    not coalesce(p_public_confirmed, false)
    or v_case.confidentiality_level <> 'Público'
    or not coalesce(v_case.public_visibility, false)
  ) then
    raise exception 'La publicación requiere confirmación y un expediente con visibilidad pública';
  end if;

  if nullif(btrim(p_title), '') is null or length(p_title) > 180 then
    raise exception 'Título no válido';
  end if;
  if p_size_bytes <= 0 or p_size_bytes > 20971520 then
    raise exception 'Tamaño de archivo no válido';
  end if;
  if p_file_type not in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv', 'image/png', 'image/jpeg', 'image/webp'
  ) then
    raise exception 'Tipo MIME no permitido';
  end if;
  if length(p_original_name) > 255
     or length(coalesce(p_description, '')) > 2000
     or length(coalesce(p_source, '')) > 180 then
    raise exception 'Metadatos del documento demasiado extensos';
  end if;
  if p_folios is not null and (p_folios < 1 or p_folios > 100000) then
    raise exception 'Número de folios no válido';
  end if;

  v_type := case
    when p_document_type = 'Otro' then nullif(btrim(p_custom_type), '')
    else nullif(btrim(p_document_type), '')
  end;
  if v_type is null or length(v_type) > 100 then
    raise exception 'Tipo de documento no válido';
  end if;

  v_prefix := 'cases/' || p_case_id::text || '/documents/' || p_document_id::text || '/';
  if left(p_file_path, length(v_prefix)) <> v_prefix
     or position('/' in substring(p_file_path from length(v_prefix) + 1)) > 0 then
    raise exception 'Ruta de almacenamiento no válida';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'case-documents' and name = p_file_path
  ) then
    raise exception 'El archivo privado no existe en Storage';
  end if;

  insert into public.documents (
    id, case_id, uploaded_by, uploaded_by_name, title, document_type,
    description, visibility, document_date, folios, source, original_name,
    file_path, file_type, size_bytes, status
  ) values (
    p_document_id, p_case_id, auth.uid(), v_profile.full_name,
    btrim(p_title), v_type, nullif(btrim(p_description), ''), p_visibility,
    p_document_date, p_folios, nullif(btrim(p_source), ''), p_original_name,
    p_file_path, p_file_type, p_size_bytes, 'active'
  );

  insert into public.case_actions (
    case_id, action_type, title, description, action_date, visibility, created_by, document_id
  ) values (
    p_case_id,
    'Documento incorporado',
    'Documento agregado: ' || btrim(p_title),
    coalesce(nullif(btrim(p_description), ''), v_type || ' · ' || p_original_name),
    coalesce(p_document_date, current_date)::timestamptz,
    case when p_visibility = 'public' then 'public'::public.visibility_level else 'internal'::public.visibility_level end,
    auth.uid(),
    p_document_id
  );

  insert into public.audit_logs (
    user_id, action, table_name, record_id, description, new_values, metadata
  ) values (
    auth.uid(), 'DOCUMENT_UPLOADED', 'documents', p_document_id,
    'Documento agregado al expediente',
    jsonb_build_object(
      'title', btrim(p_title),
      'document_type', v_type,
      'visibility', p_visibility,
      'size_bytes', p_size_bytes
    ),
    jsonb_build_object('case_id', p_case_id, 'file_path', p_file_path)
  );

  return p_document_id;
end;
$$;

revoke all on function public.register_case_document(
  uuid, uuid, text, text, text, text, public.visibility_level, boolean,
  date, integer, text, text, text, text, bigint
) from public, anon;
grant execute on function public.register_case_document(
  uuid, uuid, text, text, text, text, public.visibility_level, boolean,
  date, integer, text, text, text, text, bigint
) to authenticated;
