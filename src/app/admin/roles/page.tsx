import { ShieldCheck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/authorization";
import { APP_ROLES, ROLE_DESCRIPTIONS } from "@/lib/user-management";

export default async function RolesPage() {
  await requireOwner();
  return <>
    <AdminPageHeader title="Roles y permisos" description="Matriz de alcance institucional. Los permisos efectivos también se aplican mediante RLS en Supabase." />
    <div className="mb-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><ShieldCheck className="size-5 shrink-0" /><p>`SUPER_ADMIN` no equivale automáticamente a propietario: solo el perfil marcado como propietario puede administrar cuentas o modificar accesos.</p></div>
    <div className="grid gap-4 lg:grid-cols-2">{APP_ROLES.map((role) => { const detail = ROLE_DESCRIPTIONS[role]; return <Card key={role}><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-base text-[#153553]">{detail.label}</CardTitle><Badge variant="outline" className="mono-number text-[10px]">{role}</Badge></div></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{detail.scope}</p><ul className="mt-4 grid gap-2 text-xs text-slate-700">{detail.permissions.map((permission) => <li key={permission} className="rounded border bg-slate-50 px-3 py-2">{permission}</li>)}</ul></CardContent></Card>; })}</div>
  </>;
}
