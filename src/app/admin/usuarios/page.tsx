import Link from "next/link";
import { ShieldCheck, UserPlus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const users = [
  ["Pam Bondi", "pambondi@department.test", "OWNER", "Office of the Attorney General", "Hoy, 08:42"],
  ["Deputy Attorney General", "deputy@department.test", "DEPUTY_ATTORNEY_GENERAL", "Office of the Attorney General", "Ayer, 16:18"],
  ["Fiscal Criminal", "fiscal@department.test", "FISCAL", "Criminal Division", "18 jun, 11:30"],
  ["Jueza Civil", "judge.civil@department.test", "JUEZ", "Civil Division", "17 jun, 15:08"],
  ["Clerk de Docket", "clerk@department.test", "SECRETARIA", "Technology & Records Unit", "Hoy, 09:01"],
  ["Investigador autorizado", "investigator@department.test", "INVESTIGADOR", "Warrants & Orders Unit", "12 jun, 10:22"],
];
export default function UsersPage() { return <><AdminPageHeader title="Usuarios internos" description="Administración exclusiva del OWNER / Attorney General. Las contraseñas nunca se almacenan ni se muestran aquí." action={<Button asChild className="gap-2 bg-[#153b5c]"><Link href="/admin/usuarios/nuevo"><UserPlus className="size-4" /> Crear usuario</Link></Button>} /><div className="mb-5 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><ShieldCheck className="size-5 shrink-0" /><p>No hay registro público. Las cuentas se crean por OWNER, usan Supabase Auth y deben cambiar contraseña temporal en el primer inicio.</p></div><div className="overflow-hidden rounded-lg border bg-white"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Nombre / correo opcional</TableHead><TableHead>Rol</TableHead><TableHead>Dependencia</TableHead><TableHead>Estado</TableHead><TableHead>Último acceso</TableHead></TableRow></TableHeader><TableBody>{users.map(([name,email,role,dependency,last]) => <TableRow key={email}><TableCell><p className="text-sm font-semibold text-[#153553]">{name}</p><p className="mt-1 text-xs text-muted-foreground">{email}</p></TableCell><TableCell><Badge variant="outline" className="mono-number bg-slate-50 text-[10px]">{role}</Badge></TableCell><TableCell className="text-xs">{dependency}</TableCell><TableCell><Badge className="bg-emerald-50 text-emerald-800">Activo</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{last}</TableCell></TableRow>)}</TableBody></Table></div></>; }
