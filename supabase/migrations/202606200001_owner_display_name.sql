-- Conserva la cuenta propietaria existente y actualiza únicamente su identidad visible.
create or replace function public.bootstrap_system_owner(
  p_email text,
  p_display_name text default 'Lilith D''Amico'
)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare target_id uuid; existing_owner uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres','supabase_admin') then
    raise exception 'Owner bootstrap requires service_role or SQL Editor';
  end if;
  select id into target_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if target_id is null then raise exception 'Create the Auth user before bootstrapping the owner'; end if;
  select id into existing_owner from public.profiles where is_owner limit 1;
  if existing_owner is not null and existing_owner <> target_id then
    raise exception 'An owner already exists; ownership cannot be transferred';
  end if;
  insert into public.profiles(id, email, full_name, role, is_active, is_owner)
  select id, email, p_display_name, 'SUPER_ADMIN', true, true from auth.users where id = target_id
  on conflict (id) do update set full_name = excluded.full_name, role = 'SUPER_ADMIN', is_active = true, is_owner = true;
  return target_id;
end $$;

revoke all on function public.bootstrap_system_owner(text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_system_owner(text, text) to service_role;

update public.profiles
set full_name = 'Lilith D''Amico'
where is_owner
  and role = 'SUPER_ADMIN'
  and full_name is distinct from 'Lilith D''Amico';

update public.signature_requests
set signer_name = 'Lilith D''Amico'
where signer_user_id in (
  select id from public.profiles where is_owner and role = 'SUPER_ADMIN'
)
and lower(trim(signer_name)) = 'propietario del sistema';

update public.signatures
set signer_name = 'Lilith D''Amico'
where signer_user_id in (
  select id from public.profiles where is_owner and role = 'SUPER_ADMIN'
)
and lower(trim(signer_name)) = 'propietario del sistema';
