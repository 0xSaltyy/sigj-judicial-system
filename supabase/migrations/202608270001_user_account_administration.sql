-- Owner-only user account administration helpers.
-- Does not store passwords. Password updates happen through Supabase Auth Admin.

alter table public.profiles add column if not exists institutional_email text;
alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspended_by uuid references auth.users(id) on delete set null;
alter table public.profiles add column if not exists password_reset_required_at timestamptz;
alter table public.profiles add column if not exists last_admin_action_at timestamptz;

create table if not exists public.user_admin_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('suspend','reactivate','password_reset','session_revoked')),
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.user_admin_events enable row level security;

drop policy if exists user_admin_events_owner_read on public.user_admin_events;
create policy user_admin_events_owner_read on public.user_admin_events
for select to authenticated
using (public.is_owner() or public.is_super_admin());

drop policy if exists user_admin_events_owner_insert on public.user_admin_events;
create policy user_admin_events_owner_insert on public.user_admin_events
for insert to authenticated
with check (public.is_owner() or public.is_super_admin());

create or replace function public.ensure_owner_account_action_allowed(p_target uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_owner_count integer;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if not found or not v_actor.is_active or not (v_actor.is_owner or v_actor.role in ('SUPER_ADMIN','OWNER','ATTORNEY_GENERAL')) then
    raise exception 'Solo OWNER puede administrar cuentas';
  end if;

  select * into v_target from public.profiles where id = p_target;
  if not found then raise exception 'Usuario no encontrado'; end if;

  if p_target = auth.uid() and p_action in ('suspend','password_reset') then
    raise exception 'No puede bloquear su propia cuenta';
  end if;

  if v_target.is_owner and p_action = 'suspend' then
    select count(*) into v_owner_count from public.profiles where is_owner and is_active and id <> p_target;
    if v_owner_count < 1 then
      raise exception 'No se puede suspender al último OWNER activo';
    end if;
  end if;
end $$;

create or replace function public.set_profile_account_state(
  p_target uuid,
  p_action text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_owner_account_action_allowed(p_target, p_action);

  if p_action = 'suspend' then
    update public.profiles
      set is_active=false, suspended_at=now(), suspended_by=auth.uid(), last_admin_action_at=now(), updated_at=now()
      where id=p_target;
  elsif p_action = 'reactivate' then
    update public.profiles
      set is_active=true, suspended_at=null, suspended_by=null, last_admin_action_at=now(), updated_at=now()
      where id=p_target;
  elsif p_action = 'password_reset' then
    update public.profiles
      set must_change_password=true, password_reset_required_at=now(), last_admin_action_at=now(), updated_at=now()
      where id=p_target;
  else
    raise exception 'Acción no soportada';
  end if;

  insert into public.user_admin_events(target_user_id, actor_user_id, action, reason)
  values (p_target, auth.uid(), p_action, nullif(trim(coalesce(p_reason,'')), ''));

  insert into public.audit_logs(user_id, action, table_name, record_id, description, metadata)
  values (auth.uid(), upper(p_action), 'profiles', p_target, 'Administración de cuenta interna', jsonb_build_object('reason', p_reason));

  return jsonb_build_object('ok', true, 'action', p_action);
end $$;

revoke all on function public.set_profile_account_state(uuid,text,text) from public, anon;
grant execute on function public.set_profile_account_state(uuid,text,text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.user_admin_events;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
