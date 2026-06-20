import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { NoticeForm } from "@/components/notice-form";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { noticeDetailRealtime } from "@/lib/realtime-subscriptions";
export default async function EditNotice({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, q, { supabase }] = await Promise.all([
    params,
    searchParams,
    requirePermission(PERMISSIONS.noticesEdit),
  ]);
  const { data } = await supabase
    .from("public_notices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  return (
    <>
      <RealtimeRefresh
        channel={`admin-notice-editor-${id}`}
        subscriptions={noticeDetailRealtime(id)}
        mode="prompt"
        promptMessage="Hay cambios nuevos en este comunicado. Actualizar vista."
      />
      <AdminPageHeader
        title="Editar comunicado"
        description="Cambios auditados y publicación controlada."
      />
      <ActionMessage error={q.error} />
      <NoticeForm notice={data} />
    </>
  );
}
