-- Defensa en profundidad para los flujos introducidos en 008.
-- Evita que una llamada PostgREST directa omita confirmaciones o firmas.

drop policy if exists parties_write on public.case_parties;
drop policy if exists parties_insert on public.case_parties;
drop policy if exists parties_update on public.case_parties;
drop policy if exists parties_delete_owner on public.case_parties;

create policy parties_insert on public.case_parties for insert to authenticated
with check (
  public.can_access_case(case_id) and (
    public.is_owner() or public.current_role() in (
      'ADMIN_INSTITUCIONAL','RADICADOR','REPARTO','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR'
    )
  )
);
create policy parties_update on public.case_parties for update to authenticated
using (
  public.can_access_case(case_id) and (
    public.is_owner() or (
      archived_at is null and public.current_role() in (
        'ADMIN_INSTITUCIONAL','RADICADOR','REPARTO','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR'
      )
    )
  )
)
with check (
  public.can_access_case(case_id) and (
    public.is_owner() or public.current_role() in (
      'ADMIN_INSTITUCIONAL','RADICADOR','REPARTO','SECRETARIO_GENERAL','SECRETARIO_DESPACHO','OFICIAL_MAYOR'
    )
  )
);
create policy parties_delete_owner on public.case_parties for delete to authenticated
using (public.is_owner() and public.can_access_case(case_id));

drop trigger if exists protect_case_parties_hard_delete on public.case_parties;
create trigger protect_case_parties_hard_delete before delete on public.case_parties
for each row execute function public.block_non_owner_hard_delete();

create or replace function public.guard_case_security() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.confidentiality_level in ('Reservado','Confidencial') then
    new.public_visibility := false;
  end if;
  if tg_op = 'UPDATE' and old.archived_at is not null and not public.is_owner() then
    raise exception 'Archived cases are read-only';
  end if;
  if tg_op = 'UPDATE'
     and old.confidentiality_level in ('Reservado','Confidencial')
     and new.confidentiality_level = 'Público'
     and not public.is_owner()
     and coalesce(current_setting('sigj.declassification_confirmed', true), '') <> 'yes' then
    raise exception 'Use the confirmed secure case update flow to lower confidentiality';
  end if;
  return new;
end $$;

