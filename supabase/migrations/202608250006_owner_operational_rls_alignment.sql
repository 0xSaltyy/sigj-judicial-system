-- Ensure the protected roleplay owner has operational access across core
-- authenticated modules while preserving RLS for everyone else.

drop policy if exists hearings_owner_all on public.hearings;
create policy hearings_owner_all on public.hearings
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists roleplay_warrants_owner_all on public.roleplay_warrants;
create policy roleplay_warrants_owner_all on public.roleplay_warrants
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists public_notices_owner_all on public.public_notices;
create policy public_notices_owner_all on public.public_notices
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists roleplay_applications_owner_review on public.roleplay_applications;
create policy roleplay_applications_owner_review on public.roleplay_applications
  for select to authenticated
  using (public.is_owner());

drop policy if exists roleplay_applications_owner_update on public.roleplay_applications;
create policy roleplay_applications_owner_update on public.roleplay_applications
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists audit_logs_owner_read on public.audit_logs;
create policy audit_logs_owner_read on public.audit_logs
  for select to authenticated
  using (public.is_owner());

notify pgrst, 'reload schema';
