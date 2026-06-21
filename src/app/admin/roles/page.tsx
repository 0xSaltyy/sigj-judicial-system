import { ShieldCheck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { RolePermissionsEditor } from "@/components/role-permissions-editor";
import { requireOwner } from "@/lib/auth/authorization";
import type { AppRole } from "@/lib/user-management";

type Query = { error?: string; success?: string };

export default async function RolesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [{ supabase }, query] = await Promise.all([requireOwner(), searchParams]);
  const { data: rules, error } = await supabase
    .from("role_permission_rules")
    .select("role,resource,action,allowed")
    .order("role")
    .order("resource")
    .order("action");

  return <>
    <AdminPageHeader title="Roles y permisos" description="Matriz efectiva de acceso. Cada cambio se valida en el servidor, se refuerza con RLS y queda auditado." />
    <ActionMessage error={query.error ?? (error ? "No fue posible cargar la matriz de permisos." : undefined)} success={query.success} />
    <div className="mb-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><ShieldCheck className="size-5 shrink-0" /><p>La cuenta propietaria permanece protegida. Sus permisos de administración no pueden retirarse desde esta matriz y el correo continúa oculto.</p></div>
    <RolePermissionsEditor rules={(rules ?? []) as { role: AppRole; resource: string; action: string; allowed: boolean }[]} />
  </>;
}
