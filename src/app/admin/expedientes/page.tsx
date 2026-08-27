import Link from "next/link";
import { Eye, Filter, FolderKanban, Plus } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseStatusBadge, ConfidentialityBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

export const metadata = { title: "Expedientes" };

export default async function CasesPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("cases").select("id,internal_number,judicial_number,title,claimant_name,defendant_name,chamber,status,confidentiality_level,filed_at,archived_at").order("created_at", { ascending: false }).limit(50) : { data: null };
  const rows = data ?? [];
  return <><AdminPageHeader title="Expedientes judiciales" description="Radicación, asignación, edición, archivo y eliminación bajo permisos/RLS." action={<Button asChild className="gap-2 bg-[#153b5c]"><Link href="/admin/expedientes/nuevo"><Plus className="size-4" /> Nuevo expediente</Link></Button>} /><div className="rounded-lg border bg-white"><div className="grid gap-3 border-b p-4 md:grid-cols-[1.5fr_repeat(3,1fr)_auto]"><Input placeholder="Buscar por radicado o parte…" /><FilterSelect placeholder="Sala" values={["Sala Penal", "Sala Civil", "Sala Laboral", "Sala Administrativa"]} /><FilterSelect placeholder="Estado" values={["Radicado", "En reparto", "Pruebas decretadas", "Audiencia programada", "Archivado"]} /><FilterSelect placeholder="Despacho" values={["Tribunal Superior", "Juzgado de Circuito"]} /><Button variant="outline" className="gap-2"><Filter className="size-4" /> Filtrar</Button></div>{rows.length === 0 ? <EmptyState title="No hay expedientes registrados" description="Cree el primer expediente para iniciar la operación del sistema." icon={<FolderKanban className="size-6" />} /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Radicado</TableHead><TableHead>Proceso / partes</TableHead><TableHead>Sala</TableHead><TableHead>Estado</TableHead><TableHead>Reserva</TableHead><TableHead>Radicación</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.id}><TableCell><Link href={`/admin/expedientes/${item.id}`} className="mono-number text-xs font-semibold text-[#153b5c] hover:underline">{item.internal_number}</Link><p className="mono-number mt-1 text-[10px] text-muted-foreground">{item.judicial_number}</p></TableCell><TableCell className="max-w-[280px]"><p className="truncate text-sm font-medium text-[#153553]">{item.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{item.claimant_name} / {item.defendant_name}</p></TableCell><TableCell className="text-xs">{item.chamber}</TableCell><TableCell><CaseStatusBadge status={item.status} /></TableCell><TableCell><ConfidentialityBadge level={item.confidentiality_level} /></TableCell><TableCell className="text-xs">{formatDate(item.filed_at)}</TableCell><TableCell><div className="flex flex-wrap gap-2"><Button asChild variant="ghost" size="icon"><Link href={`/admin/expedientes/${item.id}`} aria-label={`Ver ${item.internal_number}`}><Eye className="size-4" /></Link></Button><LifecycleActions resource="cases" id={item.id} archived={Boolean(item.archived_at)} compact /></div></TableCell></TableRow>)}</TableBody></Table></div>}</div></>;
}

function FilterSelect({ placeholder, values }: { placeholder: string; values: string[] }) { return <Select><SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{values.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>; }
