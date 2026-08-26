"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const applicationSchema = z.object({
  application_type: z.enum(["juez", "abogado", "investigador", "personal"]),
  applicant_name: z.string().min(3, "Ingrese el nombre del postulante"),
  contact_info: z.string().max(300).optional(),
  experience: z.string().min(10, "Describa la experiencia"),
  education: z.string().max(1500).optional(),
  statement: z.string().min(20, "Incluya una declaración personal"),
});

const warrantSchema = z.object({
  warrant_number: z.string().min(6),
  warrant_type: z.string().min(3),
  case_id: z.string().uuid().optional().or(z.literal("")),
  target_description: z.string().min(5),
  reason: z.string().min(10),
  legal_basis: z.string().min(10),
  expires_at: z.string().optional(),
  confidentiality: z.enum(["public", "internal", "reserved", "confidential"]),
  observations: z.string().optional(),
});

const warrantRoles = new Set([
  "SUPER_ADMIN",
  "OWNER",
  "ATTORNEY_GENERAL",
  "DEPUTY_ATTORNEY_GENERAL",
  "JUEZ",
  "FISCAL",
  "INVESTIGADOR",
  "ADMINISTRADOR",
  "PERSONAL_AUTORIZADO",
]);

export async function submitRoleplayApplication(formData: FormData) {
  const parsed = applicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/postulaciones?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await createClient();
  if (!supabase) redirect("/postulaciones?submitted=demo");
  const { error } = await supabase.from("roleplay_applications").insert({
    ...parsed.data,
    answers: {},
    status: "Recibida",
  });
  if (error) redirect(`/postulaciones?error=${encodeURIComponent("No fue posible recibir la postulación")}`);
  redirect("/postulaciones?submitted=1");
}

export async function createRoleplayWarrant(formData: FormData) {
  const parsed = warrantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/warrants?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await createClient();
  if (!supabase) redirect("/admin/warrants?created=demo");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await supabase.from("profiles").select("id,role,is_active").eq("id", user.id).single();
  if (!actor?.is_active || !warrantRoles.has(String(actor.role))) redirect("/no-autorizado");
  const { error } = await supabase.from("roleplay_warrants").insert({
    ...parsed.data,
    case_id: parsed.data.case_id || null,
    expires_at: parsed.data.expires_at || null,
    requested_by: actor.id,
    created_by: user.id,
    status: "Pendiente",
  });
  if (error) redirect(`/admin/warrants?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/warrants?created=1");
}
