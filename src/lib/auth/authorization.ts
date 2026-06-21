import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/user-management";

export type AuthenticatedProfile = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  dependency_id: string | null;
  institution_id: string | null;
  supervisor_id: string | null;
  avatar_path: string | null;
  default_signature_path: string | null;
  position_title: string | null;
  is_active: boolean;
  is_owner: boolean;
};

export async function getAuthenticatedProfile() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,dependency_id,institution_id,supervisor_id,avatar_path,default_signature_path,position_title,is_active,is_owner")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  return { supabase, user, profile: profile as AuthenticatedProfile };
}

export async function requireInternalUser() {
  const session = await getAuthenticatedProfile();
  if (!session) redirect("/login?error=Acceso%20institucional%20requerido");
  if (!session.profile.is_active || session.profile.role === "CONSULTA_PUBLICA") redirect("/no-autorizado");
  return session;
}

export async function requireOwner() {
  const session = await requireInternalUser();
  if (!session.profile.is_owner || session.profile.role !== "SUPER_ADMIN") redirect("/no-autorizado");
  return session;
}
