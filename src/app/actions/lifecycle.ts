"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
