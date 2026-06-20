"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERMISSIONS, requireCaseAccess } from "@/lib/auth/permissions";
import {
  appUrl,
  createSecureToken,
  hashSecret,
  maskEmail,
  verificationCode,
} from "@/lib/secure-tokens";
import { dbUuid } from "@/lib/validation";

const targetTypes = z.enum([
  "proceeding",
  "hearing_minute",
  "certificate",
  "document",
]);
const requestBase = {
  case_id: dbUuid,
  target_type: targetTypes,
  target_id: dbUuid,
  signer_name: z.string().trim().min(2).max(160),
  signer_title: z.string().trim().min(2).max(160),
  purpose: z.string().trim().min(2).max(240),
  signature_order: z.coerce.number().int().min(1).max(20),
  destination: z.string().startsWith("/admin/"),
};
const requestSchema = z.object({
  ...requestBase,
  signer_email: z.string().trim().email().optional().or(z.literal("")),
  expires_hours: z.coerce.number().int().min(1).max(720),
});
const internalAssignmentSchema = z.object({
  ...requestBase,
  signer_user_id: dbUuid,
  expires_hours: z.coerce.number().int().min(1).max(720),
});
const directSignatureSchema = z.object({
  ...requestBase,
  signature_data: z.string().startsWith("data:image/png;base64,"),
});
const pendingInternalSignatureSchema = z.object({
  request_id: dbUuid,
  case_id: dbUuid,
  target_type: targetTypes,
  target_id: dbUuid,
  destination: z.string().startsWith("/admin/"),
  signature_data: z.string().startsWith("data:image/png;base64,"),
});

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type PersistableSignatureRequest = {
  id: string;
  case_id: string;
  target_type: string;
  target_id: string;
  signer_user_id: string | null;
  signer_name: string;
  signer_title: string;
  signer_email_masked: string | null;
  purpose: string;
  signature_order: number;
};

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
  const { supabase, user } = await requireCaseAccess(
    parsed.data.case_id,
    PERMISSIONS.signaturesManage,
  );
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
  const email = parsed.data.signer_email || null;
  const { token, hash } = createSecureToken();
  const { error } = await supabase.from("signature_requests").insert({
    case_id: parsed.data.case_id,
    target_type: parsed.data.target_type,
    target_id: parsed.data.target_id,
    signer_type: "external",
    signer_user_id: null,
    signer_role: null,
    signer_dependency_id: null,
    signer_name: parsed.data.signer_name,
    signer_title: parsed.data.signer_title,
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
      signer_type: "external",
    },
  });
  revalidatePath(parsed.data.destination);
  redirect(
    `${parsed.data.destination}?success=${encodeURIComponent("Solicitud de firma creada")}&signingLink=${encodeURIComponent(appUrl(`/firmar/${token}`))}`,
  );
}

export async function assignInternalSignature(formData: FormData) {
  const parsed = internalAssignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(`/admin/dashboard?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase, user } = await requireCaseAccess(
    parsed.data.case_id,
    PERMISSIONS.signaturesManage,
  );
  if (!(await targetExists(supabase, parsed.data.target_type, parsed.data.target_id, parsed.data.case_id)))
    redirect(`${parsed.data.destination}?error=Documento%20de%20firma%20no%20válido`);
  const admin = createAdminClient();
  if (!admin)
    redirect(`${parsed.data.destination}?error=Servicio%20de%20firma%20no%20configurado`);
  const { data: signer } = await admin
    .from("profiles")
    .select("id,email,is_active")
    .eq("id", parsed.data.signer_user_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!signer)
    redirect(`${parsed.data.destination}?error=El%20usuario%20interno%20no%20está%20disponible`);
  const { hash } = createSecureToken();
  const { error } = await supabase.from("signature_requests").insert({
    case_id: parsed.data.case_id,
    target_type: parsed.data.target_type,
    target_id: parsed.data.target_id,
    signer_type: "internal",
    signer_user_id: signer.id,
    signer_name: parsed.data.signer_name,
    signer_title: parsed.data.signer_title,
    signer_email_masked: maskEmail(signer.email),
    signer_email_hash: signer.email ? hashSecret(signer.email.toLowerCase()) : null,
    purpose: parsed.data.purpose,
    signature_order: parsed.data.signature_order,
    token_hash: hash,
    expires_at: new Date(Date.now() + parsed.data.expires_hours * 3600000).toISOString(),
    requested_by: user.id,
    metadata: { delivery: "internal" },
  });
  if (error)
    redirect(`${parsed.data.destination}?error=${encodeURIComponent(error.message)}`);
  await supabase.rpc("log_security_event", {
    p_action: "INTERNAL_SIGNATURE_ASSIGNED",
    p_table: "signature_requests",
    p_record_id: parsed.data.target_id,
    p_description: "Firma asignada a un usuario interno sin generar enlace externo",
    p_metadata: { target_type: parsed.data.target_type, signer_user_id: signer.id },
  });
  revalidatePath(parsed.data.destination);
  redirect(`${parsed.data.destination}?success=${encodeURIComponent(signer.id === user.id ? "Firma interna lista. Use Firmar ahora" : "Firma interna asignada sin enlace externo")}`);
}

export async function signNow(formData: FormData) {
  const parsed = directSignatureSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(`/admin/dashboard?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase, user, profile } = await requireCaseAccess(
    parsed.data.case_id,
    PERMISSIONS.signaturesSign,
  );
  if (!(await targetExists(supabase, parsed.data.target_type, parsed.data.target_id, parsed.data.case_id)))
    redirect(`${parsed.data.destination}?error=Documento%20de%20firma%20no%20válido`);
  const admin = createAdminClient();
  if (!admin)
    redirect(`${parsed.data.destination}?error=Servicio%20de%20firma%20no%20configurado`);
  const { hash } = createSecureToken();
  const { data: request, error: requestError } = await admin
    .from("signature_requests")
    .insert({
      case_id: parsed.data.case_id,
      target_type: parsed.data.target_type,
      target_id: parsed.data.target_id,
      signer_type: "internal",
      signer_user_id: user.id,
      signer_name: parsed.data.signer_name,
      signer_title: parsed.data.signer_title,
      signer_email_masked: maskEmail(profile.email),
      signer_email_hash: hashSecret(profile.email.toLowerCase()),
      purpose: parsed.data.purpose,
      signature_order: parsed.data.signature_order,
      token_hash: hash,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      requested_by: user.id,
      metadata: { delivery: "internal_direct" },
    })
    .select("*")
    .single();
  if (requestError || !request)
    redirect(`${parsed.data.destination}?error=${encodeURIComponent(requestError?.message || "No fue posible preparar la firma")}`);
  const error = await persistSignature(admin, request, parsed.data.signature_data, "Firma interna capturada directamente", user.id);
  if (error) {
    await admin.from("signature_requests").delete().eq("id", request.id).eq("status", "pending");
    redirect(`${parsed.data.destination}?error=${encodeURIComponent(error)}`);
  }
  revalidatePath(parsed.data.destination);
  redirect(`${parsed.data.destination}?success=Firma%20registrada%20correctamente`);
}

