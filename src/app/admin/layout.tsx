import { AdminSidebar, AdminTopbar } from "@/components/admin-sidebar";
import { requireInternalUser } from "@/lib/auth/authorization";
import { can } from "@/lib/auth/permissions";
import { profileAssetDataUrl } from "@/lib/profile-assets";
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireInternalUser();
  const [institutionResult, unreadResult, notificationsResult, avatarUrl, casesPermission, actionsPermission, proceedingsPermission, hearingsPermission, noticesPermission, notificationsPermission, dependenciesPermission, usersPermission, rolesPermission, auditPermission, settingsPermission] = await Promise.all([
    profile.dependency_id ? supabase.from("dependencies").select("name").eq("id", profile.dependency_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("internal_notifications").select("id", { count: "exact", head: true }).eq("recipient_user_id", profile.id).is("read_at", null),
    supabase.from("internal_notifications").select("id,title,message,link_url,read_at").eq("recipient_user_id", profile.id).order("created_at", { ascending: false }).limit(5),
    profileAssetDataUrl(profile.avatar_path),
    can(profile,"view","expedientes",{supabase}), can(profile,"view","actuaciones",{supabase}), can(profile,"view","providencias",{supabase}),
    can(profile,"view","audiencias",{supabase}), can(profile,"view","comunicados",{supabase}), can(profile,"view","notificaciones",{supabase}), can(profile,"view","dependencias",{supabase}),
    can(profile,"view","usuarios",{supabase}),
    can(profile,"view","roles",{supabase}),
    can(profile,"view","auditoria",{supabase}),
    can(profile,"view","configuracion",{supabase}),
  ]);
  const institution = institutionResult.data;
  const viewer = {
    fullName: profile.full_name,
    role: profile.role,
    institution: institution?.name ?? "Palacio Judicial",
    isOwner: profile.is_owner,
    unreadNotifications: unreadResult.count ?? 0,
    latestNotifications: notificationsResult.data ?? [],
    avatarUrl,
    permissions: { cases:casesPermission,actions:actionsPermission,proceedings:proceedingsPermission,hearings:hearingsPermission,notices:noticesPermission,notifications:notificationsPermission,dependencies:dependenciesPermission,users:usersPermission,roles:rolesPermission,audit:auditPermission,settings:settingsPermission },
  };
  return <div className="admin-shell min-h-screen bg-[#f5f7f9]"><AdminSidebar viewer={viewer} /><div className="admin-content lg:pl-64"><AdminTopbar viewer={viewer} /><main className="admin-main mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main></div></div>;
}
