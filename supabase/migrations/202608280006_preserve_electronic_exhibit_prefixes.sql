set check_function_bodies = off;

create or replace function public.next_electronic_trial_exhibit_id(p_prefix text default 'ETE')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := upper(regexp_replace(coalesce(nullif(trim(p_prefix), ''), 'ETE'), '[^A-Z0-9-]', '', 'g'));
  v_value integer;
begin
  v_prefix := regexp_replace(v_prefix, '-{2,}', '-', 'g');
  v_prefix := trim(both '-' from v_prefix);

  if v_prefix = '' then
    v_prefix := 'ETE';
  end if;

  insert into public.electronic_exhibit_counters(prefix, last_value, updated_at)
  values (v_prefix, 1, now())
  on conflict (prefix)
  do update set last_value = public.electronic_exhibit_counters.last_value + 1, updated_at = now()
  returning last_value into v_value;

  return jsonb_build_object(
    'prefix', v_prefix,
    'sequence', v_value,
    'ete_id', v_prefix || '-' || lpad(v_value::text, 3, '0'),
    'formal_title', 'Electronic Trial Exhibit ' || lpad(v_value::text, 3, '0')
  );
end;
$$;

grant execute on function public.next_electronic_trial_exhibit_id(text) to authenticated, service_role;
