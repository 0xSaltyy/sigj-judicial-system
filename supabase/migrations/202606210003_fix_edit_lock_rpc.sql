create or replace function public.can_lock_record(p_record_type text,p_record_id uuid) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare v_case_id uuid;
begin
  if p_record_type='proceeding' then
    select case_id into v_case_id from public.proceedings where id=p_record_id and archived_at is null and status in ('Borrador','En revisión');
    return v_case_id is not null and public.can_access_case(v_case_id) and public.has_effective_permission('providencias','edit');
  elsif p_record_type='hearing_minute' then
    select case_id into v_case_id from public.hearings where id=p_record_id and archived_at is null;
    return v_case_id is not null and public.can_access_case(v_case_id) and (public.has_effective_permission('actas','create') or public.has_effective_permission('actas','edit'));
  elsif p_record_type='case' then
    select id into v_case_id from public.cases where id=p_record_id and archived_at is null;
    return v_case_id is not null and public.can_access_case(v_case_id) and public.has_effective_permission('expedientes','edit');
  elsif p_record_type='case_action' then
    select case_id into v_case_id from public.case_actions where id=p_record_id and archived_at is null;
    return v_case_id is not null and public.can_access_case(v_case_id) and public.has_effective_permission('actuaciones','edit');
  elsif p_record_type='document' then
    select case_id into v_case_id from public.documents where id=p_record_id and archived_at is null and deleted_at is null;
    return v_case_id is not null and public.can_access_case(v_case_id) and public.has_effective_permission('documentos','upload');
  end if;
  return false;
end $$;

create or replace function public.acquire_edit_lock(p_record_type text,p_record_id uuid,p_force boolean default false)
returns table(acquired boolean,locked_by uuid,locked_by_name text,locked_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_lock public.edit_locks%rowtype; v_can_force boolean;
begin
  if not public.can_lock_record(p_record_type,p_record_id) then
    perform public.log_security_event('EDIT_LOCK_DENIED','edit_locks',p_record_id,'Intento de bloqueo sin acceso o permiso de edición',jsonb_build_object('record_type',p_record_type));
    raise exception 'No tiene permiso para editar este registro';
  end if;
  v_can_force:=public.has_effective_permission('edicion','take_control');
  delete from public.edit_locks e where e.expires_at<=now();
  select e.* into v_lock from public.edit_locks e where e.record_type=p_record_type and e.record_id=p_record_id for update;
  if found and v_lock.locked_by<>auth.uid() and not (p_force and v_can_force) then
    return query select false,v_lock.locked_by,p.full_name,v_lock.locked_at,v_lock.expires_at from public.profiles p where p.id=v_lock.locked_by;
    return;
  end if;
  if found and v_lock.locked_by<>auth.uid() and p_force then
    perform public.log_security_event('EDIT_LOCK_TAKEN_OVER','edit_locks',p_record_id,'Control de edición asumido por usuario autorizado',jsonb_build_object('record_type',p_record_type,'previous_user_id',v_lock.locked_by));
  end if;
  insert into public.edit_locks(record_type,record_id,locked_by,locked_at,last_seen_at,expires_at)
  values(p_record_type,p_record_id,auth.uid(),now(),now(),now()+interval '4 minutes')
  on conflict(record_type,record_id) do update set locked_by=auth.uid(),locked_at=case when edit_locks.locked_by=auth.uid() then edit_locks.locked_at else now() end,last_seen_at=now(),expires_at=now()+interval '4 minutes';
  perform public.log_security_event('EDIT_LOCK_ACQUIRED','edit_locks',p_record_id,'Bloqueo temporal de edición adquirido',jsonb_build_object('record_type',p_record_type));
  return query select true,e.locked_by,p.full_name,e.locked_at,e.expires_at from public.edit_locks e join public.profiles p on p.id=e.locked_by where e.record_type=p_record_type and e.record_id=p_record_id;
end $$;
notify pgrst,'reload schema';
