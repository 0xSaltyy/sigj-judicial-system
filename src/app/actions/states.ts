"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, RESOURCE_ROLES } from "@/lib/auth/permissions";

export async function createJudicialState(formData: FormData) {
  const parsed = z.object({ dependency_id: z.string().uuid(), state_date: z.string().min(1), case_id: z.string().uuid(), case_action_id: z.string().uuid().optional().or(z.literal("")), description: z.string().trim().min(5), status: z.enum(["Borrador", "Publicado"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/estados/nuevo?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { supabase, user } = await requirePermission(RESOURCE_ROLES.secretarialWrite);
  const { data: dependency } = await supabase.from("dependencies").select("code").eq("id", parsed.data.dependency_id).maybeSingle();
  if (!dependency) redirect("/admin/estados/nuevo?error=Dependencia%20no%20válida");
  const { data: number, error: numberError } = await supabase.rpc("generate_state_number", { p_prefix: `EST-${dependency.code}` });
  if (numberError || !number) redirect(`/admin/estados/nuevo?error=${encodeURIComponent(numberError?.message ?? "No fue posible numerar el estado")}`);
  const { data: state, error } = await supabase.from("judicial_states").insert({ state_number: number, dependency_id: parsed.data.dependency_id, state_date: parsed.data.state_date, status: parsed.data.status, created_by: user.id, published_at: parsed.data.status === "Publicado" ? new Date().toISOString() : null }).select("id").single();
  if (error || !state) redirect(`/admin/estados/nuevo?error=${encodeURIComponent(error?.message ?? "No fue posible crear el estado")}`);
  const { error: itemError } = await supabase.from("judicial_state_items").insert({ judicial_state_id: state.id, case_id: parsed.data.case_id, case_action_id: parsed.data.case_action_id || null, description: parsed.data.description });
  if (itemError) redirect(`/admin/estados?error=${encodeURIComponent(itemError.message)}`);
  revalidatePath("/admin/estados");
  redirect(`/admin/estados?success=${encodeURIComponent("Estado judicial creado")}`);
}
