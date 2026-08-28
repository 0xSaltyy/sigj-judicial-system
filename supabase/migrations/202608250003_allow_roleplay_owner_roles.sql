-- Permit the protected owner to use the DOJ roleplay role model.
-- Legacy SUPER_ADMIN remains valid, but OWNER / ATTORNEY_GENERAL may also be
-- the protected owner role.

alter table public.profiles
  drop constraint if exists owner_must_be_super_admin;

alter table public.profiles
  add constraint owner_must_have_owner_privileges
  check (
    not is_owner
    or (role in ('SUPER_ADMIN','OWNER','ATTORNEY_GENERAL') and is_active)
  );

notify pgrst, 'reload schema';
