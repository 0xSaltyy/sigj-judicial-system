import Link from "next/link";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, safeText } from "@/lib/display";

type UserRow = { id: string; full_name: string; email: string | null; institutional_email: string | null; role: string; position_title: string | null; is_active: boolean; is_owner: boolean; last_access_at: string | null; created_at: string; dependencies: { name: string } | { name: string }[] | null };

export default async function UsersPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("profiles").select("id,full_name,email,institutional_email,role,position_title,is_active,is_owner,last_access_at,created_at,dependencies(name)").order("created_at", { ascending: false }).limit(100) : { data: null };
  const rows = (data ?? []) as UserRow[];
  return <><AdminPageHeader title="Usuarios internos" description="Administración exclusiva del OWNER / Attorney General. Las contraseñas nunca se almacenan ni se muestran aquí." action={<Button asChild className="gap-2 bg-[#153b5c]"><Link href="/admin/usuarios/nuevo"><UserPlus className="size-4" /> Crear usuario</Link></Button>} /><div className="mb-5 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><ShieldCheck className="size-5 shrink-0" /><p>No hay registro público. Las cuentas se crean por OWNER, usan Supabase Auth y pueden usar correos ficticios <code>.test</code> sin buzón real.</p></div><div className="overflow-hidden rounded-lg border bg-white">{rows.length === 0 ? <EmptyState title="No hay usuarios internos visibles" description="Cree la primera cuenta desde el formulario OWNER-only." icon={<Users className="size-6" />} /> : <Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Nombre / correo visible</TableHead><TableHead>Rol</TableHead><TableHead>Dependencia</TableHead><TableHead>Estado</TableHead><TableHead>Último acceso</TableHead></TableRow></TableHeader><TableBody>{rows.map((user) => <TableRow key={user.id}><TableCell><p className="text-sm font-semibold text-[#153553]">{user.full_name}</p><p className="mt-1 text-xs text-muted-foreground">{safeText(user.institutional_email || maskOwnerEmail(user.email, user.is_owner), "Correo no publicado")}</p><p className="mt-1 text-[11px] text-slate-500">{safeText(user.position_title, "Cargo sin registrar")}</p></TableCell><TableCell><Badge variant="outline" className="mono-number bg-slate-50 text-[10px]">{user.role}</Badge>{user.is_owner ? <Badge className="ml-2 bg-[#112f4e]">OWNER</Badge> : null}</TableCell><TableCell className="text-xs">{Array.isArray(user.dependencies) ? user.dependencies[0]?.name : user.dependencies?.name || "Sin asignar"}</TableCell><TableCell><Badge className={user.is_active ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}>{user.is_active ? "Activo" : "Suspendido"}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{formatDateTime(user.last_access_at)}</TableCell></TableRow>)}</TableBody></Table>}</div></>;
}

function maskOwnerEmail(email: string | null, isOwner: boolean) {
  if (!email) return null;
  if (!isOwner) return email;
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}••••••••@${domain}`;
}
