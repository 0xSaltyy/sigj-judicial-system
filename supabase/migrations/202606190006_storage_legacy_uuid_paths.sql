-- Las carpetas privadas usan el UUID del expediente. PostgreSQL admite UUID
-- deterministas sin bits RFC de versión; la política previa era más restrictiva.
drop policy if exists storage_internal_read on storage.objects;
create policy storage_internal_read on storage.objects for select to authenticated using (
  bucket_id in ('case-documents','providence-files')
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_access_case(split_part(name, '/', 1)::uuid)
);

drop policy if exists storage_internal_insert on storage.objects;
create policy storage_internal_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('case-documents','providence-files')
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_access_case(split_part(name, '/', 1)::uuid)
);

drop policy if exists storage_internal_delete on storage.objects;
create policy storage_internal_delete on storage.objects for delete to authenticated using (
  bucket_id in ('case-documents','providence-files')
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_access_case(split_part(name, '/', 1)::uuid)
  and (
    owner_id = auth.uid()::text
    or public.is_owner()
    or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','ARCHIVO')
  )
);
