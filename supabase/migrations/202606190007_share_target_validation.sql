-- Los destinos de una compartición deben pertenecer al directorio interno activo.
create or replace function public.is_valid_share_target(
  p_user_id uuid,
  p_role public.app_role,
  p_dependency_id uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when num_nonnulls(p_user_id, p_role, p_dependency_id) <> 1 then false
    when p_user_id is not null then exists (
      select 1 from public.profiles
      where id = p_user_id and is_active and role <> 'CONSULTA_PUBLICA'
    )
    when p_role is not null then p_role <> 'CONSULTA_PUBLICA'
    else exists (
      select 1 from public.dependencies
      where id = p_dependency_id and is_active and archived_at is null
    )
  end
$$;
revoke all on function public.is_valid_share_target(uuid, public.app_role, uuid) from public, anon;
grant execute on function public.is_valid_share_target(uuid, public.app_role, uuid) to authenticated;

drop policy if exists record_shares_insert on public.record_shares;
create policy record_shares_insert on public.record_shares for insert to authenticated with check (
  shared_by = auth.uid()
  and public.can_access_case(case_id)
  and public.is_valid_share_target(target_user_id, target_role, target_dependency_id)
  and (
    public.is_owner() or public.current_role() in (
      'SUPER_ADMIN','ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL',
      'JUEZ_CIRCUITO','JUEZ_MUNICIPAL','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR','ARCHIVO'
    )
  )
);
