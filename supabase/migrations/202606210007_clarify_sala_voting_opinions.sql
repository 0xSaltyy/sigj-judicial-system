-- Separa la votación nominal de Sala de los documentos de voto particular.

insert into public.role_permission_rules(role,resource,action,allowed)
select role,'votos','archive',role='SUPER_ADMIN'
from unnest(enum_range(null::public.app_role)) role
on conflict(role,resource,action) do nothing;

update public.role_permission_rules set allowed=true
where resource='votos' and action='archive'
  and role in ('MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL');

alter table public.vote_documents
  add column if not exists author_display_name text,
  add column if not exists author_cargo text,
  add column if not exists signature_id uuid references public.signatures(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

update public.vote_documents v set
  author_display_name=coalesce(v.author_display_name,p.full_name),
  author_cargo=coalesce(v.author_cargo,p.position_title,'Magistrado/a')
from public.profiles p where p.id=v.author_id;

alter table public.vote_documents drop constraint if exists vote_documents_status_check;
alter table public.vote_documents add constraint vote_documents_status_check
  check(status in ('Borrador','Presentado','Firmado','Publicado','Archivado'));

create table public.sala_votes (
  id uuid primary key default gen_random_uuid(),
  providencia_id uuid not null references public.proceedings(id) on delete cascade,
  sala_session_id uuid not null references public.sala_sessions(id) on delete cascade,
  voter_user_id uuid references public.profiles(id) on delete restrict,
  external_voter_name text,
  voter_display_name text not null,
  voter_cargo text,
  vote_value text not null check(vote_value in ('aprueba','no_aprueba','abstencion','ausente','impedido')),
  notes text check(notes is null or char_length(notes)<=1000),
  announced_opinion_type text check(announced_opinion_type is null or announced_opinion_type in ('salvamento','aclaracion','salvamento_parcial','aclaracion_parcial','concurrente')),
  vote_document_id uuid references public.vote_documents(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sala_vote_identity check(voter_user_id is not null or nullif(trim(external_voter_name),'') is not null)
);
create unique index sala_votes_internal_unique on public.sala_votes(sala_session_id,voter_user_id) where voter_user_id is not null;
create index sala_votes_providence_idx on public.sala_votes(providencia_id,sala_session_id);
create trigger sala_votes_updated before update on public.sala_votes for each row execute function public.set_updated_at();

alter table public.sala_votes enable row level security;
create policy sala_votes_read on public.sala_votes for select to authenticated using(
  exists(select 1 from public.sala_sessions s where s.id=sala_session_id and public.can_access_case(s.case_id) and public.has_effective_permission('sala','view'))
);
revoke all on public.sala_votes from anon,authenticated;
grant select on public.sala_votes to authenticated;

drop policy if exists votes_write on public.vote_documents;
create policy votes_insert on public.vote_documents for insert to authenticated with check(
  public.can_access_case(vote_documents.case_id)
  and public.has_effective_permission('votos','create')
  and vote_documents.created_by=auth.uid()
  and (vote_documents.author_id=auth.uid() or public.is_owner())
  and exists(
    select 1 from public.proceedings pr
    left join public.sala_sessions ss on ss.proceeding_id=pr.id
    left join public.sala_participants sp on sp.sala_session_id=ss.id and sp.profile_id=vote_documents.author_id
    join public.cases c on c.id=pr.case_id
    where pr.id=vote_documents.proceeding_id and pr.case_id=vote_documents.case_id
      and (sp.profile_id is not null or c.assigned_judge_id=vote_documents.author_id or public.is_owner())
  )
);
create policy votes_update on public.vote_documents for update to authenticated using(
  public.can_access_case(vote_documents.case_id) and (vote_documents.author_id=auth.uid() or public.is_owner())
  and (public.has_effective_permission('votos','edit') or public.has_effective_permission('votos','publish') or public.has_effective_permission('votos','archive'))
) with check(
  public.can_access_case(vote_documents.case_id) and (vote_documents.author_id=auth.uid() or public.is_owner())
);

create or replace function public.guard_vote_document_lifecycle()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or coalesce(auth.role(),'')='service_role' then return new; end if;
  if old.status in ('Firmado','Publicado') and current_setting('sigj.vote_reopen',true) is distinct from 'yes'
     and (new.title is distinct from old.title or new.content_markdown is distinct from old.content_markdown
       or new.vote_type is distinct from old.vote_type or new.author_id is distinct from old.author_id) then
    perform public.log_security_event('VOTE_DOCUMENT_EDIT_DENIED','vote_documents',old.id,'Intento de editar un voto particular firmado o publicado','{}'::jsonb);
    raise exception 'El voto particular firmado o publicado debe reabrirse mediante el flujo auditado';
  end if;
  if new.status='Publicado' and not public.has_effective_permission('votos','publish') then raise exception 'No tiene permiso para publicar votos particulares'; end if;
  if new.status='Archivado' and not public.has_effective_permission('votos','archive') then raise exception 'No tiene permiso para archivar votos particulares'; end if;
  return new;
end $$;
drop trigger if exists guard_vote_document_lifecycle_trigger on public.vote_documents;
create trigger guard_vote_document_lifecycle_trigger before update on public.vote_documents for each row execute function public.guard_vote_document_lifecycle();

create or replace function public.replace_sala_votes(p_session_id uuid,p_entries jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_session public.sala_sessions%rowtype; v_entry jsonb; v_profile public.profiles%rowtype;
  v_vote_id uuid; v_opinion_label text; v_content text; v_count integer:=0;
  v_approve integer:=0; v_reject integer:=0; v_abstain integer:=0; v_absent integer:=0; v_impeded integer:=0;
begin
  select * into v_session from public.sala_sessions where id=p_session_id for update;
  if not found or not public.can_access_case(v_session.case_id) or not public.has_effective_permission('sala','register_vote') then
    perform public.log_security_event('SALA_VOTING_DENIED','sala_sessions',p_session_id,'Intento no autorizado de registrar votación','{}'::jsonb);
    raise exception 'No tiene permiso para registrar la votación de Sala';
  end if;
  if jsonb_typeof(coalesce(p_entries,'[]'::jsonb))<>'array' then raise exception 'Las entradas de votación no son válidas'; end if;
  delete from public.sala_votes where sala_session_id=p_session_id;
  for v_entry in select value from jsonb_array_elements(coalesce(p_entries,'[]'::jsonb)) loop
    if coalesce(v_entry->>'vote_value','') not in ('aprueba','no_aprueba','abstencion','ausente','impedido') then raise exception 'Valor de voto no válido'; end if;
    select * into v_profile from public.profiles where id=nullif(v_entry->>'voter_user_id','')::uuid and is_active;
    if not found or not exists(select 1 from public.sala_participants where sala_session_id=p_session_id and profile_id=v_profile.id) then
      raise exception 'El votante no pertenece a la sesión de Sala';
    end if;
    v_vote_id:=null;
    if nullif(v_entry->>'announced_opinion_type','') is not null then
      v_opinion_label:=case v_entry->>'announced_opinion_type'
        when 'salvamento' then 'Salvamento de voto' when 'aclaracion' then 'Aclaración de voto'
        when 'salvamento_parcial' then 'Salvamento parcial' when 'aclaracion_parcial' then 'Aclaración parcial'
        when 'concurrente' then 'Voto concurrente' else null end;
      if v_opinion_label is null then raise exception 'Tipo de voto particular anunciado no válido'; end if;
      select id into v_vote_id from public.vote_documents
       where proceeding_id=v_session.proceeding_id and author_id=v_profile.id and vote_type=v_opinion_label
         and status<>'Archivado' order by created_at desc limit 1;
      if v_vote_id is null then
        v_content:=case when v_entry->>'announced_opinion_type' in ('salvamento','salvamento_parcial') then
          '# SALVAMENTO DE VOTO\n\nCon el respeto acostumbrado por la decisión mayoritaria de la Sala, me permito salvar voto por las siguientes razones:\n\n## I. ANTECEDENTES\n\n## II. RAZONES DEL SALVAMENTO\n\n## III. CONCLUSIÓN\n\nFirma'
        else '# ACLARACIÓN DE VOTO\n\nAunque comparto la decisión adoptada por la Sala, estimo necesario aclarar mi voto en los siguientes términos:\n\n## I. PRECISIÓN INICIAL\n\n## II. RAZONES DE LA ACLARACIÓN\n\n## III. CONCLUSIÓN\n\nFirma' end;
        insert into public.vote_documents(case_id,proceeding_id,author_id,author_display_name,author_cargo,institution_style,vote_type,title,content_markdown,status,visibility,created_by)
        values(v_session.case_id,v_session.proceeding_id,v_profile.id,v_profile.full_name,coalesce(v_profile.position_title,'Magistrado/a'),v_session.institution_style,v_opinion_label,
          v_opinion_label||' de '||v_profile.full_name,v_content,'Borrador','internal',auth.uid()) returning id into v_vote_id;
        perform public.log_security_event('VOTE_OPINION_DRAFT_CREATED','vote_documents',v_vote_id,v_opinion_label||' creado desde la votación de Sala',jsonb_build_object('proceeding_id',v_session.proceeding_id,'author_id',v_profile.id));
        if v_profile.id<>auth.uid() then insert into public.internal_notifications(recipient_user_id,title,message,type,link_url,priority,related_record_type,related_record_id)
          values(v_profile.id,v_opinion_label||' pendiente de redacción','Se creó el borrador anunciado durante la votación de Sala.','voto_particular_borrador','/admin/providencias/'||v_session.proceeding_id||'/votos/'||v_vote_id,'high','vote_document',v_vote_id); end if;
      end if;
    end if;
    insert into public.sala_votes(providencia_id,sala_session_id,voter_user_id,voter_display_name,voter_cargo,vote_value,notes,announced_opinion_type,vote_document_id,created_by)
    values(v_session.proceeding_id,p_session_id,v_profile.id,v_profile.full_name,coalesce(v_profile.position_title,'Magistrado/a'),v_entry->>'vote_value',nullif(trim(v_entry->>'notes'),''),nullif(v_entry->>'announced_opinion_type',''),v_vote_id,auth.uid());
    v_count:=v_count+1;
    case v_entry->>'vote_value' when 'aprueba' then v_approve:=v_approve+1; when 'no_aprueba' then v_reject:=v_reject+1; when 'abstencion' then v_abstain:=v_abstain+1; when 'ausente' then v_absent:=v_absent+1; when 'impedido' then v_impeded:=v_impeded+1; end case;
  end loop;
  update public.sala_sessions set vote_result=format('Aprueba %s · No aprueba %s · Abstención %s · Ausente %s · Impedido %s',v_approve,v_reject,v_abstain,v_absent,v_impeded),
    status=case when exists(select 1 from public.sala_votes where sala_session_id=p_session_id and announced_opinion_type is not null) then 'Con salvamento/aclaración' else 'En sala' end
  where id=p_session_id;
  perform public.log_security_event('SALA_VOTING_COMPLETED','sala_votes',p_session_id,'Votación nominal de Sala registrada',jsonb_build_object('entries',v_count,'proceeding_id',v_session.proceeding_id));
  if v_session.rapporteur_id is not null and v_session.rapporteur_id<>auth.uid() then insert into public.internal_notifications(recipient_user_id,title,message,type,link_url,priority,related_record_type,related_record_id)
    values(v_session.rapporteur_id,'Votación de Sala registrada','La votación nominal de la providencia fue completada.','votacion_sala_completada','/admin/providencias/'||v_session.proceeding_id||'/sala','high','sala_session',p_session_id); end if;
  return v_count;
end $$;
revoke all on function public.replace_sala_votes(uuid,jsonb) from public,anon;
grant execute on function public.replace_sala_votes(uuid,jsonb) to authenticated;

create or replace function public.reopen_vote_document(p_vote_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_vote public.vote_documents%rowtype;
begin
  if not public.is_owner() then
    perform public.log_security_event('VOTE_REOPEN_DENIED','vote_documents',p_vote_id,'Intento no autorizado de reabrir voto particular','{}'::jsonb);
    raise exception 'Sólo el propietario puede reabrir un voto firmado o publicado';
  end if;
  select * into v_vote from public.vote_documents where id=p_vote_id for update;
  if not found or v_vote.status not in ('Firmado','Publicado') then raise exception 'El voto particular no admite reapertura'; end if;
  perform set_config('sigj.vote_reopen','yes',true);
  update public.signatures set status='revoked',revoked_at=now() where target_type='vote_document' and target_id=p_vote_id and status='signed';
  update public.signature_requests set status='revoked',revoked_at=now() where target_type='vote_document' and target_id=p_vote_id and status='signed';
  update public.vote_documents set status='Borrador',signature_id=null,signed_at=null,published_at=null where id=p_vote_id;
  perform public.log_security_event('VOTE_DOCUMENT_REOPENED','vote_documents',p_vote_id,'Voto particular reabierto con revocación de firma',jsonb_build_object('reason',left(coalesce(p_reason,''),500),'previous_status',v_vote.status));
  return true;
end $$;
revoke all on function public.reopen_vote_document(uuid,text) from public,anon;
grant execute on function public.reopen_vote_document(uuid,text) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables)
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='sala_votes') then
    alter publication supabase_realtime add table public.sala_votes;
  end if;
end $$;

notify pgrst,'reload schema';
