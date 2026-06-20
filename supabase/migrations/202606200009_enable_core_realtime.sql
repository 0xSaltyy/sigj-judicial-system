-- Realtime is notification-only in the web application: every event triggers an
-- authorized server refetch. Existing RLS policies remain the source of truth,
-- and confidential tables such as profiles and audit_logs are intentionally not
-- included in this publication.
do $$
declare
  v_table text;
  v_all_tables boolean;
  v_tables text[] := array[
    'cases',
    'radications',
    'case_parties',
    'case_actions',
    'documents',
    'proceedings',
    'hearings',
    'hearing_minutes',
    'signature_requests',
    'signatures',
    'record_shares',
    'share_links',
    'notifications',
    'certificates',
    'public_notices',
    'judicial_states',
    'judicial_state_items'
  ];
begin
  select puballtables
    into v_all_tables
    from pg_publication
   where pubname = 'supabase_realtime';

  if not found then
    raise notice 'Publication supabase_realtime does not exist; skipping table registration.';
    return;
  end if;

  if v_all_tables then
    raise notice 'Publication supabase_realtime already covers all tables.';
    return;
  end if;

  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is not null
       and not exists (
         select 1
           from pg_publication_tables
          where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = v_table
       ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end
$$;
