"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCaseAccess, RESOURCE_ROLES } from "@/lib/auth/permissions";
import {
  appUrl,
  createSecureToken,
  hashSecret,
  maskEmail,
  verificationCode,
} from "@/lib/secure-tokens";
import { dbUuid } from "@/lib/validation";
import { APP_ROLES, type AppRole } from "@/lib/user-management";

const targetTypes = z.enum([
  "proceeding",
  "hearing_minute",
  "certificate",
  "document",
]);
const requestSchema = z.object({
  case_id: dbUuid,
  target_type: targetTypes,
  target_id: dbUuid,
  signer_type: z.enum(["internal", "role", "dependency", "external"]),
  signer_user_id: dbUuid.optional().or(z.literal("")),
  signer_role: z.string().optional(),
  signer_dependency_id: dbUuid.optional().or(z.literal("")),
  signer_name: z.string().trim().min(2).max(160),
  signer_title: z.string().trim().min(2).max(160),
  signer_email: z.string().trim().email().optional().or(z.literal("")),
  purpose: z.string().trim().min(2).max(240),
  signature_order: z.coerce.number().int().min(1).max(20),
  expires_hours: z.coerce.number().int().min(1).max(720),
  destination: z.string().startsWith("/admin/"),
});

async function targetExists(
  supabase: Awaited<ReturnType<typeof requireCaseAccess>>["supabase"],
  type: z.infer<typeof targetTypes>,
  id: string,
  caseId: string,
) {
  const table =
    type === "proceeding"
      ? "proceedings"
      : type === "hearing_minute"
        ? "hearing_minutes"
        : type === "certificate"
          ? "certificates"
          : "documents";
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("case_id", caseId)
    .maybeSingle();
  return Boolean(data);
}

