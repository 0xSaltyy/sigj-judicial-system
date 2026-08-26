create or replace function public.create_internal_notification(p_recipient uuid,p_title text,p_message text,p_type text,p_link_url text default null,p_priority text default 'normal',p_record_type text default null,p_record_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_allowed boolean;
begin
  if auth.uid() is null or not public.is_active_internal() then raise exception 'Sesión institucional requerida'; end if;
  v_allowed:=p_recipient=auth.uid() or public.is_owner()
    or public.has_effective_permission('notificaciones','manage')
    or public.has_effective_permission('sala','register_session')
    or public.has_effective_permission('sala','approve')
    or public.has_effective_permission('firmas','request')
    or public.has_effective_permission('actas','finalize');
  if not v_allowed then
    perform public.log_security_event('INTERNAL_NOTIFICATION_DENIED','internal_notifications',p_record_id,'Intento no autorizado de crear una notificación interna',jsonb_build_object('type',p_type));
    raise exception 'No tiene permiso para crear notificaciones internas';
  end if;
  if not exists(select 1 from public.profiles where id=p_recipient and is_active) then return null; end if;
  insert into public.internal_notifications(recipient_user_id,title,message,type,link_url,priority,related_record_type,related_record_id)
  values(p_recipient,left(p_title,180),left(p_message,500),left(p_type,80),case when p_link_url like '/admin/%' then p_link_url else null end,case when p_priority in ('low','normal','high','urgent') then p_priority else 'normal' end,p_record_type,p_record_id)
  returning id into v_id;
  return v_id;
end $$;
notify pgrst,'reload schema';
