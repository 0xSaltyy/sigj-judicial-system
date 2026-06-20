"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enforcePermission, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { dbUuid } from "@/lib/validation";

export async function createJudicialState(formData: FormData) {
  const parsed = z
    .object({
      dependency_id: dbUuid,
      state_date: z.string().min(1),
      case_id: dbUuid.optional().or(z.literal("")),
      case_action_id: dbUuid.optional().or(z.literal("")),
      description: z.string().trim().max(2000).optional(),
      status: z.enum(["Borrador", "Publicado"]),
    })
    .superRefine((value, context) => {
      if (
        value.status === "Publicado" &&
        (!value.case_id || !value.description || value.description.length < 5)
      )
        context.addIssue({
          code: "custom",
          path: ["description"],
          message: "Para publicar debe agregar un expediente y una descripción",
        });
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(
      `/admin/estados/nuevo?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  const session = await requirePermission(PERMISSIONS.statesCreate);
  if (parsed.data.case_id) {
    await enforcePermission(session, PERMISSIONS.statesEdit);
  }
  if (parsed.data.status === "Publicado") {
    await enforcePermission(session, PERMISSIONS.statesPublish);
  }
  const { supabase, user } = session;
  if (parsed.data.status === "Publicado" && parsed.data.case_id) {
    const { data: caseRecord } = await supabase
      .from("cases")
      .select("public_visibility,confidentiality_level,archived_at")
      .eq("id", parsed.data.case_id)
      .maybeSingle();
    if (
      !caseRecord ||
      caseRecord.archived_at ||
      !caseRecord.public_visibility ||
      caseRecord.confidentiality_level !== "Público"
    ) {
      redirect(
        `/admin/estados/nuevo?error=${encodeURIComponent("Solo los expedientes públicos y activos pueden incluirse en un estado publicado")}`,
      );
    }
  }
  const { data: dependency } = await supabase
    .from("dependencies")
    .select("code")
    .eq("id", parsed.data.dependency_id)
    .maybeSingle();
  if (!dependency)
    redirect("/admin/estados/nuevo?error=Dependencia%20no%20válida");
  const { data: number, error: numberError } = await supabase.rpc(
    "generate_state_number",
    { p_prefix: `EST-${dependency.code}` },
  );
  if (numberError || !number)
    redirect(
      `/admin/estados/nuevo?error=${encodeURIComponent(numberError?.message ?? "No fue posible numerar el estado")}`,
    );
  const { data: state, error } = await supabase
    .from("judicial_states")
    .insert({
      state_number: number,
      dependency_id: parsed.data.dependency_id,
      state_date: parsed.data.state_date,
      status: parsed.data.status,
      created_by: user.id,
      published_at:
        parsed.data.status === "Publicado" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !state)
    redirect(
      `/admin/estados/nuevo?error=${encodeURIComponent(error?.message ?? "No fue posible crear el estado")}`,
    );
  if (parsed.data.case_id && parsed.data.description) {
    const { error: itemError } = await supabase
      .from("judicial_state_items")
      .insert({
        judicial_state_id: state.id,
        case_id: parsed.data.case_id,
        case_action_id: parsed.data.case_action_id || null,
        description: parsed.data.description,
      });
    if (itemError)
      redirect(`/admin/estados?error=${encodeURIComponent(itemError.message)}`);
  }
  revalidatePath("/admin/estados");
  redirect(
    `/admin/estados?success=${encodeURIComponent("Estado judicial creado")}`,
  );
}

export async function addJudicialStateItem(formData: FormData) {
  const parsed = z
    .object({
      state_id: dbUuid,
      case_id: dbUuid,
      description: z.string().trim().min(5).max(2000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(
      `/admin/estados?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  const { supabase } = await requirePermission(PERMISSIONS.statesEdit);
  const { data: state } = await supabase
    .from("judicial_states")
    .select("id,status,archived_at")
    .eq("id", parsed.data.state_id)
    .maybeSingle();
  if (!state || state.archived_at || state.status === "Publicado")
    redirect(
      `/admin/estados/${parsed.data.state_id}?error=El%20estado%20no%20admite%20nuevas%20actuaciones`,
    );
  const { error } = await supabase.from("judicial_state_items").insert({
    judicial_state_id: state.id,
    case_id: parsed.data.case_id,
    description: parsed.data.description,
  });
  if (error)
    redirect(
      `/admin/estados/${state.id}?error=${encodeURIComponent(error.message)}`,
    );
  revalidatePath(`/admin/estados/${state.id}`);
  redirect(
    `/admin/estados/${state.id}?success=${encodeURIComponent("Actuación agregada al estado")}`,
  );
}

export async function publishJudicialState(formData: FormData) {
  const stateId = dbUuid.safeParse(formData.get("state_id"));
  if (!stateId.success) redirect("/admin/estados?error=Estado%20no%20válido");
  const { supabase } = await requirePermission(PERMISSIONS.statesPublish);
  const { data: items } = await supabase
    .from("judicial_state_items")
    .select(
      "id,case:cases(public_visibility,confidentiality_level,archived_at)",
    )
    .eq("judicial_state_id", stateId.data);
  if (!items?.length)
    redirect(
      `/admin/estados/${stateId.data}?error=Agregue%20al%20menos%20una%20actuación%20antes%20de%20publicar`,
    );
  const hasNonPublicCase = items.some((item) => {
    const caseRecord = Array.isArray(item.case) ? item.case[0] : item.case;
    return (
      !caseRecord ||
      caseRecord.archived_at ||
      !caseRecord.public_visibility ||
      caseRecord.confidentiality_level !== "Público"
    );
  });
  if (hasNonPublicCase) {
    redirect(
      `/admin/estados/${stateId.data}?error=${encodeURIComponent("Retire los expedientes reservados o archivados antes de publicar")}`,
    );
  }
  const { error } = await supabase
    .from("judicial_states")
    .update({ status: "Publicado", published_at: new Date().toISOString() })
    .eq("id", stateId.data)
    .is("archived_at", null);
  if (error)
    redirect(
      `/admin/estados/${stateId.data}?error=${encodeURIComponent(error.message)}`,
    );
  revalidatePath("/admin/estados");
  revalidatePath("/estados");
  redirect(
    `/admin/estados/${stateId.data}?success=${encodeURIComponent("Estado publicado")}`,
  );
}