create or replace function public.update_case_secure(
  p_case_id uuid,
  p_payload jsonb,
  p_declassification_confirmation text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_old public.cases%rowtype; v_new_level text;
begin
  if auth.uid() is null or not public.can_access_case(p_case_id) then raise exception 'Acceso no autorizado'; end if;
  if not (public.is_owner() or public.current_role() in ('ADMIN_INSTITUCIONAL','RADICADOR','REPARTO','SECRETARIO_GENERAL','SECRETARIO_DESPACHO')) then
    raise exception 'No tiene permiso para editar el expediente';
  end if;
  select * into v_old from public.cases where id = p_case_id for update;
  if not found then raise exception 'Expediente no encontrado'; end if;
  if v_old.archived_at is not null and not public.is_owner() then raise exception 'Solo el propietario puede editar expedientes archivados'; end if;
  v_new_level := coalesce(p_payload->>'confidentiality_level',v_old.confidentiality_level);
  if v_old.confidentiality_level in ('Reservado','Confidencial') and v_new_level = 'Público' then
    if p_declassification_confirmation is distinct from 'CONFIRMAR PUBLICACIÓN' then
      raise exception 'Escriba CONFIRMAR PUBLICACIÓN para reducir el nivel de reserva';
    end if;
    perform set_config('sigj.declassification_confirmed', 'yes', true);
  end if;
  update public.cases set
    title=coalesce(nullif(p_payload->>'title',''),title), authority_type=coalesce(nullif(p_payload->>'authority_type',''),authority_type),
    chamber=coalesce(nullif(p_payload->>'chamber',''),chamber), process_type=coalesce(nullif(p_payload->>'process_type',''),process_type),
    process_subtype=coalesce(nullif(p_payload->>'process_subtype',''),process_subtype), claimant_name=coalesce(nullif(p_payload->>'claimant_name',''),claimant_name),
    defendant_name=coalesce(nullif(p_payload->>'defendant_name',''),defendant_name), summary=coalesce(nullif(p_payload->>'summary',''),summary),
    claims=coalesce(nullif(p_payload->>'claims',''),claims), department=coalesce(nullif(p_payload->>'department',''),department),
    municipality=coalesce(nullif(p_payload->>'municipality',''),municipality), reception_method=coalesce(nullif(p_payload->>'reception_method',''),reception_method),
    confidentiality_level=v_new_level, public_visibility=coalesce((p_payload->>'public_visibility')::boolean,public_visibility),
    assigned_judge_id=case when p_payload ? 'assigned_judge_id' then nullif(p_payload->>'assigned_judge_id','')::uuid else assigned_judge_id end,
    dependency_id=coalesce(nullif(p_payload->>'dependency_id','')::uuid,dependency_id), status=coalesce(nullif(p_payload->>'status',''),status),
    observations=case when p_payload ? 'observations' then nullif(p_payload->>'observations','') else observations end
  where id=p_case_id;
  perform public.log_security_event('CASE_FULL_UPDATE','cases',p_case_id,'Expediente actualizado desde el flujo seguro',
    jsonb_build_object('old_confidentiality',v_old.confidentiality_level,'new_confidentiality',v_new_level,'old_judge',v_old.assigned_judge_id,'new_judge',p_payload->>'assigned_judge_id','old_status',v_old.status,'new_status',p_payload->>'status'));
end $$;
revoke all on function public.update_case_secure(uuid,jsonb,text) from public,anon;
grant execute on function public.update_case_secure(uuid,jsonb,text) to authenticated;

create or replace function public.guard_proceeding_publication() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_signature_required boolean; v_case public.cases%rowtype;
begin
  if new.status <> 'Publicado' then return new; end if;
  if length(trim(new.title)) < 3 or length(trim(new.chamber)) < 2 or new.providence_date is null then
    raise exception 'Providence metadata is incomplete';
  end if;
  if new.creation_mode = 'editor' and length(trim(new.content_markdown)) < 20 then
    raise exception 'Providence content is incomplete';
  end if;
  if new.creation_mode in ('pdf','mixed') and new.pdf_path is null then
    raise exception 'Providence PDF is required';
  end if;
  v_signature_required := new.requires_signature
    or lower(new.type) like '%sentencia%'
    or lower(new.type) like '%avocamiento%'
    or lower(new.type) like '%decreto de pruebas%';
  if v_signature_required and not exists (
    select 1 from public.signatures s
    where s.target_type='proceeding' and s.target_id=new.id and s.status='signed'
  ) then raise exception 'A valid captured signature is required before publication'; end if;
  if new.visibility = 'public' then
    select * into v_case from public.cases where id=new.case_id;
    if not found or v_case.archived_at is not null or not v_case.public_visibility or v_case.confidentiality_level <> 'Público' then
      raise exception 'Reserved or unavailable cases cannot publish public providences';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists proceedings_publication_guard on public.proceedings;
create trigger proceedings_publication_guard before insert or update on public.proceedings
for each row execute function public.guard_proceeding_publication();

create or replace function public.guard_hearing_minute_finalization() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'Finalizada' then return new; end if;
  if tg_op='UPDATE' and old.status='Finalizada' then return new; end if;
  if public.is_owner() then return new; end if;
  if length(trim(new.development_markdown)) < 20 then raise exception 'Hearing minute development is incomplete'; end if;
  if new.secretary_signature_required and not exists (
    select 1 from public.signatures s where s.target_type='hearing_minute' and s.target_id=new.id
      and s.status='signed' and lower(s.signer_title) like '%secretar%'
  ) then raise exception 'Secretary signature is required before finalization'; end if;
  if new.judge_signature_required and not exists (
    select 1 from public.signatures s where s.target_type='hearing_minute' and s.target_id=new.id
      and s.status='signed' and lower(s.signer_title) ~ '(juez|jueza|magistrad)'
  ) then raise exception 'Judge signature is required before finalization'; end if;
  return new;
end $$;
drop trigger if exists hearing_minutes_finalization_guard on public.hearing_minutes;
create trigger hearing_minutes_finalization_guard before insert or update on public.hearing_minutes
for each row execute function public.guard_hearing_minute_finalization();
