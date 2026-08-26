-- La radicación debe ser atómica y depender del permiso efectivo de crear,
-- no de una combinación accidental de roles para sus registros hijos.
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
     and is_active;
  if not found then
    raise exception 'La dependencia destino no está activa o no existe';
  end if;

  -- Los roles de alcance local sólo pueden radicar en su propia dependencia.
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

  insert into public.cases (
    id, internal_number, judicial_number, title, authority_type, chamber,
    process_type, process_subtype, claimant_name, defendant_name, summary,
    claims, amount, department, municipality, reception_method,
    confidentiality_level, filed_at, observations, dependency_id, status,
    public_visibility, created_by
  ) values (
    p_case_id,
    nullif(trim(p_payload->>'internal_number'), ''),
    nullif(trim(p_payload->>'judicial_number'), ''),
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
    (p_payload->>'filed_at')::timestamptz,
    nullif(trim(p_payload->>'observations'), ''),
    v_dependency.id,
    'Radicado',
    v_confidentiality = 'Público',
    auth.uid()
  );

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
      'confidentiality_level', v_confidentiality
    )
  );

  return p_case_id;
exception
  when unique_violation then
    raise exception 'La numeración generada ya existe; intente radicar nuevamente';
end;
$$;

revoke all on function public.create_case_secure(uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.create_case_secure(uuid, jsonb, jsonb)
  to authenticated;

-- El creador con permiso de consulta conserva acceso inmediato a su radicación,
-- además de las reglas institucionales, de reparto y de asignación existentes.
create or replace function public.can_access_case(p_case_id uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_effective_permission('expedientes', 'view', auth.uid())
    and exists (
      select 1
        from public.cases c
        join public.profiles p on p.id = auth.uid() and p.is_active
       where c.id = p_case_id
         and (
           (p.is_owner and p.role = 'SUPER_ADMIN')
           or p.role in ('SUPER_ADMIN', 'SECRETARIO_GENERAL', 'RADICADOR', 'REPARTO', 'ARCHIVO')
           or (p.role = 'ADMIN_INSTITUCIONAL' and c.dependency_id = p.dependency_id)
           or (
             p.role in ('MAGISTRADO_CORTE_SUPREMA', 'MAGISTRADO_TRIBUNAL', 'JUEZ_CIRCUITO', 'JUEZ_MUNICIPAL')
             and c.assigned_judge_id = p.id
           )
           or (p.role in ('SECRETARIO_DESPACHO', 'OFICIAL_MAYOR') and c.dependency_id = p.dependency_id)
           or (
             c.created_by = p.id
             and public.has_effective_permission('expedientes', 'create', p.id)
           )
           or public.has_active_case_share(c.id)
         )
    );
$$;

revoke all on function public.can_access_case(uuid) from public;
grant execute on function public.can_access_case(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
