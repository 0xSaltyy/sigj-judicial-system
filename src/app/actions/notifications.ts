"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function createAssignedNotification(formData: FormData) {
  const parsed = z.object({ recipient_user_id: dbUuid, title: z.string().trim().min(3).max(120), message: z.string().trim().min(3).max(500), link_url: z.string().startsWith("/admin/").optional().or(z.literal("")), priority: z.enum(["low","normal","high","urgent"]), related_record_type: z.string().trim().max(80).optional(), related_record_id: dbUuid.optional().or(z.literal("")) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/notificaciones?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase, profile } = await requirePermission(PERMISSIONS.notificationsManage);
  const admin = createAdminClient();
  if (!admin) redirect("/admin/notificaciones?error=Servicio%20de%20notificaciones%20no%20configurado");
  const { data: recipient } = await admin.from("profiles").select("id,institution_id,dependency_id,is_active").eq("id", parsed.data.recipient_user_id).maybeSingle();
  const sameInstitution = Boolean(profile.institution_id && recipient?.institution_id === profile.institution_id);
  const sameDependency = Boolean(profile.dependency_id && recipient?.dependency_id === profile.dependency_id);
  if (!recipient?.is_active || (!profile.is_owner && !sameInstitution && !sameDependency)) {
    await supabase.rpc("log_security_event", { p_action: "INTERNAL_NOTIFICATION_SCOPE_DENIED", p_table: "internal_notifications", p_record_id: parsed.data.related_record_id || null, p_description: "Intento de notificar fuera del alcance institucional", p_metadata: {} });
    redirect("/admin/notificaciones?error=El%20destinatario%20no%20pertenece%20a%20su%20alcance%20institucional");
  }
  const { data, error } = await supabase.rpc("create_internal_notification", { p_recipient: parsed.data.recipient_user_id, p_title: parsed.data.title, p_message: parsed.data.message, p_type: "manual", p_link_url: parsed.data.link_url || null, p_priority: parsed.data.priority, p_record_type: parsed.data.related_record_type || null, p_record_id: parsed.data.related_record_id || null });
  if (error || !data) redirect(`/admin/notificaciones?error=${encodeURIComponent(error?.message || "No fue posible asignar la notificación")}`);
  revalidatePath("/admin/notificaciones");
  redirect("/admin/notificaciones?success=Notificaci%C3%B3n%20asignada");
}
