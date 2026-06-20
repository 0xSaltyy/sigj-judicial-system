"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import type { PermissionAction, PermissionResource } from "@/lib/permissions/catalog";
import { dbUuid } from "@/lib/validation";

const schema = z.object({
  resource: z.enum([
    "cases",
    "radications",
    "case_actions",
    "documents",
    "hearings",
    "proceedings",
    "public_notices",
    "judicial_states",
    "hearing_minutes",
    "dependencies",
  ]),
  record_id: dbUuid,
  operation: z.enum(["archive", "restore", "delete"]),
  confirmation: z.string().optional(),
  destination: z.string().startsWith("/admin/"),
});

type LifecycleResult = { ok?: boolean; error?: string };

export async function manageRecordLifecycle(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect("/admin/dashboard?error=Solicitud%20de%20archivo%20no%20válida");
  const permissionResources: Record<z.infer<typeof schema>["resource"], PermissionResource> = {
    cases: "expedientes",
    radications: "expedientes",
    case_actions: "actuaciones",
    documents: "documentos",
    hearings: "audiencias",
    proceedings: "providencias",
    public_notices: "comunicados",
    judicial_states: "estados",
    hearing_minutes: "actas",
    dependencies: "configuracion",
  };
  const permissionActions: Record<z.infer<typeof schema>["operation"], PermissionAction> = {
    archive: "archive",
    restore: "restore",
    delete: "hard_delete",
  };
  const { supabase } = await requirePermission({
    resource: permissionResources[parsed.data.resource],
    action: permissionActions[parsed.data.operation],
  });
  let storagePath: string | null = null;

  if (
    parsed.data.resource === "documents" &&
    parsed.data.operation === "delete"
  ) {
    const { data } = await supabase
      .from("documents")
      .select("file_path")
      .eq("id", parsed.data.record_id)
      .maybeSingle();
    storagePath = data?.file_path ?? null;
  }

  const { data, error } = await supabase.rpc("manage_record_lifecycle", {
    p_resource: parsed.data.resource,
    p_record_id: parsed.data.record_id,
    p_operation: parsed.data.operation,
    p_confirmation: parsed.data.confirmation || null,
  });
  const result = (data ?? {}) as LifecycleResult;
  if (error || !result.ok) {
    redirect(
      `${parsed.data.destination}?error=${encodeURIComponent(error?.message ?? result.error ?? "No fue posible completar la operación")}`,
    );
  }

  let storageWarning = "";
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from("case-documents")
      .remove([storagePath]);
    if (storageError) {
      storageWarning =
        " El registro se eliminó, pero un administrador debe revisar el archivo residual de Storage.";
      await supabase.rpc("log_security_event", {
        p_action: "STORAGE_CLEANUP_FAILED",
        p_table: "documents",
        p_record_id: parsed.data.record_id,
        p_description:
          "No fue posible limpiar el objeto de Storage después de eliminar el documento",
        p_metadata: { error: storageError.message },
      });
    }
  }

  revalidatePath(parsed.data.destination.split("?")[0]);
  const labels = {
    archive: "Registro archivado",
    restore: "Registro restaurado",
    delete: "Registro eliminado definitivamente",
  } as const;
  redirect(
    `${parsed.data.destination}?success=${encodeURIComponent(labels[parsed.data.operation] + storageWarning)}`,
  );
}
