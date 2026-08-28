"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const redirectByResource: Record<string, string> = {
  cases: "/admin/expedientes",
  case_actions: "/admin/actuaciones",
  hearings: "/admin/audiencias",
  proceedings: "/admin/providencias",
  public_notices: "/admin/comunicados",
  judicial_states: "/admin/estados",
  roleplay_warrants: "/admin/warrants",
  roleplay_applications: "/admin/postulaciones",
  complaints: "/admin/denuncias",
};

export async function manageLifecycle(formData: FormData) {
  const resource = String(formData.get("resource") || "");
  const id = String(formData.get("id") || "");
  const operation = String(formData.get("operation") || "");
  const confirmation = String(formData.get("confirmation") || "");
  const back = redirectByResource[resource] ?? "/admin/dashboard";
  const supabase = await createClient();
  if (!supabase) redirect(`${back}?error=Supabase%20no%20configurado`);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (resource === "cases" && operation === "delete") {
    await deleteCaseAsOwner(id, confirmation, user.id, back);
  }

  if (resource === "roleplay_applications" && operation === "delete") {
    redirect(`${back}?error=${encodeURIComponent("Use el flujo OWNER de eliminación permanente de postulaciones")}`);
  }

  if (resource === "roleplay_warrants" || resource === "roleplay_applications") {
    if (operation === "delete" && confirmation !== "ELIMINAR DEFINITIVAMENTE") redirect(`${back}?error=${encodeURIComponent("Confirmación incorrecta")}`);
    const query = operation === "delete"
      ? supabase.from(resource).delete().eq("id", id)
      : supabase.from(resource).update(operation === "restore" ? { archived_at: null } : { archived_at: new Date().toISOString(), status: resource === "roleplay_warrants" ? "Revocada" : "Retirada" }).eq("id", id);
    const { error } = await query;
    if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
    redirect(`${back}?updated=1`);
  }

  if (resource === "complaints") {
    if (operation === "delete" && confirmation !== "ELIMINAR DEFINITIVAMENTE") redirect(`${back}?error=${encodeURIComponent("Confirmación incorrecta")}`);
    const query = operation === "delete"
      ? supabase.from("complaints").delete().eq("id", id)
      : supabase.from("complaints").update(operation === "restore" ? { archived_at: null, archived_by: null, status: "Recibida" } : { archived_at: new Date().toISOString(), status: "Archivada" }).eq("id", id);
    const { error } = await query;
    if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
    redirect(`${back}?updated=1`);
  }

  const { data, error } = await supabase.rpc("manage_record_lifecycle", {
    p_resource: resource,
    p_record_id: id,
    p_operation: operation,
    p_confirmation: confirmation || null,
  });
  const result = data as { ok?: boolean; error?: string } | null;
  if (error || !result?.ok) redirect(`${back}?error=${encodeURIComponent(error?.message || result?.error || "No fue posible completar la operación")}`);
  redirect(`${back}?updated=1`);
}

type StoragePath = { bucket: string; path: string };
type CaseDocumentRow = { file_path: string | null };
type ProceedingRow = { pdf_path: string | null };
type SignatureRow = { signature_image_path: string | null };
type ActorRow = { id: string; role: string | null; is_owner: boolean | null; is_active: boolean | null };

async function deleteCaseAsOwner(caseId: string, confirmation: string, userId: string, back: string): Promise<never> {
  if (confirmation !== "ELIMINAR DEFINITIVAMENTE") redirect(`${back}?error=${encodeURIComponent("Confirmación incorrecta")}`);

  const admin = createAdminClient();
  if (!admin) redirect(`${back}?error=${encodeURIComponent("Servicio administrativo no configurado")}`);

  const { data: actor } = await admin.from("profiles").select("id,role,is_owner,is_active").eq("id", userId).single();
  const profile = actor as ActorRow | null;
  const role = String(profile?.role || "");
  const canHardDeleteCases = Boolean(profile?.is_active && (profile?.is_owner || ["SUPER_ADMIN", "OWNER", "ATTORNEY_GENERAL"].includes(role)));

  if (!canHardDeleteCases) {
    await admin.from("audit_logs").insert({
      user_id: userId,
      action: "DELETE_DENIED",
      table_name: "cases",
      record_id: caseId || null,
      description: "Intento no autorizado de eliminar Case",
      metadata: { reason: "not_owner_or_attorney_general" },
    });
    redirect("/no-autorizado");
  }

  const { data: record, error: loadError } = await admin
    .from("cases")
    .select("id,case_number,internal_number,title,status,archived_at")
    .eq("id", caseId)
    .single();

  if (loadError || !record) redirect(`${back}?error=${encodeURIComponent(loadError?.message || "Case no encontrado")}`);

  const [documents, proceedings, signatures] = await Promise.all([
    admin.from("documents").select("file_path").eq("case_id", caseId),
    admin.from("proceedings").select("pdf_path").eq("case_id", caseId),
    admin.from("signatures").select("signature_image_path").eq("case_id", caseId),
  ]);

  const storagePaths: StoragePath[] = [
    ...((documents.data ?? []) as CaseDocumentRow[]).flatMap((item) => item.file_path ? [{ bucket: "case-documents", path: item.file_path }] : []),
    ...((proceedings.data ?? []) as ProceedingRow[]).flatMap((item) => item.pdf_path ? [{ bucket: "providence-files", path: item.pdf_path }] : []),
    ...((signatures.data ?? []) as SignatureRow[]).flatMap((item) => item.signature_image_path ? [{ bucket: "signatures", path: item.signature_image_path }] : []),
  ];
  await removeStorageObjects(admin, storagePaths);

  await admin.from("signatures").delete().eq("case_id", caseId);
  await admin.from("signature_requests").delete().eq("case_id", caseId);

  const { error: deleteError } = await admin.from("cases").delete().eq("id", caseId);
  if (deleteError) {
    await admin.from("audit_logs").insert({
      user_id: userId,
      action: "DELETE_FAILED",
      table_name: "cases",
      record_id: caseId,
      description: "No fue posible eliminar definitivamente el Case",
      metadata: { error: deleteError.message },
    });
    redirect(`${back}?error=${encodeURIComponent(deleteError.message)}`);
  }

  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "PERMANENT_DELETE",
    table_name: "cases",
    record_id: caseId,
    description: "Tombstone: Case eliminado permanentemente por OWNER",
    metadata: {
      case_number: record.case_number,
      internal_number: record.internal_number,
      title: record.title,
      status: record.status,
      archived_at: record.archived_at,
      deleted_storage_paths: storagePaths.map((item) => `${item.bucket}/${item.path}`),
    },
  });

  redirect(`${back}?deleted=1`);
}

async function removeStorageObjects(admin: ReturnType<typeof createAdminClient>, files: StoragePath[]) {
  if (!admin || files.length === 0) return;
  const unique = Array.from(new Map(files.map((file) => [`${file.bucket}/${file.path}`, file])).values());
  const grouped = unique.reduce<Record<string, string[]>>((acc, item) => {
    acc[item.bucket] ??= [];
    acc[item.bucket].push(item.path);
    return acc;
  }, {});
  await Promise.all(Object.entries(grouped).map(([bucket, paths]) => admin.storage.from(bucket).remove(paths)));
}
