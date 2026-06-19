-- Funcionalidad administrativa real. Migración incremental: no modifica destructivamente la inicial.
alter table public.documents add column if not exists original_name text;
alter table public.documents add column if not exists size_bytes bigint check (size_bytes is null or size_bytes >= 0);
alter table public.documents add column if not exists deleted_at timestamptz;
alter table public.hearings add column if not exists cancellation_reason text;
alter table public.hearings add column if not exists minutes_markdown text;
alter table public.proceedings add column if not exists signed_by uuid references auth.users(id) on delete set null;
alter table public.public_notices add column if not exists excerpt text;

create or replace function public.generate_providence_number(p_prefix text default 'PROV') returns text
language plpgsql security definer set search_path = public as $$
declare y text := to_char(current_date, 'YYYY'); n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtext('providence-' || upper(p_prefix) || '-' || y));
  select count(*) + 1 into n from public.proceedings where extract(year from created_at) = extract(year from current_date);
  return format('%s-%s-%s', upper(p_prefix), y, lpad(n::text, 5, '0'));
end $$;

create or replace function public.generate_state_number(p_prefix text default 'EST') returns text
language plpgsql security definer set search_path = public as $$
declare y text := to_char(current_date, 'YYYY'); n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtext('state-' || upper(p_prefix) || '-' || y));
  select count(*) + 1 into n from public.judicial_states where extract(year from state_date) = extract(year from current_date);
  return format('%s-%s-%s', upper(p_prefix), y, lpad(n::text, 4, '0'));
end $$;

create or replace function public.generate_certificate_number(p_prefix text default 'CONST') returns text
language plpgsql security definer set search_path = public as $$
declare y text := to_char(current_date, 'YYYY'); n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtext('certificate-' || upper(p_prefix) || '-' || y));
  select count(*) + 1 into n from public.certificates where extract(year from issued_at) = extract(year from current_date);
  return format('%s-%s-%s', upper(p_prefix), y, lpad(n::text, 5, '0'));
end $$;

revoke all on function public.generate_providence_number(text), public.generate_state_number(text), public.generate_certificate_number(text) from public, anon;
grant execute on function public.generate_providence_number(text), public.generate_state_number(text), public.generate_certificate_number(text) to authenticated;

-- Alcance real por expediente. SECURITY DEFINER evita recursión al evaluar RLS.
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
    )
  )
$$;
revoke all on function public.can_access_case(uuid) from public, anon;
grant execute on function public.can_access_case(uuid) to authenticated;

drop policy if exists cases_internal_read on public.cases;
create policy cases_internal_read on public.cases for select to authenticated using (public.can_access_case(id));

drop policy if exists radications_read on public.radications;
create policy radications_read on public.radications for select to authenticated using (public.can_access_case(case_id));
drop policy if exists parties_read on public.case_parties;
create policy parties_read on public.case_parties for select to authenticated using (public.can_access_case(case_id));
drop policy if exists actions_read on public.case_actions;
create policy actions_read on public.case_actions for select to authenticated using (public.can_access_case(case_id));
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated using (case_id is not null and public.can_access_case(case_id));
drop policy if exists hearings_read on public.hearings;
create policy hearings_read on public.hearings for select to authenticated using (public.can_access_case(case_id));
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using (public.can_access_case(case_id));
drop policy if exists certificates_read on public.certificates;
create policy certificates_read on public.certificates for select to authenticated using (public.can_access_case(case_id));

drop policy if exists storage_internal_read on storage.objects;
create policy storage_internal_read on storage.objects for select to authenticated using (
  bucket_id in ('case-documents','providence-files')
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.can_access_case(split_part(name, '/', 1)::uuid)
);
drop policy if exists storage_internal_insert on storage.objects;
create policy storage_internal_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('case-documents','providence-files')
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.can_access_case(split_part(name, '/', 1)::uuid)
);

drop policy if exists cases_update on public.cases;
create policy cases_update on public.cases for update to authenticated using (
  archived_at is null and public.can_access_case(id)
  and (public.is_owner() or public.current_role() in ('ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','RADICADOR','REPARTO','ARCHIVO'))
) with check (public.can_access_case(id));

