"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requireCaseAccess } from "@/lib/auth/permissions";
import { APP_ROLES, type AppRole } from "@/lib/user-management";
import type { PermissionResource } from "@/lib/permissions/catalog";
import { dbUuid } from "@/lib/validation";
import {
  appUrl,
  createSecureToken,
  hashSecret,
  maskEmail,
} from "@/lib/secure-tokens";

const schema = z.object({
  resource_type: z.enum(["case", "proceeding", "document"]),
  resource_id: dbUuid,
  case_id: dbUuid,
  target: z.string().min(3),
  expires_hours: z.coerce.number().int().min(1).max(720),
  destination: z.string().startsWith("/admin/"),
});

export async function shareResource(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect("/admin/dashboard?error=Datos%20de%20compartición%20no%20válidos");
  const resourcePermissions: Record<typeof parsed.data.resource_type, PermissionResource> = {
    case: "expedientes",
    proceeding: "providencias",
    document: "documentos",
  };
  const { supabase, user } = await requireCaseAccess(parsed.data.case_id, {
    resource: resourcePermissions[parsed.data.resource_type],
    action: "share",
  });

  if (
    parsed.data.resource_type === "case" &&
    parsed.data.resource_id !== parsed.data.case_id
  ) {
    redirect(`${parsed.data.destination}?error=Expediente%20no%20válido`);
  }

  if (parsed.data.resource_type === "proceeding") {
    const { data } = await supabase
      .from("proceedings")
      .select("id")
      .eq("id", parsed.data.resource_id)
      .eq("case_id", parsed.data.case_id)
      .maybeSingle();
    if (!data)
      redirect(
        `${parsed.data.destination}?error=Providencia%20no%20disponible`,
      );
  }
  if (parsed.data.resource_type === "document") {
    const { data } = await supabase
      .from("documents")
      .select("id")
      .eq("id", parsed.data.resource_id)
      .eq("case_id", parsed.data.case_id)
      .is("archived_at", null)
      .maybeSingle();
    if (!data)
      redirect(`${parsed.data.destination}?error=Documento%20no%20disponible`);
  }

  const [kind, value] = parsed.data.target.split(":", 2);
  const target = {
    target_user_id: kind === "user" ? value : null,
    target_role:
      kind === "role" && APP_ROLES.includes(value as AppRole) ? value : null,
    target_dependency_id: kind === "dependency" ? value : null,
  };
  if (
    !target.target_user_id &&
    !target.target_role &&
    !target.target_dependency_id
  )
    redirect(`${parsed.data.destination}?error=Destinatario%20no%20válido`);

  if (target.target_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", target.target_user_id)
      .eq("is_active", true)
      .neq("role", "CONSULTA_PUBLICA")
      .maybeSingle();
    if (!profile)
      redirect(
        `${parsed.data.destination}?error=Usuario%20destino%20no%20válido`,
      );
  }
  if (target.target_dependency_id) {
    const { data: dependency } = await supabase
      .from("dependencies")
      .select("id")
      .eq("id", target.target_dependency_id)
      .eq("is_active", true)
      .is("archived_at", null)
      .maybeSingle();
    if (!dependency)
      redirect(
        `${parsed.data.destination}?error=Dependencia%20destino%20no%20válida`,
      );
  }

  const { error } = await supabase.from("record_shares").insert({
    resource_type: parsed.data.resource_type,
    resource_id: parsed.data.resource_id,
    case_id: parsed.data.case_id,
    shared_by: user.id,
    ...target,
    expires_at: new Date(
      Date.now() + parsed.data.expires_hours * 60 * 60 * 1000,
    ).toISOString(),
  });
  if (error)
    redirect(
      `${parsed.data.destination}?error=${encodeURIComponent(error.message)}`,
    );
  await supabase.rpc("log_security_event", {
    p_action: "RECORD_SHARED",
    p_table: "record_shares",
    p_record_id: parsed.data.resource_id,
    p_description: "Acceso interno temporal concedido",
    p_metadata: {
      resource_type: parsed.data.resource_type,
      target_type: kind,
      expires_hours: parsed.data.expires_hours,
    },
  });
  revalidatePath(parsed.data.destination);
  redirect(
    `${parsed.data.destination}?success=${encodeURIComponent("Acceso compartido y auditado")}`,
  );
}

