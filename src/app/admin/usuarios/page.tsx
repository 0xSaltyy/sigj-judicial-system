import Link from "next/link";
import { KeyRound, LockKeyhole, ShieldCheck, UserPlus } from "lucide-react";
import { sendPasswordSetup, updateManagedUser } from "@/app/actions/users";
import { AdminPageHeader } from "@/components/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/authorization";
import { APP_ROLES, ROLE_DESCRIPTIONS, maskEmail, type AppRole } from "@/lib/user-management";

type Query = { error?: string; success?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [{ supabase }, query] = await Promise.all([requireOwner(), searchParams]);
  const [{ data: profiles, error }, { data: dependencies }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,role,dependency_id,position_title,is_active,is_owner,last_access_at,created_at").order("is_owner", { ascending: false }).order("full_name"),
    supabase.from("dependencies").select("id,name").eq("is_active", true).order("name"),
  ]);
  const institutionNames = new Map((dependencies ?? []).map((item) => [item.id, item.name]));

  return <>
    <AdminPageHeader title="Usuarios internos" description="Administración exclusiva del propietario. Cada alta, cambio de acceso y recuperación queda auditada." action={<div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/roles">Roles y permisos</Link></Button><Button asChild className="gap-2 bg-[#153b5c]"><Link href="/admin/usuarios/nuevo"><UserPlus className="size-4" /> Invitar usuario</Link></Button></div>} />
    {query.error && <Message tone="error">{query.error}</Message>}
    {query.success && <Message tone="success">{query.success}</Message>}
    {error && <Message tone="error">No fue posible cargar los usuarios: {error.message}</Message>}
    <div className="mb-5 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><ShieldCheck className="size-5 shrink-0" /><p>El correo solo se revela al propietario autenticado. Ningún administrador institucional puede listar cuentas ni modificar la cuenta propietaria.</p></div>
    <div className="overflow-x-auto rounded-lg border bg-white">
      <Table>
        <TableHeader><TableRow className="bg-slate-50"><TableHead>Identidad privada</TableHead><TableHead>Rol e institución</TableHead><TableHead>Estado</TableHead><TableHead>Gestión</TableHead></TableRow></TableHeader>
        <TableBody>{(profiles ?? []).map((item) => {
          const role = item.role as AppRole;
          const email = item.is_owner ? "Correo protegido" : maskEmail(item.email);
          return <TableRow key={item.id}>
            <TableCell className="min-w-64 align-top"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-[#153553]">{item.full_name}</p>{item.is_owner && <Badge className="gap-1 bg-amber-50 text-amber-900"><LockKeyhole className="size-3" /> Protegida</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{email}</p><p className="mt-2 text-xs text-muted-foreground">{item.position_title || "Sin cargo registrado"}</p></TableCell>
            <TableCell className="min-w-72 align-top"><Badge variant="outline" className="mono-number bg-slate-50 text-[10px]">{role}</Badge><p className="mt-2 text-xs font-medium text-slate-700">{ROLE_DESCRIPTIONS[role]?.label ?? role}</p><p className="mt-1 text-xs text-muted-foreground">{item.dependency_id ? institutionNames.get(item.dependency_id) ?? "Institución no disponible" : "Sin institución asignada"}</p></TableCell>
            <TableCell className="align-top"><Badge className={item.is_active ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}>{item.is_active ? "Activo" : "Inactivo"}</Badge><p className="mt-2 whitespace-nowrap text-xs text-muted-foreground">Último acceso: {item.last_access_at ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.last_access_at)) : "Sin registro"}</p></TableCell>
            <TableCell className="min-w-[390px] align-top">{item.is_owner ? <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">Esta cuenta no puede eliminarse, desactivarse, degradarse ni reasignarse. La protección también se aplica en la base de datos.</div> : <details><summary className="cursor-pointer text-xs font-semibold text-[#153b5c]">Editar acceso</summary><form action={updateManagedUser} className="mt-3 grid gap-3 rounded border bg-slate-50 p-3 sm:grid-cols-2"><input type="hidden" name="target_id" value={item.id} /><Input name="full_name" defaultValue={item.full_name} aria-label="Nombre completo" required /><Input name="position_title" defaultValue={item.position_title ?? ""} placeholder="Cargo" aria-label="Cargo" /><select name="role" defaultValue={role} className="h-9 rounded-md border bg-white px-3 text-xs" aria-label="Rol">{APP_ROLES.map((value) => <option key={value}>{value}</option>)}</select><select name="dependency_id" defaultValue={item.dependency_id ?? ""} className="h-9 rounded-md border bg-white px-3 text-xs" aria-label="Institución"><option value="">Sin institución</option>{(dependencies ?? []).map((dependency) => <option key={dependency.id} value={dependency.id}>{dependency.name}</option>)}</select><select name="is_active" defaultValue={String(item.is_active)} className="h-9 rounded-md border bg-white px-3 text-xs" aria-label="Estado"><option value="true">Activo</option><option value="false">Inactivo</option></select><Button type="submit" size="sm" className="bg-[#153b5c]">Guardar cambio</Button></form></details>}<form action={sendPasswordSetup} className="mt-3"><input type="hidden" name="target_id" value={item.id} /><Button type="submit" variant="outline" size="sm" className="gap-2"><KeyRound className="size-3.5" /> Enviar configuración de contraseña</Button></form></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
      {!profiles?.length && !error && <p className="p-8 text-center text-sm text-muted-foreground">No hay perfiles internos registrados.</p>}
    </div>
  </>;
}

function Message({ children, tone }: { children: React.ReactNode; tone: "error" | "success" }) {
  return <p className={`mb-5 rounded border p-4 text-sm ${tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{children}</p>;
}
