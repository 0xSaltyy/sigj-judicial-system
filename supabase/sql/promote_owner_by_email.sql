-- Promote an existing Supabase Auth user to OWNER / Attorney General.
-- 1. Create the user in Supabase Authentication first with a roleplay .test email.
-- 2. Replace pambondi@doj-roleplay.test with that Auth email.
-- 3. Keep the profile email as the visible, fictional institutional email only.
-- 3. Run from Supabase SQL Editor or with:
--    npx supabase db query --linked --file supabase/sql/promote_owner_by_email.sql
--
-- Do not commit real passwords. This script does not set or store passwords.

update public.profiles
set
  role = 'OWNER',
  full_name = 'Pam Bondi',
  email = 'pambondi@doj.gov',
  position_title = 'Attorney General',
  is_active = true,
  is_owner = true,
  updated_at = now()
where id = (
  select id
  from auth.users
  where lower(email) = lower('pambondi@doj-roleplay.test')
);

insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
select
  id,
  'OWNER_BOOTSTRAP',
  'profiles',
  id,
  'Initial OWNER / Attorney General account promoted by email',
  jsonb_build_object(
    'role', 'OWNER',
    'position_title', 'Attorney General',
    'auth_email', 'pambondi@doj-roleplay.test',
    'visible_roleplay_email', 'pambondi@doj.gov'
  )
from public.profiles
where id = (
  select id
  from auth.users
  where lower(email) = lower('pambondi@doj-roleplay.test')
);