export async function requestSignature(formData: FormData) {
  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(
      `/admin/dashboard?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  const { supabase, user } = await requireCaseAccess(parsed.data.case_id, [
    ...RESOURCE_ROLES.proceedingsWrite,
    ...RESOURCE_ROLES.hearingsWrite,
  ]);
  if (
    !(await targetExists(
      supabase,
      parsed.data.target_type,
      parsed.data.target_id,
      parsed.data.case_id,
    ))
  )
    redirect(
      `${parsed.data.destination}?error=Documento%20de%20firma%20no%20válido`,
    );
  if (parsed.data.signer_type === "internal" && !parsed.data.signer_user_id)
    redirect(`${parsed.data.destination}?error=Seleccione%20el%20usuario%20interno`);
  if (
    parsed.data.signer_type === "role" &&
    !APP_ROLES.includes(parsed.data.signer_role as AppRole)
  )
    redirect(`${parsed.data.destination}?error=Seleccione%20un%20rol%20válido`);
  if (
    parsed.data.signer_type === "dependency" &&
    !parsed.data.signer_dependency_id
  )
    redirect(`${parsed.data.destination}?error=Seleccione%20la%20dependencia`);
  let signerName = parsed.data.signer_name;
  let signerTitle = parsed.data.signer_title;
  let email = parsed.data.signer_email || null;
  if (parsed.data.signer_type === "internal" && parsed.data.signer_user_id) {
    const { data: internalSigner } = await supabase
      .from("profiles")
      .select("full_name,position_title,email,is_active")
      .eq("id", parsed.data.signer_user_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!internalSigner)
      redirect(`${parsed.data.destination}?error=El%20usuario%20interno%20no%20está%20disponible`);
    signerName = internalSigner.full_name;
    signerTitle = internalSigner.position_title || parsed.data.signer_title;
    email = internalSigner.email;
  }
  const { token, hash } = createSecureToken();
  const { error } = await supabase.from("signature_requests").insert({
    case_id: parsed.data.case_id,
    target_type: parsed.data.target_type,
    target_id: parsed.data.target_id,
    signer_type: parsed.data.signer_type,
    signer_user_id: parsed.data.signer_user_id || null,
    signer_role:
      parsed.data.signer_type === "role"
        ? parsed.data.signer_role || null
        : null,
    signer_dependency_id: parsed.data.signer_dependency_id || null,
    signer_name: signerName,
    signer_title: signerTitle,
    signer_email_masked: maskEmail(email),
    signer_email_hash: email ? hashSecret(email.toLowerCase()) : null,
    purpose: parsed.data.purpose,
    signature_order: parsed.data.signature_order,
    token_hash: hash,
    expires_at: new Date(
      Date.now() + parsed.data.expires_hours * 3600000,
    ).toISOString(),
    requested_by: user.id,
  });
  if (error)
    redirect(
      `${parsed.data.destination}?error=${encodeURIComponent(error.message)}`,
    );
  await supabase.rpc("log_security_event", {
    p_action: "SIGNATURE_REQUESTED",
    p_table: "signature_requests",
    p_record_id: parsed.data.target_id,
    p_description: "Firma solicitada",
    p_metadata: {
      target_type: parsed.data.target_type,
      signer_type: parsed.data.signer_type,
    },
  });
  revalidatePath(parsed.data.destination);
  redirect(
    `${parsed.data.destination}?success=${encodeURIComponent("Solicitud de firma creada")}&signingLink=${encodeURIComponent(appUrl(`/firmar/${token}`))}`,
  );
}

export async function revokeSignatureRequest(formData: FormData) {
  const parsed = z
    .object({
      request_id: dbUuid,
      case_id: dbUuid,
      destination: z.string().startsWith("/admin/"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect("/admin/dashboard?error=Solicitud%20no%20válida");
  const { supabase } = await requireCaseAccess(parsed.data.case_id, [
    ...RESOURCE_ROLES.proceedingsWrite,
    ...RESOURCE_ROLES.hearingsWrite,
  ]);
  const { error } = await supabase
    .from("signature_requests")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.request_id)
    .eq("case_id", parsed.data.case_id)
    .eq("status", "pending");
  if (error)
    redirect(
      `${parsed.data.destination}?error=${encodeURIComponent(error.message)}`,
    );
  await supabase.rpc("log_security_event", {
    p_action: "SIGNATURE_REQUEST_REVOKED",
    p_table: "signature_requests",
    p_record_id: parsed.data.request_id,
    p_description: "Solicitud de firma revocada",
    p_metadata: {},
  });
  revalidatePath(parsed.data.destination);
  redirect(`${parsed.data.destination}?success=Solicitud%20revocada`);
}

export async function revokeCompletedSignature(formData: FormData) {
  const parsed = z
    .object({
      signature_id: dbUuid,
      case_id: dbUuid,
      destination: z.string().startsWith("/admin/"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect("/admin/dashboard?error=Firma%20no%20válida");
  const { supabase, profile } = await requireCaseAccess(
    parsed.data.case_id,
    [...RESOURCE_ROLES.proceedingsWrite, ...RESOURCE_ROLES.hearingsWrite],
  );
  const { data: signature } = await supabase
    .from("signatures")
    .select("id,request_id,target_type,target_id,status")
    .eq("id", parsed.data.signature_id)
    .eq("case_id", parsed.data.case_id)
    .maybeSingle();
  if (!signature || signature.status !== "signed")
    redirect(`${parsed.data.destination}?error=La%20firma%20no%20está%20disponible`);
  let finalized = false;
  if (signature.target_type === "proceeding") {
    const { data } = await supabase
      .from("proceedings")
      .select("status")
      .eq("id", signature.target_id)
      .single();
    finalized = ["Firmado", "Publicado"].includes(data?.status || "");
  } else if (signature.target_type === "hearing_minute") {
    const { data } = await supabase
      .from("hearing_minutes")
      .select("status")
      .eq("id", signature.target_id)
      .single();
    finalized = data?.status === "Finalizada";
  }
  if (finalized && !profile.is_owner)
    redirect(
      `${parsed.data.destination}?error=${encodeURIComponent("Sólo SUPER_ADMIN puede revocar una firma de un documento finalizado")}`,
    );
  const admin = createAdminClient();
  if (!admin)
    redirect(`${parsed.data.destination}?error=Servicio%20de%20firma%20no%20configurado`);
  const now = new Date().toISOString();
  const [signatureResult, requestResult] = await Promise.all([
    admin
      .from("signatures")
      .update({ status: "revoked", revoked_at: now })
      .eq("id", signature.id)
      .eq("status", "signed"),
    admin
      .from("signature_requests")
      .update({ status: "revoked", revoked_at: now })
      .eq("id", signature.request_id),
  ]);
  if (signatureResult.error || requestResult.error)
    redirect(
      `${parsed.data.destination}?error=${encodeURIComponent(signatureResult.error?.message || requestResult.error?.message || "No fue posible revocar")}`,
    );
  await admin.from("audit_logs").insert({
    user_id: profile.id,
    action: finalized
      ? "FINAL_SIGNATURE_REVOKED_BY_OWNER"
      : "DRAFT_SIGNATURE_REVOKED",
    table_name: "signatures",
    record_id: signature.id,
    description: "Firma revocada; el archivo se conserva para trazabilidad",
    metadata: {
      target_type: signature.target_type,
      target_id: signature.target_id,
      finalized,
    },
  });
  revalidatePath(parsed.data.destination);
  redirect(
    `${parsed.data.destination}?success=Firma%20revocada.%20Puede%20solicitar%20una%20nueva`,
  );
}

export async function declineSignature(formData: FormData) {
  const parsed = z
    .object({ token: z.string().min(20) })
    .safeParse(Object.fromEntries(formData));
  const token = String(formData.get("token") || "");
  if (!parsed.success)
    redirect(`/firmar/${encodeURIComponent(token)}?error=Enlace%20no%20válido`);
  const admin = createAdminClient();
  if (!admin)
    redirect(`/firmar/${encodeURIComponent(token)}?error=Servicio%20no%20configurado`);
  const { data: request } = await admin
    .from("signature_requests")
    .select("id,target_type,target_id,status,expires_at,revoked_at")
    .eq("token_hash", hashSecret(parsed.data.token))
    .maybeSingle();
  if (
    !request ||
    request.status !== "pending" ||
    request.revoked_at ||
    new Date(request.expires_at) <= new Date()
  )
    redirect(`/firmar/${encodeURIComponent(token)}?error=El%20enlace%20no%20está%20vigente`);
  await admin
    .from("signature_requests")
    .update({ status: "declined" })
    .eq("id", request.id)
    .eq("status", "pending");
  await admin.from("audit_logs").insert({
    action: "SIGNATURE_DECLINED",
    table_name: "signature_requests",
    record_id: request.id,
    description: "El firmante rechazó la solicitud mediante el enlace acotado",
    metadata: {
      target_type: request.target_type,
      target_id: request.target_id,
    },
  });
  redirect(`/firmar/${encodeURIComponent(token)}?success=Solicitud%20rechazada`);
}

export async function completeSignature(formData: FormData) {
  const parsed = z
    .object({
      token: z.string().min(20),
      signature_data: z.string().startsWith("data:image/png;base64,"),
    })
    .safeParse(Object.fromEntries(formData));
  const token = String(formData.get("token") || "");
  if (!parsed.success)
    redirect(
      `/firmar/${encodeURIComponent(token)}?error=Debe%20dibujar%20la%20firma`,
    );
  const admin = createAdminClient();
  if (!admin)
    redirect(
      `/firmar/${encodeURIComponent(token)}?error=Servicio%20de%20firma%20no%20configurado`,
    );
  const tokenHash = hashSecret(parsed.data.token);
  const { data: request } = await admin
    .from("signature_requests")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (
    !request ||
    request.status !== "pending" ||
    request.revoked_at ||
    new Date(request.expires_at) <= new Date()
  )
    redirect(
      `/firmar/${encodeURIComponent(token)}?error=El%20enlace%20no%20es%20válido%20o%20venció`,
    );
  const bytes = Buffer.from(parsed.data.signature_data.split(",")[1], "base64");
  if (!isValidSignaturePng(bytes))
    redirect(`/firmar/${encodeURIComponent(token)}?error=Firma%20no%20válida`);
  const signatureId = crypto.randomUUID();
  const path = `${request.case_id}/${request.target_type}/${request.target_id}/${signatureId}.png`;
  const { error: uploadError } = await admin.storage
    .from("signatures")
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (uploadError)
    redirect(
      `/firmar/${encodeURIComponent(token)}?error=${encodeURIComponent(uploadError.message)}`,
    );
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const { error } = await admin
    .from("signatures")
    .insert({
      id: signatureId,
      request_id: request.id,
      case_id: request.case_id,
      target_type: request.target_type,
      target_id: request.target_id,
      signer_user_id: request.signer_user_id,
      signer_name: request.signer_name,
      signer_title: request.signer_title,
      signer_email_masked: request.signer_email_masked,
      signature_image_path: path,
      purpose: request.purpose,
      signature_order: request.signature_order,
      ip_hash: ip ? hashSecret(ip) : null,
      user_agent: requestHeaders.get("user-agent")?.slice(0, 500),
      verification_code: verificationCode(),
    });
  if (error) {
    await admin.storage.from("signatures").remove([path]);
    redirect(
      `/firmar/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`,
    );
  }
  await admin
    .from("signature_requests")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("id", request.id)
    .eq("status", "pending");
  await admin
    .from("audit_logs")
    .insert({
      action: "SIGNATURE_COMPLETED",
      table_name: "signatures",
      record_id: signatureId,
      description: "Firma capturada mediante enlace acotado",
      metadata: {
        target_type: request.target_type,
        target_id: request.target_id,
        request_id: request.id,
      },
    });
  redirect(
    `/firmar/${encodeURIComponent(token)}?success=Firma%20registrada%20correctamente`,
  );
}

function isValidSignaturePng(bytes: Buffer) {
  if (bytes.length < 24 || bytes.length > 2 * 1024 * 1024) return false;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) return false;
  if (bytes.toString("ascii", 12, 16) !== "IHDR") return false;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  return width >= 200 && width <= 5000 && height >= 80 && height <= 3000;
}
