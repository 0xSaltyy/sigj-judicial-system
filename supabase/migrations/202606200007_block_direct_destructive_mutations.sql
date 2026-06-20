-- Todo borrado judicial permanente debe pasar por el RPC auditado de ciclo de vida.
-- Dentro del RPC SECURITY DEFINER current_user es su propietario; una llamada directa
-- desde PostgREST conserva el rol autenticado y queda bloqueada por esta guarda.
create or replace function public.block_non_owner_hard_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Use el flujo auditado de eliminación definitiva';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_hearing_minutes_hard_delete on public.hearing_minutes;
create trigger protect_hearing_minutes_hard_delete
before delete on public.hearing_minutes
for each row execute function public.block_non_owner_hard_delete();

-- Solicitar/firmar/revocar significa insertar o cambiar estado, nunca borrar la evidencia.
drop policy if exists signature_requests_write on public.signature_requests;
drop policy if exists signature_requests_insert on public.signature_requests;
drop policy if exists signature_requests_update on public.signature_requests;
create policy signature_requests_insert on public.signature_requests
for insert to authenticated
with check (
  public.can_access_case(case_id)
  and requested_by = auth.uid()
  and public.has_effective_permission('firmas','request')
);
create policy signature_requests_update on public.signature_requests
for update to authenticated
using (
  public.can_access_case(case_id)
  and (
    public.has_effective_permission('firmas','request')
    or public.has_effective_permission('firmas','sign')
    or public.has_effective_permission('firmas','revoke')
  )
)
with check (
  public.can_access_case(case_id)
  and (
    public.has_effective_permission('firmas','sign')
    or public.has_effective_permission('firmas','revoke')
  )
);

create or replace function public.guard_signature_request_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(auth.role(),'') = 'service_role' then return new; end if;
  if (to_jsonb(new) - array['status','signed_at','revoked_at','updated_at'])
     is distinct from
     (to_jsonb(old) - array['status','signed_at','revoked_at','updated_at']) then
    raise exception 'Los datos de la solicitud de firma son inmutables';
  end if;
  if new.status = 'revoked' and old.status is distinct from 'revoked'
     and public.has_effective_permission('firmas','revoke') then return new; end if;
  if new.status = 'signed' and old.status is distinct from 'signed'
     and public.has_effective_permission('firmas','sign') then return new; end if;
  raise exception 'Transición de solicitud de firma no permitida';
end $$;
drop trigger if exists signature_requests_update_guard on public.signature_requests;
create trigger signature_requests_update_guard before update on public.signature_requests
for each row execute function public.guard_signature_request_update();

-- Los enlaces externos se revocan por UPDATE; no se eliminan directamente.
drop policy if exists share_links_write on public.share_links;
drop policy if exists share_links_insert on public.share_links;
drop policy if exists share_links_update on public.share_links;
create policy share_links_insert on public.share_links
for insert to authenticated
with check (
  public.can_access_case(case_id)
  and created_by = auth.uid()
  and public.has_effective_permission('enlaces','create')
);
create policy share_links_update on public.share_links
for update to authenticated
using (
  public.can_access_case(case_id)
  and (public.is_owner() or created_by = auth.uid())
  and public.has_effective_permission('enlaces','revoke')
)
with check (
  public.can_access_case(case_id)
  and (public.is_owner() or created_by = auth.uid())
  and public.has_effective_permission('enlaces','revoke')
);

create or replace function public.guard_share_revocation_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(auth.role(),'') = 'service_role' then return new; end if;
  if (to_jsonb(new) - array['revoked_at']) is distinct from (to_jsonb(old) - array['revoked_at'])
     or old.revoked_at is not null or new.revoked_at is null
     or not public.has_effective_permission('enlaces','revoke') then
    raise exception 'El enlace sólo puede marcarse como revocado';
  end if;
  return new;
end $$;
drop trigger if exists share_links_revocation_guard on public.share_links;
create trigger share_links_revocation_guard before update on public.share_links
for each row execute function public.guard_share_revocation_update();

create or replace function public.guard_record_share_revocation_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(auth.role(),'') = 'service_role' then return new; end if;
  if (to_jsonb(new) - array['revoked_at']) is distinct from (to_jsonb(old) - array['revoked_at'])
     or old.revoked_at is not null or new.revoked_at is null then
    raise exception 'El acceso compartido sólo puede marcarse como revocado';
  end if;
  return new;
end $$;
drop trigger if exists record_shares_revocation_guard on public.record_shares;
create trigger record_shares_revocation_guard before update on public.record_shares
for each row execute function public.guard_record_share_revocation_update();

notify pgrst, 'reload schema';
