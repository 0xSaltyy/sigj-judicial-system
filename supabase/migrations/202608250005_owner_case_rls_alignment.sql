-- Give the protected roleplay owner the same case access guarantees that the
-- legacy SUPER_ADMIN owner had, without disabling RLS.

create or replace function public.can_access_case(p_case_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_effective_permission('expedientes','view',auth.uid()) and exists(
    select 1
    from public.cases c
    join public.profiles p on p.id=auth.uid() and p.is_active
    where c.id=p_case_id and (
      public.is_owner()
      or p.role in ('SUPER_ADMIN','OWNER','ATTORNEY_GENERAL','SECRETARIO_GENERAL','RADICADOR','REPARTO','ARCHIVO')
      or (p.role='ADMIN_INSTITUCIONAL' and (c.dependency_id=p.dependency_id or public.dependency_is_within(c.dependency_id,p.institution_id)))
      or (p.role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL','JUEZ') and c.assigned_judge_id=p.id)
      or (p.role in ('SECRETARIO_DESPACHO','OFICIAL_MAYOR','AUXILIAR','CONSULTA_PUBLICA') and c.dependency_id=p.dependency_id)
      or (c.created_by=p.id and public.has_effective_permission('expedientes','create',p.id))
      or public.has_active_case_share(c.id)
    )
  )
$$;

drop policy if exists cases_owner_create on public.cases;
drop policy if exists cases_owner_read on public.cases;
drop policy if exists cases_owner_update on public.cases;

create policy cases_owner_create on public.cases
  for insert to authenticated
  with check (public.is_owner() and created_by = auth.uid());

create policy cases_owner_read on public.cases
  for select to authenticated
  using (public.is_owner());

create policy cases_owner_update on public.cases
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

notify pgrst, 'reload schema';
