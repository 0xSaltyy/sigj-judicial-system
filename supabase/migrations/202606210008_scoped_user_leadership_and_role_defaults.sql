alter table public.profiles add column if not exists is_dependency_leader boolean not null default false;
create index if not exists profiles_dependency_leaders_idx on public.profiles(dependency_id) where is_dependency_leader and is_active;

alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','export'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','export'
));

insert into public.role_permission_rules(role,resource,action,allowed)
select r,'dependencias','assign_leader',(r='SUPER_ADMIN'::public.app_role)
from unnest(enum_range(null::public.app_role)) r
on conflict(role,resource,action) do update set allowed=excluded.allowed;
update public.role_permission_rules set allowed=true where role='ADMIN_INSTITUCIONAL' and resource='usuarios' and action in ('view','create','edit','deactivate','reactivate','assign_role','create_in_institution','create_in_dependency','assign_dependency','view_dependency');
update public.role_permission_rules set allowed=false where role not in ('SUPER_ADMIN','ADMIN_INSTITUCIONAL') and resource='usuarios' and action in ('view_all','create_in_institution','assign_role');
update public.role_permission_rules set allowed=false where role<>'SUPER_ADMIN' and action='hard_delete';

create or replace function public.profile_can_lead_dependency(p_profile_id uuid,p_dependency_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=p_profile_id and p.is_active and p.is_dependency_leader and p.dependency_id=p_dependency_id);
$$;
revoke all on function public.profile_can_lead_dependency(uuid,uuid) from public,anon;
grant execute on function public.profile_can_lead_dependency(uuid,uuid) to authenticated,service_role;

create or replace view public.public_institution_members with (security_barrier=true) as
select p.id,p.full_name,p.position_title,p.institution_id,p.dependency_id,p.avatar_path,p.is_dependency_leader
from public.profiles p join public.dependencies d on d.id=coalesce(p.dependency_id,p.institution_id)
where p.is_active and p.public_profile and not p.is_owner and d.is_active and d.archived_at is null and d.public_visible;
grant select on public.public_institution_members to anon,authenticated;
notify pgrst,'reload schema';
