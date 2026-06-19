"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaseAccess } from "@/lib/auth/permissions";
import { APP_ROLES, type AppRole } from "@/lib/user-management";
import { dbUuid } from "@/lib/validation";

const shareRoles: AppRole[] = [
  "SUPER_ADMIN",
  "ADMIN_INSTITUCIONAL",
  "MAGISTRADO_CORTE_SUPREMA",
  "MAGISTRADO_TRIBUNAL",
  "JUEZ_CIRCUITO",
  "JUEZ_MUNICIPAL",
  "SECRETARIO_GENERAL",
  "SECRETARIO_DESPACHO",
  "OFICIAL_MAYOR",
  "ARCHIVO",
];
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
  const { supabase, user } = await requireCaseAccess(
    parsed.data.case_id,
    shareRoles,
  );

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
      redirect(`${parsed.data.destination}?error=Usuario%20destino%20no%20válido`);
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
      redirect(`${parsed.data.destination}?error=Dependencia%20destino%20no%20válida`);
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