const externalShareSchema = z.object({
  case_id: dbUuid,
  label: z.string().trim().min(3).max(160),
  external_name: z.string().trim().max(160).optional(),
  external_email: z.string().trim().email().optional().or(z.literal("")),
  expires_minutes: z.coerce.number().int().min(15).max(10080),
  custom_expires_minutes: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(15).max(10080).optional(),
  ),
  include_documents: z.string().optional(),
  include_proceedings: z.string().optional(),
  include_hearings: z.string().optional(),
  include_parties: z.string().optional(),
  actions_scope: z.enum(["public", "all"]),
});

export async function createExternalShare(formData: FormData) {
  const parsed = externalShareSchema.safeParse(Object.fromEntries(formData));
  const caseId = String(formData.get("case_id") || "");
  if (!parsed.success)
    redirect(
      `/admin/expedientes/${caseId}/compartir?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  const { supabase, user } = await requireCaseAccess(
    parsed.data.case_id,
    PERMISSIONS.linksShare,
  );
  const { token, hash } = createSecureToken();
  const email = parsed.data.external_email || null;
  const expiresMinutes =
    parsed.data.custom_expires_minutes ?? parsed.data.expires_minutes;
  const { error } = await supabase
    .from("share_links")
    .insert({
      case_id: parsed.data.case_id,
      label: parsed.data.label,
      external_name: parsed.data.external_name || null,
      external_email_masked: maskEmail(email),
      external_email_hash: email ? hashSecret(email.toLowerCase()) : null,
      token_hash: hash,
      include_documents: parsed.data.include_documents === "true",
      include_proceedings: parsed.data.include_proceedings === "true",
      include_hearings: parsed.data.include_hearings === "true",
      include_parties: parsed.data.include_parties === "true",
      actions_scope: parsed.data.actions_scope,
      expires_at: new Date(
        Date.now() + expiresMinutes * 60000,
      ).toISOString(),
      created_by: user.id,
    });
  if (error)
    redirect(
      `/admin/expedientes/${parsed.data.case_id}/compartir?error=${encodeURIComponent(error.message)}`,
    );
  await supabase.rpc("log_security_event", {
    p_action: "EXTERNAL_SHARE_CREATED",
    p_table: "share_links",
    p_record_id: parsed.data.case_id,
    p_description: "Enlace externo acotado creado",
    p_metadata: {
      expires_minutes: expiresMinutes,
      include_documents: parsed.data.include_documents === "true",
      include_proceedings: parsed.data.include_proceedings === "true",
      include_hearings: parsed.data.include_hearings === "true",
      include_parties: parsed.data.include_parties === "true",
    },
  });
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}/compartir`);
  redirect(
    `/admin/expedientes/${parsed.data.case_id}/compartir?success=Enlace%20seguro%20creado&shareLink=${encodeURIComponent(appUrl(`/compartir/${token}`))}`,
  );
}

export async function revokeExternalShare(formData: FormData) {
  const parsed = z
    .object({ share_id: dbUuid, case_id: dbUuid })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect("/admin/expedientes?error=Enlace%20no%20válido");
  const { supabase } = await requireCaseAccess(
    parsed.data.case_id,
    PERMISSIONS.linksManage,
  );
  const { error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.share_id)
    .eq("case_id", parsed.data.case_id)
    .is("revoked_at", null);
  if (error)
    redirect(
      `/admin/expedientes/${parsed.data.case_id}/compartir?error=${encodeURIComponent(error.message)}`,
    );
  await supabase.rpc("log_security_event", {
    p_action: "EXTERNAL_SHARE_REVOKED",
    p_table: "share_links",
    p_record_id: parsed.data.share_id,
    p_description: "Enlace externo revocado",
    p_metadata: {},
  });
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}/compartir`);
  redirect(
    `/admin/expedientes/${parsed.data.case_id}/compartir?success=Enlace%20revocado`,
  );
}
