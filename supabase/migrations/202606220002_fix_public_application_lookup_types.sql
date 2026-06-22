create or replace function public.get_selection_application_receipt(p_receipt_token text)
returns table(tracking_code text,applicant_name text,submitted_at timestamptz,application_status text,process_title text,position_title text,dependency_name text,institution_name text)
language sql stable security definer set search_path=public as $$
  select a.tracking_code::text,a.applicant_name::text,a.created_at,a.status::text,p.title::text,p.position_title::text,d.name::text,i.name::text
  from public.selection_applications a join public.selection_processes p on p.id=a.process_id
  join public.dependencies d on d.id=p.dependency_id join public.dependencies i on i.id=p.institution_id
  where a.receipt_token_hash=md5(coalesce(p_receipt_token,'')) and a.receipt_expires_at>now()
  limit 1
$$;

create or replace function public.lookup_selection_application_status(p_tracking_code text,p_email text)
returns table(process_title text,position_title text,institution_name text,dependency_name text,applicant_name text,submitted_at timestamptz,public_status text,public_updated_at timestamptz,public_message text)
language plpgsql security definer set search_path=public as $$
begin
  perform pg_sleep(0.12);
  return query
  select p.title::text,p.position_title::text,i.name::text,d.name::text,a.applicant_name::text,a.created_at,
    (case when p.status='cancelado' then 'proceso_cancelado' when p.status in ('cerrado','finalizado','archivado') and a.status not in ('aceptada','rechazada','archivada') then 'proceso_cerrado' else a.status end)::text,
    greatest(coalesce(a.public_updated_at,a.created_at),case when p.status in ('cancelado','cerrado','finalizado','archivado') then p.updated_at else a.created_at end),a.public_message::text
  from public.selection_applications a join public.selection_processes p on p.id=a.process_id
  join public.dependencies d on d.id=p.dependency_id join public.dependencies i on i.id=p.institution_id
  where upper(a.tracking_code)=upper(trim(coalesce(p_tracking_code,''))) and lower(a.applicant_email)=lower(trim(coalesce(p_email,'')))
  limit 1;
end $$;
revoke all on function public.get_selection_application_receipt(text) from public;
revoke all on function public.lookup_selection_application_status(text,text) from public;
grant execute on function public.get_selection_application_receipt(text) to anon,authenticated;
grant execute on function public.lookup_selection_application_status(text,text) to anon,authenticated;
notify pgrst,'reload schema';
