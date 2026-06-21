"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";

export async function markNotificationRead(formData: FormData) {
  const parsed = z.object({ id: dbUuid, destination: z.string().startsWith("/admin/").optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/notificaciones?error=Notificaci%C3%B3n%20no%20v%C3%A1lida");
  const { supabase, user } = await requirePermission(PERMISSIONS.notificationsView);
  const { error } = await supabase.from("internal_notifications").update({ read_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("recipient_user_id", user.id);
  if (error) redirect(`/admin/notificaciones?error=${encodeURIComponent("No fue posible actualizar la notificación")}`);
  await supabase.rpc("log_security_event", { p_action: "INTERNAL_NOTIFICATION_READ", p_table: "internal_notifications", p_record_id: parsed.data.id, p_description: "Notificación interna marcada como leída", p_metadata: {} });
  revalidatePath("/admin/notificaciones");
  redirect(parsed.data.destination ?? "/admin/notificaciones");
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requirePermission(PERMISSIONS.notificationsView);
  await supabase.from("internal_notifications").update({ read_at: new Date().toISOString() }).eq("recipient_user_id", user.id).is("read_at", null);
  revalidatePath("/admin/notificaciones");
  redirect("/admin/notificaciones?success=Notificaciones%20marcadas%20como%20le%C3%ADdas");
}
