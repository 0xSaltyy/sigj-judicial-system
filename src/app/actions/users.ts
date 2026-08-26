"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const inviteSchema = z.object({
  email: z.string().email(),
  institutional_email: z.string().email().optional().or(z.literal("")),
  temporary_password: z.string().min(12, "La contraseña temporal debe tener al menos 12 caracteres"),
  full_name: z.string().min(3),
  role: z.enum(["SUPER_ADMIN","ADMIN_INSTITUCIONAL","MAGISTRADO_CORTE_SUPREMA","MAGISTRADO_TRIBUNAL","JUEZ_CIRCUITO","JUEZ_MUNICIPAL","SECRETARIO_GENERAL","SECRETARIO_DESPACHO","OFICIAL_MAYOR","AUXILIAR","RADICADOR","REPARTO","ARCHIVO","GOBERNACION_COMUNICACIONES","CONSULTA_PUBLICA","OWNER","ATTORNEY_GENERAL","DEPUTY_ATTORNEY_GENERAL","JUEZ","FISCAL","ABOGADO","INVESTIGADOR","ADMINISTRADOR","PERSONAL_AUTORIZADO"]),
  dependency_id: z.string().uuid().optional().or(z.literal("")),
  position_title: z.string().max(120).optional()
});

export async function inviteUser(formData: FormData) {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/usuarios/nuevo?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const client = await createClient(); const admin = createAdminClient();
  if (!client || !admin) redirect("/admin/usuarios/nuevo?error=Configure%20Supabase%20y%20la%20service%20role");
  const { data: { user } } = await client.auth.getUser(); if (!user) redirect("/login");
  const { data: actor } = await client.from("profiles").select("role,is_active").eq("id", user.id).single();
  if (!actor?.is_active || !["SUPER_ADMIN", "OWNER", "ATTORNEY_GENERAL"].includes(String(actor.role))) redirect("/no-autorizado");
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.temporary_password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      force_password_change: true,
      auth_email: parsed.data.email,
      institutional_email: parsed.data.institutional_email || null,
    },
  });
  if (error || !data.user) redirect(`/admin/usuarios/nuevo?error=${encodeURIComponent(error?.message ?? "No fue posible crear el usuario")}`);
  const { error: profileError } = await admin.from("profiles").update({
    full_name: parsed.data.full_name,
    email: parsed.data.institutional_email || parsed.data.email,
    role: parsed.data.role,
    dependency_id: parsed.data.dependency_id || null,
    position_title: parsed.data.position_title || null,
    is_active: true,
  }).eq("id", data.user.id);
  if (profileError) redirect(`/admin/usuarios/nuevo?error=${encodeURIComponent(profileError.message)}`);
  redirect("/admin/usuarios?created=1");
}
