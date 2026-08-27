"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateApplicationReview(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const public_message = String(formData.get("public_message") || "");
  const internal_notes = String(formData.get("internal_notes") || "");
  const supabase = await createClient();
  if (!supabase) redirect("/admin/postulaciones?error=Supabase%20no%20configurado");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("roleplay_applications").update({ status, public_message, internal_notes }).eq("id", id);
  if (error) redirect(`/admin/postulaciones?error=${encodeURIComponent(error.message)}`);
  await supabase.from("audit_logs").insert({ user_id: user.id, action: "UPDATE", table_name: "roleplay_applications", record_id: id, description: "Actualización de postulación", metadata: { status } });
  redirect("/admin/postulaciones?updated=1");
}

export async function deleteRoleplayApplication(formData: FormData) {
  const id = String(formData.get("id") || "");
  const expectedName = String(formData.get("applicant_name") || "");
  const expectedTracking = String(formData.get("tracking_code") || "");
  const confirmation = String(formData.get("confirmation") || "");
  const reason = String(formData.get("reason") || "Eliminación permanente solicitada por OWNER");
  const back = "/admin/postulaciones";

  if (confirmation !== "ELIMINAR POSTULACION") redirect(`${back}?error=${encodeURIComponent("Confirmación incorrecta")}`);

  const supabase = await createClient();
  if (!supabase) redirect(`${back}?error=Supabase%20no%20configurado`);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect(`${back}?error=${encodeURIComponent("Servicio administrativo no configurado")}`);

  const { data: actor } = await admin.from("profiles").select("id,role,is_owner,is_active").eq("id", user.id).single();
  const actorRole = String(actor?.role || "");
  const canDeleteApplications = Boolean(actor?.is_active && (actor?.is_owner || ["SUPER_ADMIN", "OWNER", "ATTORNEY_GENERAL"].includes(actorRole)));
  if (!canDeleteApplications) {
    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "DELETE_DENIED",
      table_name: "roleplay_applications",
      record_id: id || null,
      description: "Intento no autorizado de eliminar postulación",
      metadata: { reason: "not_owner" },
    });
    redirect("/no-autorizado");
  }

  const { data: application, error: loadError } = await admin
    .from("roleplay_applications")
    .select("id,tracking_code,applicant_name,application_type,answers")
    .eq("id", id)
    .single();

  if (loadError || !application) redirect(`${back}?error=${encodeURIComponent(loadError?.message || "No se encontró la postulación")}`);
  if (application.applicant_name !== expectedName || application.tracking_code !== expectedTracking) {
    redirect(`${back}?error=${encodeURIComponent("Los datos de confirmación no coinciden con la postulación")}`);
  }

  const storagePaths = collectStoragePaths(application.answers);
  await removeApplicationFiles(admin, storagePaths);

  const { error: deleteError } = await admin.from("roleplay_applications").delete().eq("id", id);
  if (deleteError) redirect(`${back}?error=${encodeURIComponent(deleteError.message)}`);

  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "PERMANENT_DELETE",
    table_name: "roleplay_applications",
    record_id: id,
    description: "Tombstone: postulación eliminada permanentemente por OWNER",
    metadata: {
      deleted_record_identifier: id,
      tracking_code: application.tracking_code,
      application_type: application.application_type,
      authorized_user: user.id,
      reason,
      deleted_storage_paths: storagePaths.map(({ bucket, path }) => `${bucket}/${path}`),
    },
  });

  redirect("/admin/postulaciones?deleted=1");
}

type StoragePath = { bucket: string; path: string };

function collectStoragePaths(value: unknown): StoragePath[] {
  const found: StoragePath[] = [];
  const visit = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") {
      const record = node as Record<string, unknown>;
      const bucket = typeof record.bucket === "string" ? record.bucket : typeof record.bucket_id === "string" ? record.bucket_id : "roleplay-application-files";
      const path = typeof record.path === "string" ? record.path : typeof record.file_path === "string" ? record.file_path : typeof record.storage_path === "string" ? record.storage_path : "";
      if (path && ["roleplay-application-files", "application-files"].includes(bucket)) found.push({ bucket, path });
      Object.values(record).forEach(visit);
    }
  };
  visit(value);
  return Array.from(new Map(found.map((item) => [`${item.bucket}/${item.path}`, item])).values());
}

async function removeApplicationFiles(admin: ReturnType<typeof createAdminClient>, files: StoragePath[]) {
  if (!admin || files.length === 0) return;
  const grouped = files.reduce<Record<string, string[]>>((acc, item) => {
    acc[item.bucket] ??= [];
    acc[item.bucket].push(item.path);
    return acc;
  }, {});
  await Promise.all(Object.entries(grouped).map(([bucket, paths]) => admin.storage.from(bucket).remove(paths)));
}
