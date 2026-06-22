-- Notificaciones de audiencia con semántica correcta y sin datos reservados.
create or replace function public.notify_case_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_case public.cases%rowtype; v_recipient uuid; v_type text; v_title text; v_message text; v_link text; v_record uuid;
begin
  if tg_table_name='cases' then
    if tg_op='UPDATE' and new.assigned_judge_id is distinct from old.assigned_judge_id and new.assigned_judge_id is not null then
      v_recipient:=new.assigned_judge_id; v_type:='ponente_asignado'; v_title:='Nueva asignación como ponente'; v_message:='Se le asignó un expediente. Consulte el registro para conocer los detalles autorizados.'; v_link:='/admin/expedientes/'||new.id; v_record:=new.id;
    else return new; end if;
  elsif tg_table_name='documents' then
    select * into v_case from public.cases where id=new.case_id;
    v_recipient:=coalesce(v_case.assigned_judge_id,v_case.created_by); v_type:='documento_agregado'; v_title:='Documento agregado'; v_message:=case when new.visibility::text in ('reserved','internal') then 'Se agregó un documento reservado o interno a un expediente.' else 'Se agregó un documento a un expediente.' end; v_link:='/admin/expedientes/'||new.case_id; v_record:=new.id;
  elsif tg_table_name='proceedings' then
    if tg_op='UPDATE' and new.status='Publicado' and old.status is distinct from new.status then
      select * into v_case from public.cases where id=new.case_id; v_recipient:=coalesce(v_case.assigned_judge_id,new.created_by); v_type:='providencia_publicada'; v_title:='Providencia publicada'; v_message:='Una providencia del expediente fue publicada.'; v_link:='/admin/providencias/'||new.id; v_record:=new.id;
    else return new; end if;
  elsif tg_table_name='hearings' then
    select * into v_case from public.cases where id=new.case_id; v_recipient:=coalesce(v_case.assigned_judge_id,new.created_by); v_link:='/admin/audiencias/'||new.id; v_record:=new.id;
    if tg_op='INSERT' then v_type:='audiencia_programada';v_title:='Audiencia programada';v_message:='Se programó una audiencia dentro de su agenda autorizada.';
    elsif new.status='Cancelada' and old.status is distinct from new.status then v_type:='audiencia_cancelada';v_title:='Audiencia cancelada';v_message:='Una audiencia de su agenda fue cancelada. Consulte el registro para revisar el estado.';
    elsif new.status='Realizada' and old.status is distinct from new.status then v_type:='audiencia_realizada';v_title:='Audiencia realizada · acta pendiente';v_message:='La audiencia fue marcada como realizada y el flujo de acta está disponible.';
    elsif (new.scheduled_at,new.end_at) is distinct from (old.scheduled_at,old.end_at) then v_type:='audiencia_reprogramada';v_title:='Audiencia reprogramada';v_message:='Cambió la fecha u hora de una audiencia. Consulte la agenda actualizada.';
    else v_type:='audiencia_actualizada';v_title:='Audiencia actualizada';v_message:='Cambió el estado de una audiencia dentro de su alcance.'; end if;
  else return new; end if;
  if v_recipient is not null and v_recipient is distinct from auth.uid() then
    insert into public.internal_notifications(recipient_user_id,title,message,type,link_url,priority,related_record_type,related_record_id)
    values(v_recipient,v_title,v_message,v_type,v_link,case when v_type in ('audiencia_cancelada','audiencia_realizada') then 'high' else 'normal' end,tg_table_name,v_record);
  end if;
  return new;
end $$;

create or replace function public.notify_hearing_minute_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_hearing public.hearings%rowtype; v_case public.cases%rowtype; v_recipient uuid; v_title text; v_message text; v_type text;
begin
  select * into v_hearing from public.hearings where id=new.hearing_id;
  select * into v_case from public.cases where id=new.case_id;
  v_recipient:=coalesce(v_case.assigned_judge_id,v_hearing.created_by,new.created_by);
  if tg_op='INSERT' then v_type:='acta_creada';v_title:='Borrador de acta creado';v_message:='Se creó el borrador del acta de una audiencia dentro de su agenda.';
  elsif new.status is distinct from old.status and new.status in ('Finalizada','Firmada') then v_type:='acta_finalizada';v_title:=case when new.status='Firmada' then 'Acta firmada' else 'Acta finalizada' end;v_message:='El acta cambió de estado y está disponible en el flujo autorizado.';
  else return new; end if;
  if v_recipient is not null and v_recipient is distinct from auth.uid() then
    insert into public.internal_notifications(recipient_user_id,title,message,type,link_url,priority,related_record_type,related_record_id)
    values(v_recipient,v_title,v_message,v_type,'/admin/audiencias/'||new.hearing_id||'/acta','high','hearing_minute',new.id);
  end if;
  return new;
end $$;
drop trigger if exists notify_hearing_minute_activity on public.hearing_minutes;
create trigger notify_hearing_minute_activity after insert or update of status on public.hearing_minutes for each row execute function public.notify_hearing_minute_activity();
notify pgrst,'reload schema';
