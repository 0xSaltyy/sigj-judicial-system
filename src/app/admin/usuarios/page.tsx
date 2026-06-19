import Link from "next/link";
import { ShieldCheck, UserPlus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const users = [
  ["Presidencia del Tribunal", "presidencia@sigj.demo", "PRESIDENCIA_TRIBUNAL", "Tribunal Superior", "Hoy, 08:42"],
  ["Magistratura Sala Penal", "mag.penal@sigj.demo", "MAGISTRADO", "Sala Penal", "Ayer, 16:18"],
  ["Magistratura Sala Civil", "mag.civil@sigj.demo", "MAGISTRADO", "Sala Civil", "18 jun, 11:30"],
  ["Juzgado Primero Civil", "juez.civil1@sigj.demo", "JUEZ_CIRCUITO", "Juzgado Primero Civil", "17 jun, 15:08"],
  ["Secretaría General", "secretaria@sigj.demo", "SECRETARIA", "Secretaría General", "Hoy, 09:01"],
  ["Usuario de Consulta", "consulta@sigj.demo", "CONSULTA", "Archivo Judicial", "12 jun, 10:22"],
];
export default function UsersPage() { return <><AdminPageHeader title="Usuarios internos" description="Administración exclusiva de SUPER_ADMIN. Las contraseñas nunca se almacenan ni se muestran aquí." action={<Button asChild className="gap-2 bg-[#153b5c]"><Link href="/admin/usuarios/nuevo"><UserPlus className="size-4" /> Invitar usuario</Link></Button>} /><div className="mb-5 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><ShieldCheck className="size-5 shrink-0" /><p>Las cuentas se crean mediante invitación de Supabase Auth. Esta vista administra únicamente perfiles, roles y dependencias.</p></div><div className="overflow-hidden rounded-lg border bg-white"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Nombre / correo</TableHead><TableHead>Rol</TableHead><TableHead>Dependencia</TableHead><TableHead>Estado</TableHead><TableHead>Último acceso</TableHead></TableRow></TableHeader><TableBody>{users.map(([name,email,role,dependency,last]) => <TableRow key={email}><TableCell><p className="text-sm font-semibold text-[#153553]">{name}</p><p className="mt-1 text-xs text-muted-foreground">{email}</p></TableCell><TableCell><Badge variant="outline" className="mono-number bg-slate-50 text-[10px]">{role}</Badge></TableCell><TableCell className="text-xs">{dependency}</TableCell><TableCell><Badge className="bg-emerald-50 text-emerald-800">Activo</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{last}</TableCell></TableRow>)}</TableBody></Table></div></>; }
