"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({ email: z.string().email("Correo no válido"), password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres") });

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/login?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=El%20acceso%20interno%20requiere%20configurar%20Supabase");
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(`/login?error=${encodeURIComponent("Credenciales inválidas o usuario inactivo")}`);
  redirect("/admin/dashboard");
}

export async function logout() { const supabase = await createClient(); if (supabase) await supabase.auth.signOut(); redirect("/login"); }

export async function recoverPassword(formData: FormData) {
  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) redirect("/recuperar-password?error=Correo%20no%20válido");
  const supabase = await createClient();
  if (supabase) await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/actualizar-password` });
  redirect("/recuperar-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const parsed = z.string().min(8).safeParse(formData.get("password"));
  if (!parsed.success) redirect("/actualizar-password?error=Use%20al%20menos%208%20caracteres");
  const supabase = await createClient();
  if (!supabase) redirect("/actualizar-password?error=Supabase%20no%20est%C3%A1%20configurado");
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) redirect(`/actualizar-password?error=${encodeURIComponent(error.message)}`);
  redirect("/login?updated=1");
}