drop policy if exists documents_update_own on public.documents;
create policy documents_update_own on public.documents for update to authenticated
using ((uploaded_by = auth.uid() or public.is_owner()) and case_id is not null and public.can_access_case(case_id))
with check ((uploaded_by = auth.uid() or public.is_owner()) and case_id is not null and public.can_access_case(case_id));
drop policy if exists documents_delete_own on public.documents;
create policy documents_delete_own on public.documents for delete to authenticated
using (case_id is not null and public.can_access_case(case_id) and (uploaded_by = auth.uid() or public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','ARCHIVO')));
drop policy if exists documents_upload on public.documents;
create policy documents_upload on public.documents for insert to authenticated with check (
  public.is_active_internal() and uploaded_by = auth.uid() and case_id is not null and public.can_access_case(case_id)
);
drop policy if exists storage_internal_delete on storage.objects;
create policy storage_internal_delete on storage.objects for delete to authenticated
using (
  bucket_id in ('case-documents','providence-files')
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.can_access_case(split_part(name, '/', 1)::uuid)
  and (owner_id = auth.uid()::text or public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','ARCHIVO'))
);

drop policy if exists radications_write on public.radications;
create policy radications_write on public.radications for all to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('RADICADOR','REPARTO','SECRETARIO_GENERAL')))
with check (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('RADICADOR','REPARTO','SECRETARIO_GENERAL')));
drop policy if exists parties_write on public.case_parties;
create policy parties_write on public.case_parties for all to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('RADICADOR','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')))
with check (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('RADICADOR','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')));
drop policy if exists hearings_write on public.hearings;
create policy hearings_write on public.hearings for all to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO')))
with check (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO')));
drop policy if exists proceedings_write on public.proceedings;
create policy proceedings_write on public.proceedings for all to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')))
with check (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')));
drop policy if exists notifications_write on public.notifications;
create policy notifications_write on public.notifications for all to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')))
with check (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR')));
drop policy if exists certificates_write on public.certificates;
create policy certificates_write on public.certificates for all to authenticated
using (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','ARCHIVO')))
with check (public.can_access_case(case_id) and (public.is_owner() or public.current_role() in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO','ARCHIVO')));

drop policy if exists states_write on public.judicial_states;
create policy states_write on public.judicial_states for all to authenticated
using (public.is_owner() or public.current_role() = 'SECRETARIO_GENERAL' or (public.current_role() = 'SECRETARIO_DESPACHO' and dependency_id = public.current_dependency_id()))
with check (public.is_owner() or public.current_role() = 'SECRETARIO_GENERAL' or (public.current_role() = 'SECRETARIO_DESPACHO' and dependency_id = public.current_dependency_id()));
drop policy if exists state_items_write on public.judicial_state_items;
create policy state_items_write on public.judicial_state_items for all to authenticated
using (public.can_access_case(case_id) and exists(select 1 from public.judicial_states s where s.id = judicial_state_id and (public.is_owner() or public.current_role() = 'SECRETARIO_GENERAL' or s.dependency_id = public.current_dependency_id())))
with check (public.can_access_case(case_id) and exists(select 1 from public.judicial_states s where s.id = judicial_state_id and (public.is_owner() or public.current_role() = 'SECRETARIO_GENERAL' or s.dependency_id = public.current_dependency_id())));

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'audit_documents') then
    create trigger audit_documents after insert or update or delete on public.documents for each row execute function public.audit_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_notices') then
    create trigger audit_notices after insert or update or delete on public.public_notices for each row execute function public.audit_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_states') then
    create trigger audit_states after insert or update or delete on public.judicial_states for each row execute function public.audit_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_state_items') then
    create trigger audit_state_items after insert or update or delete on public.judicial_state_items for each row execute function public.audit_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_dependencies') then
    create trigger audit_dependencies after insert or update or delete on public.dependencies for each row execute function public.audit_change();
  end if;
end $$;

create or replace view public.public_proceedings with (security_barrier = true) as
select p.id, p.case_id, p.providence_number, p.title, p.type, p.chamber,
       p.content_markdown, p.published_at, c.internal_number, c.judicial_number
from public.proceedings p
join public.cases c on c.id = p.case_id
where p.status = 'Publicado' and p.visibility = 'public'
  and c.public_visibility and c.confidentiality_level = 'Público';

create or replace view public.public_states with (security_barrier = true) as
select s.id, s.state_number, s.state_date, s.published_at, d.name as institution_name,
       count(i.id)::integer as item_count
from public.judicial_states s
join public.dependencies d on d.id = s.dependency_id
left join public.judicial_state_items i on i.judicial_state_id = s.id
where s.status = 'Publicado'
group by s.id, s.state_number, s.state_date, s.published_at, d.name;

grant select on public.public_proceedings, public.public_states to anon, authenticated;

-- El radicador necesita registrar la actuación inicial al crear un expediente.
drop policy if exists actions_write on public.case_actions;
create policy actions_write on public.case_actions for all to authenticated using (
  public.is_owner() or (public.can_access_case(case_id) and public.current_role() in (
    'MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL',
    'SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR'
  ))
) with check (
  public.is_owner() or (public.can_access_case(case_id) and public.current_role() in (
    'MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL',
    'SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR'
  )) or (
    public.current_role() = 'RADICADOR' and action_type = 'Radicación' and created_by = auth.uid()
    and exists(select 1 from public.cases c where c.id = case_id and c.created_by = auth.uid())
  )
);
