import { redirect } from "next/navigation";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function AdminElectionScreen({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { supabase }] = await Promise.all([
    params,
    requirePermission(PERMISSIONS.electionsLiveRoom),
  ]);
  const { data } = await supabase.from("elections").select("slug").eq("id", id).maybeSingle();
  redirect(data?.slug ? `/elecciones/${data.slug}/sala` : `/admin/elecciones/${id}`);
}
