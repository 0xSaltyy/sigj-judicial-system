-- Public-safe tracking-code lookup for DOJ roleplay applications.

create or replace function public.lookup_roleplay_application_status(p_tracking_code text)
returns table(
  tracking_code text,
  applicant_name text,
  application_type text,
  status text,
  submitted_at timestamptz,
  updated_at timestamptz,
  public_message text
)
language sql
security definer
set search_path = public
as $$
  select
    a.tracking_code::text,
    a.applicant_name::text,
    a.application_type::text,
    a.status::text,
    a.submitted_at,
    a.updated_at,
    a.public_message::text
  from public.roleplay_applications a
  where upper(a.tracking_code) = upper(trim(coalesce(p_tracking_code, '')))
    and a.archived_at is null
  limit 1
$$;

revoke all on function public.lookup_roleplay_application_status(text) from public;
grant execute on function public.lookup_roleplay_application_status(text) to anon, authenticated;

notify pgrst, 'reload schema';