export async function completeInternalSignature(formData: FormData) {
  const parsed = pendingInternalSignatureSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(`/admin/dashboard?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase, user } = await requireCaseAccess(
    parsed.data.case_id,
    PERMISSIONS.signaturesSign,
  );
  if (!(await targetExists(supabase, parsed.data.target_type, parsed.data.target_id, parsed.data.case_id)))
    redirect(`${parsed.data.destination}?error=Documento%20de%20firma%20no%20válido`);
  const admin = createAdminClient();
  if (!admin)
    redirect(`${parsed.data.destination}?error=Servicio%20de%20firma%20no%20configurado`);
  const { data: request } = await admin
    .from("signature_requests")
    .select("*")
    .eq("id", parsed.data.request_id)
    .eq("case_id", parsed.data.case_id)
    .eq("target_type", parsed.data.target_type)
    .eq("target_id", parsed.data.target_id)
    .eq("signer_type", "internal")
    .eq("signer_user_id", user.id)
    .eq("status", "pending")
    .is("revoked_at", null)
    .maybeSingle();
  if (!request || new Date(request.expires_at) <= new Date())
    redirect(`${parsed.data.destination}?error=La%20solicitud%20interna%20no%20está%20vigente`);
  const error = await persistSignature(admin, request, parsed.data.signature_data, "Firma interna capturada directamente", user.id);
  if (error)
    redirect(`${parsed.data.destination}?error=${encodeURIComponent(error)}`);
  revalidatePath(parsed.data.destination);
  redirect(`${parsed.data.destination}?success=Firma%20registrada%20correctamente`);
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
  const { supabase } = await requireCaseAccess(
    parsed.data.case_id,
    PERMISSIONS.signaturesManage,
  );
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
    PERMISSIONS.signaturesManage,
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

async function persistSignature(
  admin: AdminClient,
  request: PersistableSignatureRequest,
  signatureData: string,
  description: string,
  actorId?: string,
) {
  const bytes = Buffer.from(signatureData.split(",")[1] || "", "base64");
  if (!isValidSignaturePng(bytes)) return "Firma no válida";
  const signatureId = crypto.randomUUID();
  const path = `${request.case_id}/${request.target_type}/${request.target_id}/${signatureId}.png`;
  const { error: uploadError } = await admin.storage
    .from("signatures")
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (uploadError) return uploadError.message;
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const { error: signatureError } = await admin.from("signatures").insert({
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
  if (signatureError) {
    await admin.storage.from("signatures").remove([path]);
    return signatureError.message;
  }
  const { data: completed, error: requestError } = await admin
    .from("signature_requests")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("id", request.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (requestError || !completed) {
    await admin.from("signatures").delete().eq("id", signatureId);
    await admin.storage.from("signatures").remove([path]);
    return requestError?.message || "La solicitud ya no está vigente";
  }
  await admin.from("audit_logs").insert({
    ...(actorId ? { user_id: actorId } : {}),
    action: "SIGNATURE_COMPLETED",
    table_name: "signatures",
    record_id: signatureId,
    description,
    metadata: {
      target_type: request.target_type,
      target_id: request.target_id,
      request_id: request.id,
      delivery: actorId ? "internal" : "external_link",
    },
  });
  return null;
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
  const error = await persistSignature(
    admin,
    request,
    parsed.data.signature_data,
    "Firma capturada mediante enlace acotado",
  );
  if (error)
    redirect(`/firmar/${encodeURIComponent(token)}?error=${encodeURIComponent(error)}`);
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
