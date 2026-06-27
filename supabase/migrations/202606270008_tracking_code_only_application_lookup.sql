create or replace function public.lookup_selection_application_status(p_tracking_code text)
returns table(
  process_title text,
  position_title text,
  institution_name text,
  dependency_name text,
  applicant_name text,
  submitted_at timestamptz,
  public_status text,
  public_updated_at timestamptz,
  public_message text
)
language plpgsql security definer set search_path=public as $$
begin
  perform pg_sleep(0.18);

  return query
  select
    p.title::text,
    p.position_title::text,
    i.name::text,
    d.name::text,
    a.applicant_name::text,
    a.created_at,
    (
      case
        when p.status = 'cancelado' then 'proceso_cancelado'
        when p.status in ('cerrado', 'finalizado', 'archivado')
          and a.status not in ('aceptada', 'rechazada', 'archivada')
          then 'proceso_cerrado'
        else a.status
      end
    )::text,
    greatest(
      coalesce(a.public_updated_at, a.created_at),
      case
        when p.status in ('cancelado', 'cerrado', 'finalizado', 'archivado')
          then p.updated_at
        else a.created_at
      end
    ),
    a.public_message::text
  from public.selection_applications a
  join public.selection_processes p on p.id = a.process_id
  join public.dependencies d on d.id = p.dependency_id
  join public.dependencies i on i.id = p.institution_id
  where upper(a.tracking_code) = upper(trim(coalesce(p_tracking_code, '')))
  limit 1;
end $$;

revoke all on function public.lookup_selection_application_status(text) from public;
grant execute on function public.lookup_selection_application_status(text) to anon, authenticated;

notify pgrst, 'reload schema';
