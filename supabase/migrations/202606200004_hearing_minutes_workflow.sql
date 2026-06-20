-- Corrige el ciclo de vida del acta: redactar -> finalizar -> firmar -> imprimir.
-- Las firmas sólo pueden incorporarse después de finalizar el texto.

alter table public.hearing_minutes
  add column if not exists location_details text,
  add column if not exists requests_markdown text not null default '',
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references auth.users(id) on delete set null,
  add column if not exists reopen_reason text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.hearing_minutes
  drop constraint if exists hearing_minutes_status_check;
alter table public.hearing_minutes
  add constraint hearing_minutes_status_check
  check (status in ('Borrador', 'Finalizada', 'Firmada', 'Archivada'));

create or replace function public.hearing_minute_signatures_complete(p_minute_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.signatures signature
      where signature.target_type = 'hearing_minute'
        and signature.target_id = minute.id
        and signature.status = 'signed'
    )
    and (
      not minute.secretary_signature_required
      or exists (
        select 1
        from public.signatures signature
        where signature.target_type = 'hearing_minute'
          and signature.target_id = minute.id
          and signature.status = 'signed'
          and lower(signature.signer_title) like '%secretar%'
      )
    )
    and (
      not minute.judge_signature_required
      or exists (
        select 1
        from public.signatures signature
        where signature.target_type = 'hearing_minute'
          and signature.target_id = minute.id
          and signature.status = 'signed'
          and lower(signature.signer_title) ~ '(juez|jueza|magistrad)'
      )
    ),
    false
  )
  from public.hearing_minutes minute
  where minute.id = p_minute_id;
$$;

revoke all on function public.hearing_minute_signatures_complete(uuid) from public, anon, authenticated;
grant execute on function public.hearing_minute_signatures_complete(uuid) to service_role;

create or replace function public.guard_hearing_minute_finalization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'Borrador' then
      raise exception 'A hearing minute must begin as a draft';
    end if;
    return new;
  end if;

  v_document_changed :=
    (to_jsonb(new) - array[
      'status', 'finalized_at', 'finalized_by', 'reopened_at', 'reopened_by',
      'reopen_reason', 'archived_at', 'archived_by', 'updated_at'
    ]) is distinct from
    (to_jsonb(old) - array[
      'status', 'finalized_at', 'finalized_by', 'reopened_at', 'reopened_by',
      'reopen_reason', 'archived_at', 'archived_by', 'updated_at'
    ]);

  if old.status in ('Finalizada', 'Firmada', 'Archivada') and v_document_changed then
    raise exception 'Finalized or signed hearing minutes are immutable until explicitly reopened';
  end if;

  if old.status = 'Borrador' and new.status = 'Borrador' then
    return new;
  end if;

  if old.status = 'Borrador' and new.status = 'Finalizada' then
    if length(trim(new.development_markdown)) < 20 then
      raise exception 'Hearing minute development is incomplete';
    end if;
    if new.started_at is null or new.ended_at is null or new.ended_at < new.started_at then
      raise exception 'Actual hearing start and end times are required';
    end if;
    return new;
  end if;

  if old.status = 'Finalizada' and new.status = 'Firmada' then
    if not public.hearing_minute_signatures_complete(new.id) then
      raise exception 'Required hearing minute signatures are incomplete';
    end if;
    return new;
  end if;

  if old.status = 'Firmada' and new.status = 'Finalizada' then
    if public.hearing_minute_signatures_complete(new.id) then
      raise exception 'A fully signed hearing minute cannot be marked as unsigned';
    end if;
    return new;
  end if;

  if old.status in ('Finalizada', 'Firmada') and new.status = 'Borrador' then
    if not public.has_effective_permission('actas', 'publish') then
      raise exception 'Permission to finalize hearing minutes is required to reopen them';
    end if;
    if exists (
      select 1 from public.signatures signature
      where signature.target_type = 'hearing_minute'
        and signature.target_id = new.id
        and signature.status = 'signed'
    ) then
      raise exception 'Revoke active signatures before reopening the hearing minute';
    end if;
    return new;
  end if;

  if old.status in ('Finalizada', 'Firmada') and new.status = 'Archivada' and public.is_owner() then
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  raise exception 'Invalid hearing minute status transition: % -> %', old.status, new.status;
end;
$$;

drop trigger if exists hearing_minutes_finalization_guard on public.hearing_minutes;
create trigger hearing_minutes_finalization_guard
before insert or update on public.hearing_minutes
for each row execute function public.guard_hearing_minute_finalization();

create or replace function public.guard_hearing_minute_signature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_type = 'hearing_minute' and new.status = 'signed' and not exists (
    select 1
    from public.hearing_minutes minute
    where minute.id = new.target_id
      and minute.case_id = new.case_id
      and minute.status in ('Finalizada', 'Firmada')
  ) then
    raise exception 'The hearing minute must be finalized before it can be signed';
  end if;
  return new;
end;
$$;

drop trigger if exists signatures_hearing_minute_guard on public.signatures;
create trigger signatures_hearing_minute_guard
before insert or update of status, target_id, target_type on public.signatures
for each row execute function public.guard_hearing_minute_signature();

create or replace function public.sync_hearing_minute_signature_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_id uuid;
begin
  if tg_op = 'DELETE' then
    v_target_id := old.target_id;
    if old.target_type <> 'hearing_minute' then return old; end if;
  else
    v_target_id := new.target_id;
    if new.target_type <> 'hearing_minute' then return new; end if;
  end if;

  update public.hearing_minutes minute
  set status = case
    when public.hearing_minute_signatures_complete(v_target_id) then 'Firmada'
    else 'Finalizada'
  end
  where minute.id = v_target_id
    and minute.status in ('Finalizada', 'Firmada');

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists signatures_sync_hearing_minute_status on public.signatures;
create trigger signatures_sync_hearing_minute_status
after insert or update of status or delete on public.signatures
for each row execute function public.sync_hearing_minute_signature_status();

update public.hearing_minutes minute
set status = 'Firmada'
where minute.status = 'Finalizada'
  and public.hearing_minute_signatures_complete(minute.id);

notify pgrst, 'reload schema';
