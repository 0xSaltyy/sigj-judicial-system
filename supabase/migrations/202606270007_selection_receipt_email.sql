drop function if exists public.get_selection_application_receipt(text);

create or replace function public.get_selection_application_receipt(p_receipt_token text)
returns table(
  tracking_code text,
  applicant_name text,
  applicant_email text,
  submitted_at timestamptz,
  application_status text,
  process_title text,
  position_title text,
  dependency_name text,
  institution_name text
)
language sql stable security definer set search_path=public as $$
  select
    a.tracking_code::text,
    a.applicant_name::text,
    a.applicant_email::text,
    a.created_at,
    a.status::text,
    p.title::text,
    p.position_title::text,
    d.name::text,
    i.name::text
  from public.selection_applications a
  join public.selection_processes p on p.id = a.process_id
  join public.dependencies d on d.id = p.dependency_id
  join public.dependencies i on i.id = p.institution_id
  where a.receipt_token_hash = md5(coalesce(p_receipt_token, ''))
    and a.receipt_expires_at > now()
  limit 1
$$;

revoke all on function public.get_selection_application_receipt(text) from public;
grant execute on function public.get_selection_application_receipt(text) to anon, authenticated;

notify pgrst, 'reload schema';
