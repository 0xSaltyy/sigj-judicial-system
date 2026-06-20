import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { UserPermissionsEditor } from "@/components/user-permissions-editor";
import { requireOwner } from "@/lib/auth/authorization";
import { ROLE_DESCRIPTIONS, type AppRole } from "@/lib/user-management";

type Query = { error?: string; success?: string };

export default async function UserPermissionsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query, { supabase }] = await Promise.all([params, searchParams, requireOwner()]);
  const [{ data: profile }, { data: overrides }, { data: roleRules }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,role,is_active,is_owner").eq("id", id).maybeSingle(),
    supabase.from("user_permission_overrides").select("resource,action,effect,reason").eq("user_id", id),
    supabase.from("role_permission_rules").select("role,resource,action,allowed"),
  ]);
  if (!profile) notFound();
  const role = profile.role as AppRole;

  return <>
    <AdminPageHeader title={`Permisos personalizados · ${profile.full_name}`} breadcrumbLabel="Usuarios internos" description={`${ROLE_DESCRIPTIONS[role].label} · ${profile.is_active ? "Cuenta activa" : "Cuenta inactiva"}`} action={<Button asChild variant="outline"><Link href="/admin/usuarios"><ArrowLeft className="size-4" /> Usuarios</Link></Button>} />
    <ActionMessage error={query.error} success={query.success} />
    {profile.is_owner ? <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><LockKeyhole className="size-5 shrink-0" /><p>La cuenta propietaria protegida no admite concesiones ni denegaciones individuales. Su identidad visible permanece como <strong>{profile.full_name}</strong>.</p></div> :
    <UserPermissionsEditor userId={profile.id} role={role} overrides={(overrides ?? []) as { resource: string; action: string; effect: "allow" | "deny"; reason: string | null }[]} roleRules={(roleRules ?? []) as { role: AppRole; resource: string; action: string; allowed: boolean }[]} />}
  </>;
}
