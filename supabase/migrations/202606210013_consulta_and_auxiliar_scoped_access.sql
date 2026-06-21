create or replace function public.can_access_case(p_case_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.has_effective_permission('expedientes','view',auth.uid()) and exists(
    select 1 from public.cases c join public.profiles p on p.id=auth.uid() and p.is_active
    where c.id=p_case_id and (
      (p.is_owner and p.role='SUPER_ADMIN')
      or p.role in ('SUPER_ADMIN','SECRETARIO_GENERAL','RADICADOR','REPARTO','ARCHIVO')
      or (p.role='ADMIN_INSTITUCIONAL' and (c.dependency_id=p.dependency_id or public.dependency_is_within(c.dependency_id,p.institution_id)))
      or (p.role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL') and c.assigned_judge_id=p.id)
      or (p.role in ('SECRETARIO_DESPACHO','OFICIAL_MAYOR','AUXILIAR','CONSULTA_PUBLICA') and c.dependency_id=p.dependency_id)
      or (c.created_by=p.id and public.has_effective_permission('expedientes','create',p.id))
      or public.has_active_case_share(c.id)
    )
  )
$$;
revoke all on function public.can_access_case(uuid) from public;
grant execute on function public.can_access_case(uuid) to anon,authenticated,service_role;
notify pgrst,'reload schema';
