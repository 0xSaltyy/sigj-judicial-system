alter table public.profiles
  add column if not exists public_display_name varchar(140),
  add column if not exists public_title varchar(160),
  add column if not exists public_bio varchar(1200),
  add column if not exists public_phone varchar(80),
  add column if not exists public_institution_id uuid references public.dependencies(id) on delete set null,
  add column if not exists public_dependency_id uuid references public.dependencies(id) on delete set null;

alter table public.role_permission_rules drop constraint if exists role_permission_rules_resource_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_resource_check;
alter table public.role_permission_rules add constraint role_permission_rules_resource_check check (resource in (
  'expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones','instituciones','dependencias','perfil'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_resource_check check (resource in (
  'expedientes','providencias','actuaciones','audiencias','actas','documentos','comunicados','estados','usuarios','roles','auditoria','enlaces','firmas','configuracion','edicion','votos','sala','notificaciones','instituciones','dependencias','perfil'
));
alter table public.role_permission_rules drop constraint if exists role_permission_rules_action_check;
alter table public.user_permission_overrides drop constraint if exists user_permission_overrides_action_check;
alter table public.role_permission_rules add constraint role_permission_rules_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export'
));
alter table public.user_permission_overrides add constraint user_permission_overrides_action_check check (action in (
  'view','create','edit','upload','preview','download','archive','restore','hard_delete','publish','finalize','reopen','sign','print','share','repartition','assign_ponente','reschedule','cancel','deactivate','reactivate','assign_role','request','revoke','manage','take_control','send','register_session','register_vote','approve','return','create_in_institution','create_in_dependency','assign_dependency','view_all','view_dependency','assign_leader','edit_public','publish_profile','edit_institution','edit_dependency','edit_title','edit_own','export'
));

with permissions(action) as (values ('edit'),('edit_public'),('publish_profile'),('edit_institution'),('edit_dependency'),('edit_title'))
insert into public.role_permission_rules(role,resource,action,allowed)
select r,'perfil',p.action,
  case when r='SUPER_ADMIN' then true
       when p.action in ('edit','edit_public') and r<>'CONSULTA_PUBLICA' then true
       when p.action in ('publish_profile','edit_title') and r in ('ADMIN_INSTITUCIONAL','MAGISTRADO_CORTE_SUPREMA','MAGISTRADO_TRIBUNAL','JUEZ_CIRCUITO','JUEZ_MUNICIPAL') then true
       else false end
from unnest(enum_range(null::public.app_role)) r cross join permissions p
on conflict(role,resource,action) do update set allowed=excluded.allowed;

insert into public.role_permission_rules(role,resource,action,allowed)
select r,'usuarios','edit_own',r<>'CONSULTA_PUBLICA'::public.app_role from unnest(enum_range(null::public.app_role)) r
on conflict(role,resource,action) do update set allowed=excluded.allowed;

create or replace view public.public_institution_members with (security_barrier=true) as
select p.id,coalesce(nullif(p.public_display_name,''),p.full_name) as full_name,
  coalesce(nullif(p.public_title,''),p.position_title) as position_title,
  coalesce(p.public_institution_id,p.institution_id) as institution_id,
  coalesce(p.public_dependency_id,p.dependency_id) as dependency_id,p.avatar_path,p.is_dependency_leader,
  p.public_bio,p.public_phone
from public.profiles p
join public.dependencies d on d.id=coalesce(p.public_dependency_id,p.public_institution_id,p.dependency_id,p.institution_id)
where p.is_active and p.public_profile and d.is_active and d.archived_at is null and d.public_visible;
grant select on public.public_institution_members to anon,authenticated;
notify pgrst,'reload schema';
