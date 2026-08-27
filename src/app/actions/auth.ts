"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({ email: z.string().email("Correo no válido"), password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres") });

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/login?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await createClient();
  if (!supabase) redirect(`/login?error=${encodeURIComponent("Supabase no está configurado")}`);
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(`/login?error=${encodeURIComponent("Credenciales inválidas o usuario inactivo")}`);
  const { data: profile } = await supabase.from("profiles").select("is_active,must_change_password").eq("id", data.user.id).single();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("La cuenta está suspendida. Solicite revisión al OWNER.")}`);
  }
  if (data.user?.user_metadata?.force_password_change || profile.must_change_password) redirect("/actualizar-password?required=1");
  redirect("/admin/dashboard");
}

export async function logout() { const supabase = await createClient(); if (supabase) await supabase.auth.signOut(); redirect("/login"); }

export async function recoverPassword(formData: FormData) {
  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) redirect("/recuperar-password?error=Correo%20no%20válido");
  redirect("/recuperar-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const parsed = z.string().min(8).safeParse(formData.get("password"));
  if (!parsed.success) redirect("/actualizar-password?error=Use%20al%20menos%208%20caracteres");
  const supabase = await createClient(); if (!supabase) redirect("/actualizar-password?updated=1");
  const { error } = await supabase.auth.updateUser({ password: parsed.data, data: { force_password_change: false } });
  if (error) redirect(`/actualizar-password?error=${encodeURIComponent(error.message)}`);
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ must_change_password: false, password_reset_required_at: null }).eq("id", user.id);
  redirect("/login?updated=1");
}
