"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const inviteSchema = z.object({ email: z.string().email(), full_name: z.string().min(3), role: z.enum(["SUPER_ADMIN","PRESIDENCIA_TRIBUNAL","MAGISTRADO","JUEZ_CIRCUITO","SECRETARIA","RELATORIA","GOBERNACION","CONSULTA"]), dependency_id: z.string().uuid().optional().or(z.literal("")), position_title: z.string().max(120).optional() });

export async function inviteUser(formData: FormData) {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/usuarios/nuevo?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const client = await createClient(); const admin = createAdminClient();
  if (!client || !admin) redirect("/admin/usuarios/nuevo?error=Configure%20Supabase%20y%20la%20service%20role");
  const { data: { user } } = await client.auth.getUser(); if (!user) redirect("/login");
  const { data: actor } = await client.from("profiles").select("role,is_active").eq("id", user.id).single();
  if (actor?.role !== "SUPER_ADMIN" || !actor.is_active) redirect("/no-autorizado");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { data: { full_name: parsed.data.full_name }, redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/actualizar-password` });
  if (error || !data.user) redirect(`/admin/usuarios/nuevo?error=${encodeURIComponent(error?.message ?? "No fue posible invitar")}`);
  const { error: profileError } = await admin.from("profiles").update({ full_name: parsed.data.full_name, role: parsed.data.role, dependency_id: parsed.data.dependency_id || null, position_title: parsed.data.position_title || null }).eq("id", data.user.id);
  if (profileError) redirect(`/admin/usuarios/nuevo?error=${encodeURIComponent(profileError.message)}`);
  redirect("/admin/usuarios?invited=1");
}
