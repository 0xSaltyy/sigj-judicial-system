import { AdminSidebar, AdminTopbar } from "@/components/admin-sidebar";
import { requireInternalUser } from "@/lib/auth/authorization";
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireInternalUser();
  const { data: institution } = profile.dependency_id
    ? await supabase.from("dependencies").select("name").eq("id", profile.dependency_id).maybeSingle()
    : { data: null };
  const viewer = {
    fullName: profile.full_name,
    role: profile.role,
    institution: institution?.name ?? "Palacio Judicial",
    isOwner: profile.is_owner,
  };
  return <div className="admin-shell min-h-screen bg-[#f5f7f9]"><AdminSidebar viewer={viewer} /><div className="admin-content lg:pl-64"><AdminTopbar viewer={viewer} /><main className="admin-main mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main></div></div>;
}
