"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateApplicationReview(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const public_message = String(formData.get("public_message") || "");
  const internal_notes = String(formData.get("internal_notes") || "");
  const supabase = await createClient();
  if (!supabase) redirect("/admin/postulaciones?error=Supabase%20no%20configurado");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("roleplay_applications").update({ status, public_message, internal_notes }).eq("id", id);
  if (error) redirect(`/admin/postulaciones?error=${encodeURIComponent(error.message)}`);
  await supabase.from("audit_logs").insert({ user_id: user.id, action: "UPDATE", table_name: "roleplay_applications", record_id: id, description: "Actualización de postulación", metadata: { status } });
  redirect("/admin/postulaciones?updated=1");
}
