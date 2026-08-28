-- Allow explicit, server-side owner bootstrap/transfer operations while keeping
-- normal owner protections strict for application users.

create or replace function public.guard_profile_privileges() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  v_self_profile_update boolean:=coalesce(current_setting('sigj.self_profile_update',true),'')='yes';
  v_owner_bootstrap boolean:=coalesce(current_setting('sigj.owner_bootstrap',true),'')='yes';
begin
  if tg_op='DELETE' then
    if old.is_owner and not v_owner_bootstrap then raise exception 'The owner account cannot be deleted'; end if;
    if auth.uid() is not null and not public.is_owner() and not v_owner_bootstrap then raise exception 'Only the owner may delete profiles'; end if;
    return old;
  end if;

  if old.is_owner and not v_owner_bootstrap and (
    not new.is_owner
    or new.role not in ('SUPER_ADMIN','OWNER','ATTORNEY_GENERAL')
    or not new.is_active
    or new.email is distinct from old.email
  ) then raise exception 'The owner account is protected'; end if;

  if old.is_owner
     and not v_owner_bootstrap
     and (new.institution_id is distinct from old.institution_id or new.dependency_id is distinct from old.dependency_id)
     and not (auth.uid()=old.id and v_self_profile_update) then
    raise exception 'The owner institutional assignment is protected';
  end if;

  if (
    old.role is distinct from new.role or old.is_active is distinct from new.is_active
    or old.email is distinct from new.email or old.institution_id is distinct from new.institution_id
    or old.dependency_id is distinct from new.dependency_id or old.is_owner is distinct from new.is_owner
  ) and auth.uid() is not null and not public.is_owner()
    and not v_owner_bootstrap
    and not (auth.uid()=old.id and v_self_profile_update) then
    raise exception 'Only the owner may change user access';
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
