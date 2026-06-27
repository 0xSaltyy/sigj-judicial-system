-- Producción: radicación collision-safe y agenda de audiencias robusta.
-- No edita migraciones aplicadas; reemplaza funciones/vistas con firmas estables.

create table if not exists public.case_number_counters (
  scope text primary key,
  last_value bigint not null check (last_value >= 0),
  updated_at timestamptz not null default now()
);

revoke all on public.case_number_counters from public, anon, authenticated;
grant select, insert, update on public.case_number_counters to service_role;

create or replace function public.next_case_number_counter(
  p_scope text,
  p_initial_value bigint default 0
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current bigint;
  v_next bigint;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Autenticación institucional requerida';
  end if;
  if nullif(trim(coalesce(p_scope, '')), '') is null then
    raise exception 'Ámbito de numeración no válido';
  end if;

  insert into public.case_number_counters(scope, last_value)
  values (p_scope, greatest(coalesce(p_initial_value, 0), 0))
  on conflict (scope) do nothing;

  select last_value into v_current
    from public.case_number_counters
   where scope = p_scope
   for update;

  v_next := greatest(coalesce(v_current, 0), coalesce(p_initial_value, 0), 0) + 1;

  update public.case_number_counters
     set last_value = v_next,
         updated_at = now()
   where scope = p_scope;

  return v_next;
end;
$$;

revoke all on function public.next_case_number_counter(text, bigint) from public, anon;
grant execute on function public.next_case_number_counter(text, bigint) to authenticated, service_role;

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
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Autenticación institucional requerida';
  end if;
  if nullif(v_code, '') is null then
    raise exception 'Código institucional no válido';
  end if;

  v_scope := 'internal-case:' || v_code || ':' || v_year;

  select coalesce(max(substring(c.internal_number from '([0-9]{6})$')::bigint), 0)
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
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Autenticación institucional requerida';
  end if;
  if v_digits is null then
    raise exception 'Código de dependencia no válido';
  end if;

  v_prefix := format('11001-31-03-%s-%s-', v_digits, v_year);
  v_scope := 'judicial-case:' || v_digits || ':' || v_year;

  select coalesce(max(substring(c.judicial_number from '-([0-9]{5})-00$')::bigint), 0)
    into v_initial
    from public.cases c
   where c.judicial_number like v_prefix || '%-00';

  v_next := public.next_case_number_counter(v_scope, v_initial);
  return format('%s%s-00', v_prefix, lpad(v_next::text, 5, '0'));
end;
$$;

create or replace function public.generate_internal_case_number(institution_code text) returns text
language sql
security definer
set search_path = public
as $$
  select public.generate_internal_case_number_for_date(institution_code, now())
$$;

create or replace function public.generate_judicial_case_number(dependency_code text) returns text
language sql
security definer
set search_path = public
as $$
  select public.generate_judicial_case_number_for_date(dependency_code, now())
$$;

revoke all on function public.generate_internal_case_number_for_date(text, timestamptz) from public, anon;
revoke all on function public.generate_judicial_case_number_for_date(text, timestamptz) from public, anon;
revoke all on function public.generate_internal_case_number(text) from public, anon;
revoke all on function public.generate_judicial_case_number(text) from public, anon;
grant execute on function public.generate_internal_case_number_for_date(text, timestamptz) to authenticated, service_role;
grant execute on function public.generate_judicial_case_number_for_date(text, timestamptz) to authenticated, service_role;
grant execute on function public.generate_internal_case_number(text) to authenticated;
grant execute on function public.generate_judicial_case_number(text) to authenticated;

create or replace function public.create_case_secure(
  p_case_id uuid,
  p_payload jsonb,
  p_parties jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_dependency public.dependencies%rowtype;
  v_confidentiality text := p_payload->>'confidentiality_level';
  v_reception_method text := nullif(trim(p_payload->>'reception_method'), '');
  v_filed_at timestamptz;
  v_internal_number text;
  v_judicial_number text;
  v_attempt integer := 0;
  v_constraint text;
begin
  if auth.uid() is null then
    raise exception 'Autenticación institucional requerida';
  end if;

  select * into v_profile
    from public.profiles
   where id = auth.uid() and is_active;
  if not found or not public.has_effective_permission('expedientes', 'create') then
    perform public.log_security_event(
      'CASE_CREATE_DENIED', 'cases', p_case_id,
      'Intento de radicación sin permiso efectivo', '{}'::jsonb
    );
    raise exception 'No tiene permiso para crear expedientes';
  end if;

  select * into v_dependency
    from public.dependencies
   where id = nullif(p_payload->>'dependency_id', '')::uuid
     and is_active
     and archived_at is null;
  if not found then
    raise exception 'La dependencia destino no está activa o no existe';
  end if;

  if v_profile.role not in ('SUPER_ADMIN', 'SECRETARIO_GENERAL', 'RADICADOR', 'REPARTO')
     and v_profile.dependency_id is distinct from v_dependency.id then
    perform public.log_security_event(
      'CASE_CREATE_SCOPE_DENIED', 'cases', p_case_id,
      'Intento de radicación fuera de la dependencia autorizada',
      jsonb_build_object('requested_dependency_id', v_dependency.id)
    );
    raise exception 'No tiene permiso para radicar en la dependencia seleccionada';
  end if;

  if v_confidentiality not in ('Público', 'Reservado', 'Confidencial') then
    raise exception 'Nivel de reserva no válido';
  end if;
  if v_reception_method is null then
    raise exception 'El medio de recepción es obligatorio';
  end if;
  if jsonb_typeof(coalesce(p_parties, '[]'::jsonb)) <> 'array' then
    raise exception 'Las partes del expediente no son válidas';
  end if;

  v_filed_at := coalesce(nullif(p_payload->>'filed_at', '')::timestamptz, now());

  loop
    v_attempt := v_attempt + 1;
    v_internal_number := public.generate_internal_case_number_for_date(v_dependency.code, v_filed_at);
    v_judicial_number := public.generate_judicial_case_number_for_date(v_dependency.code, v_filed_at);

    begin
      insert into public.cases (
        id, internal_number, judicial_number, title, authority_type, chamber,
        process_type, process_subtype, claimant_name, defendant_name, summary,
        claims, amount, department, municipality, reception_method,
        confidentiality_level, filed_at, observations, dependency_id, status,
        public_visibility, created_by
      ) values (
        p_case_id,
        v_internal_number,
        v_judicial_number,
        nullif(trim(p_payload->>'title'), ''),
        nullif(trim(p_payload->>'authority_type'), ''),
        nullif(trim(p_payload->>'chamber'), ''),
        nullif(trim(p_payload->>'process_type'), ''),
        nullif(trim(p_payload->>'process_subtype'), ''),
        nullif(trim(p_payload->>'claimant_name'), ''),
        coalesce(nullif(trim(p_payload->>'defendant_name'), ''), 'Por determinar'),
        nullif(trim(p_payload->>'summary'), ''),
        coalesce(nullif(trim(p_payload->>'claims'), ''), 'Sin pretensiones adicionales registradas.'),
        nullif(p_payload->>'amount', '')::numeric,
        nullif(trim(p_payload->>'department'), ''),
        nullif(trim(p_payload->>'municipality'), ''),
        v_reception_method,
        v_confidentiality,
        v_filed_at,
        nullif(trim(p_payload->>'observations'), ''),
        v_dependency.id,
        'Radicado',
        v_confidentiality = 'Público',
        auth.uid()
      );
      exit;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint in ('cases_internal_number_key', 'cases_judicial_number_key')
           and v_attempt < 6 then
          perform public.log_security_event(
            'CASE_NUMBER_COLLISION_RETRY', 'cases', p_case_id,
            'Colisión de numeración resuelta con reintento interno',
            jsonb_build_object(
              'attempt', v_attempt,
              'constraint', v_constraint,
              'dependency_id', v_dependency.id
            )
          );
        else
          perform public.log_security_event(
            'CASE_NUMBER_ASSIGNMENT_FAILED', 'cases', p_case_id,
            'No fue posible asignar un número de radicación único',
            jsonb_build_object(
              'attempts', v_attempt,
              'constraint', coalesce(v_constraint, 'unknown'),
              'dependency_id', v_dependency.id
            )
          );
          raise exception 'No fue posible asignar un número de radicación único. Intente nuevamente en unos segundos.';
        end if;
    end;
  end loop;

  insert into public.case_parties (
    case_id, name, party_type, document_number
  )
  select
    p_case_id,
    nullif(trim(party.name), ''),
    nullif(trim(party.party_type), ''),
    nullif(trim(party.document_number), '')
  from jsonb_to_recordset(coalesce(p_parties, '[]'::jsonb)) as party(
    name text,
    party_type text,
    document_number text
  )
  where nullif(trim(party.name), '') is not null
    and nullif(trim(party.party_type), '') is not null;

  insert into public.case_actions (
    case_id, action_type, title, description, visibility, created_by
  ) values (
    p_case_id,
    'Radicación',
    'Radicación del expediente',
    format('Expediente recibido y asignado inicialmente a %s.', v_dependency.name),
    case when v_confidentiality = 'Público' then 'public'::public.visibility_level
         else 'internal'::public.visibility_level end,
    auth.uid()
  );

  insert into public.radications (
    case_id, received_by, reception_method, validation_status,
    validated_at, destination_dependency_id
  ) values (
    p_case_id, auth.uid(), v_reception_method, 'Validado', now(), v_dependency.id
  );

  perform public.log_security_event(
    'CASE_CREATED', 'cases', p_case_id,
    'Expediente radicado mediante el flujo transaccional seguro',
    jsonb_build_object(
      'dependency_id', v_dependency.id,
      'confidentiality_level', v_confidentiality,
      'internal_number', v_internal_number,
      'judicial_number', v_judicial_number,
      'numbering_attempts', v_attempt
    )
  );

  return p_case_id;
end;
$$;

revoke all on function public.create_case_secure(uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.create_case_secure(uuid, jsonb, jsonb)
  to authenticated;

create or replace function public.can_access_hearing(p_hearing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
      from public.hearings h
      join public.cases c on c.id = h.case_id
      join public.profiles p on p.id = auth.uid() and p.is_active
     where h.id = p_hearing_id
       and public.has_effective_permission('audiencias','view',p.id)
       and (
         (p.is_owner and p.role = 'SUPER_ADMIN')
         or p.role = 'SUPER_ADMIN'
         or public.has_effective_permission('audiencias','view_all',p.id)
         or (
           public.has_effective_permission('audiencias','view_institution',p.id)
           and p.institution_id is not null
           and public.dependency_is_within(c.dependency_id,p.institution_id)
         )
         or (
           public.has_effective_permission('audiencias','view_dependency',p.id)
           and c.dependency_id = p.dependency_id
         )
         or c.assigned_judge_id = p.id
         or h.created_by = p.id
         or public.can_access_case(c.id)
       )
  )
$$;

revoke all on function public.can_access_hearing(uuid) from public, anon;
grant execute on function public.can_access_hearing(uuid) to authenticated, service_role;

drop view if exists public.hearing_agenda_secure;
create view public.hearing_agenda_secure with (security_barrier=true) as
select
  h.id,
  h.case_id,
  coalesce(nullif(h.title, ''), 'Audiencia sin título') as title,
  coalesce(nullif(h.hearing_type, ''), 'Audiencia') as hearing_type,
  h.scheduled_at,
  h.end_at,
  h.room,
  h.virtual_link,
  coalesce(nullif(h.status, ''), 'Programada') as status,
  h.is_public,
  coalesce(h.participants, '[]'::jsonb) as participants,
  h.notes,
  h.created_by,
  h.archived_at,
  c.internal_number,
  c.judicial_number,
  c.title as case_title,
  c.ticket_name,
  c.chamber,
  c.authority_type,
  c.dependency_id,
  c.assigned_judge_id,
  d.name as dependency_name,
  j.full_name as judge_name,
  coalesce(j.is_owner, false) as judge_is_owner,
  m.id as minute_id,
  m.status as minute_status
from public.hearings h
join public.cases c on c.id = h.case_id
left join public.dependencies d on d.id = c.dependency_id
left join public.profiles j on j.id = c.assigned_judge_id
left join lateral (
  select hm.id, hm.status
    from public.hearing_minutes hm
   where hm.hearing_id = h.id
   order by hm.created_at desc
   limit 1
) m on true
where public.can_access_hearing(h.id);

revoke all on public.hearing_agenda_secure from public, anon;
grant select on public.hearing_agenda_secure to authenticated;

insert into public.role_permission_rules(role, resource, action, allowed)
select role, resource, action, role = 'SUPER_ADMIN'::public.app_role
from (select unnest(enum_range(null::public.app_role)) as role) roles
cross join (values
  ('audiencias','view'),
  ('audiencias','view_all'),
  ('audiencias','view_institution'),
  ('audiencias','view_dependency')
) permissions(resource, action)
on conflict (role, resource, action) do update
set allowed = case
  when excluded.role = 'SUPER_ADMIN'::public.app_role then true
  else public.role_permission_rules.allowed
end;

notify pgrst, 'reload schema';
