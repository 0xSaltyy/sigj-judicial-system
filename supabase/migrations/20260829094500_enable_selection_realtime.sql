-- Ensure applicant selection workflow changes also publish realtime updates.
-- Additive only; does not modify data.

do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'selection_applications')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'selection_applications') then
    alter publication supabase_realtime add table public.selection_applications;
  end if;

  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'selection_application_letters')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'selection_application_letters') then
    alter publication supabase_realtime add table public.selection_application_letters;
  end if;
end $$;

