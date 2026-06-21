create or replace function public.release_edit_lock(p_record_type text,p_record_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare v_owner uuid; v_forced boolean:=false;
begin
  select e.locked_by into v_owner from public.edit_locks e where e.record_type=p_record_type and e.record_id=p_record_id;
  if v_owner is null then return false; end if;
  v_forced:=v_owner is distinct from auth.uid();
  if v_forced and not public.has_effective_permission('edicion','take_control') then return false; end if;
  delete from public.edit_locks e where e.record_type=p_record_type and e.record_id=p_record_id;
  if found then perform public.log_security_event(case when v_forced then 'EDIT_LOCK_FORCE_RELEASED' else 'EDIT_LOCK_RELEASED' end,'edit_locks',p_record_id,case when v_forced then 'Bloqueo de edición liberado por usuario autorizado' else 'Bloqueo de edición liberado' end,jsonb_build_object('record_type',p_record_type,'previous_user_id',v_owner)); end if;
  return found;
end $$;
notify pgrst,'reload schema';
