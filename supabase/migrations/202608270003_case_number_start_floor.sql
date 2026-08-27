-- DOJ Roleplay · Realistic case numbering floor.
-- Existing case identifiers are preserved. New counters continue sequentially
-- but no longer begin at 000001 / 00001 for empty scopes.

create or replace function public.generate_internal_case_number_for_date(
  institution_code text,
  p_filed_at timestamptz default now()
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(regexp_replace(coalesce(institution_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_year text := to_char(coalesce(p_filed_at, now()), 'YYYY');
  v_scope text;
  v_initial bigint;
  v_next bigint;
  v_start_floor constant bigint := 100000;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Autenticación institucional requerida';
  end if;
  if nullif(v_code, '') is null then
    raise exception 'Código institucional no válido';
  end if;

  v_scope := 'internal-case:' || v_code || ':' || v_year;

  select greatest(
      coalesce(max(substring(c.internal_number from '([0-9]{6})$')::bigint), 0),
      v_start_floor
    )
    into v_initial
    from public.cases c
   where c.internal_number like v_code || '-' || v_year || '-%';

  v_next := public.next_case_number_counter(v_scope, v_initial);
  return format('%s-%s-%s', v_code, v_year, lpad(v_next::text, 6, '0'));
end;
$$;

create or replace function public.generate_judicial_case_number_for_date(
  dependency_code text,
  p_filed_at timestamptz default now()
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := lpad(nullif(regexp_replace(coalesce(dependency_code, ''), '\D', '', 'g'), ''), 3, '0');
  v_year text := to_char(coalesce(p_filed_at, now()), 'YYYY');
  v_prefix text;
  v_scope text;
  v_initial bigint;
  v_next bigint;
  v_start_floor constant bigint := 10000;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Autenticación institucional requerida';
  end if;
  if v_digits is null then
    raise exception 'Código de dependencia no válido';
  end if;

  v_prefix := format('11001-31-03-%s-%s-', v_digits, v_year);
  v_scope := 'judicial-case:' || v_digits || ':' || v_year;

  select greatest(
      coalesce(max(substring(c.judicial_number from '-([0-9]{5})-00$')::bigint), 0),
      v_start_floor
    )
    into v_initial
    from public.cases c
   where c.judicial_number like v_prefix || '%-00';

  v_next := public.next_case_number_counter(v_scope, v_initial);
  return format('%s%s-00', v_prefix, lpad(v_next::text, 5, '0'));
end;
$$;

-- Lift existing empty/low counter scopes without modifying any case rows.
update public.case_number_counters
   set last_value = greatest(last_value, 100000),
       updated_at = now()
 where scope like 'internal-case:%'
   and last_value < 100000;

update public.case_number_counters
   set last_value = greatest(last_value, 10000),
       updated_at = now()
 where scope like 'judicial-case:%'
   and last_value < 10000;

revoke all on function public.generate_internal_case_number_for_date(text, timestamptz) from public, anon;
revoke all on function public.generate_judicial_case_number_for_date(text, timestamptz) from public, anon;
grant execute on function public.generate_internal_case_number_for_date(text, timestamptz) to authenticated, service_role;
grant execute on function public.generate_judicial_case_number_for_date(text, timestamptz) to authenticated, service_role;

notify pgrst, 'reload schema';
