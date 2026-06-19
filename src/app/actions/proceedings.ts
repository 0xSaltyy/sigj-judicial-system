"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseAccess, RESOURCE_ROLES } from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";

const schema = z
  .object({
    id: dbUuid.optional().or(z.literal("")),
    case_id: dbUuid,
    type: z.string().trim().min(2),
    title: z.string().trim().max(180),
    chamber: z.string().trim().max(180),
    content_markdown: z.string().trim().max(100000),
    status: z.enum(["Borrador", "En revisión", "Firmado", "Publicado"]),
    visibility: z.enum(["public", "internal", "reserved"]),
  })
  .superRefine((value, context) => {
    if (value.status !== "Borrador") {
      if (value.title.length < 3)
        context.addIssue({
          code: "custom",
          path: ["title"],
          message: "El título es obligatorio para revisar o firmar",
        });
      if (value.chamber.length < 2)
        context.addIssue({
          code: "custom",
          path: ["chamber"],
          message: "El despacho es obligatorio para revisar o firmar",
        });
      if (value.content_markdown.length < 20)
        context.addIssue({
          code: "custom",
          path: ["content_markdown"],
          message: "La providencia debe tener al menos 20 caracteres",
        });
    }
  });

export async function createProceeding(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const errorPath =
    parsed.success && parsed.data.id
      ? `/admin/providencias/${parsed.data.id}/editar`
      : "/admin/providencias/nueva";
  if (!parsed.success)
    redirect(
      `/admin/providencias/nueva?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  const { supabase, user } = await requireCaseAccess(
    parsed.data.case_id,
    RESOURCE_ROLES.proceedingsWrite,
  );
  const { data: caseRecord } = await supabase
    .from("cases")
    .select("confidentiality_level,public_visibility,archived_at")
    .eq("id", parsed.data.case_id)
    .maybeSingle();
  if (!caseRecord || caseRecord.archived_at)
    redirect(`${errorPath}?error=El%20expediente%20no%20está%20disponible`);
  if (
    parsed.data.visibility === "public" &&
    (caseRecord.confidentiality_level !== "Público" ||
      !caseRecord.public_visibility)
  )
    redirect(
      `${errorPath}?error=Un%20expediente%20reservado%20no%20puede%20tener%20providencias%20públicas`,
    );
  const now = new Date().toISOString();
  const payload = {
    case_id: parsed.data.case_id,
    type: parsed.data.type,
    title: parsed.data.title || "Providencia sin título",
    chamber: parsed.data.chamber || "Despacho por definir",
    content_markdown: parsed.data.content_markdown || "# Borrador\n",
    status: parsed.data.status,
    visibility: parsed.data.visibility,
    signed_at: ["Firmado", "Publicado"].includes(parsed.data.status)
      ? now
      : null,
    published_at: parsed.data.status === "Publicado" ? now : null,
    signed_by: ["Firmado", "Publicado"].includes(parsed.data.status)
      ? user.id
      : null,
  };
  let result;
  if (parsed.data.id) {
    result = await supabase
      .from("proceedings")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("case_id", parsed.data.case_id)
      .is("archived_at", null)
      .select("id")
      .single();
  } else {
    const { data: number, error: numberError } = await supabase.rpc(
      "generate_providence_number",
      { p_prefix: parsed.data.type.slice(0, 3).toUpperCase() },
    );
    if (numberError || !number)
      redirect(
        `/admin/providencias/nueva?error=${encodeURIComponent(numberError?.message ?? "No fue posible generar el número")}`,
      );
    result = await supabase
      .from("proceedings")
      .insert({
        ...payload,
        providence_number: number,
        judge_id: user.id,
        created_by: user.id,
      })
      .select("id")
      .single();
  }
  const { data, error } = result;
  if (error || !data)
    redirect(
      `${errorPath}?error=${encodeURIComponent(error?.message ?? "No fue posible guardar")}`,
    );
  revalidatePath("/admin/providencias");
  revalidatePath(`/admin/expedientes/${parsed.data.case_id}`);
  redirect(
    `/admin/providencias/${data.id}?success=${encodeURIComponent("Providencia guardada")}`,
  );
}

export async function publishProceeding(formData: FormData) {
  const parsed = z
    .object({ id: dbUuid, case_id: dbUuid })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect("/admin/providencias?error=Providencia%20no%20válida");
  const { supabase, user } = await requireCaseAccess(
    parsed.data.case_id,
    RESOURCE_ROLES.proceedingsWrite,
  );
  const [{ data: proceeding }, { data: caseRecord }] = await Promise.all([
    supabase
      .from("proceedings")
      .select("id,title,chamber,content_markdown,visibility,archived_at")
      .eq("id", parsed.data.id)
      .eq("case_id", parsed.data.case_id)
      .maybeSingle(),
    supabase
      .from("cases")
      .select("confidentiality_level,public_visibility,archived_at")
      .eq("id", parsed.data.case_id)
      .maybeSingle(),
  ]);
  if (
    !proceeding ||
    proceeding.archived_at ||
    !caseRecord ||
    caseRecord.archived_at
  ) {
    redirect(
      `/admin/providencias/${parsed.data.id}?error=${encodeURIComponent("La providencia o su expediente no están disponibles")}`,
    );
  }
  if (
    proceeding.title.trim().length < 3 ||
    proceeding.chamber.trim().length < 2 ||
    proceeding.content_markdown.trim().length < 20
  ) {
    redirect(
      `/admin/providencias/${parsed.data.id}/editar?error=${encodeURIComponent("Complete el título, despacho y contenido antes de publicar")}`,
    );
  }
  if (
    proceeding.visibility === "public" &&
    (caseRecord.confidentiality_level !== "Público" ||
      !caseRecord.public_visibility)
  ) {
    redirect(
      `/admin/providencias/${parsed.data.id}?error=${encodeURIComponent("Una providencia reservada no puede publicarse en el portal público")}`,
    );
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("proceedings")
    .update({
      status: "Publicado",
      published_at: now,
      signed_at: now,
      signed_by: user.id,
    })
    .eq("id", parsed.data.id)
    .eq("case_id", parsed.data.case_id)
    .is("archived_at", null);
  if (error)
    redirect(
      `/admin/providencias/${parsed.data.id}?error=${encodeURIComponent(error.message)}`,
    );
  revalidatePath("/admin/providencias");
  redirect(
    `/admin/providencias/${parsed.data.id}?success=${encodeURIComponent("Providencia publicada")}`,
  );
}
