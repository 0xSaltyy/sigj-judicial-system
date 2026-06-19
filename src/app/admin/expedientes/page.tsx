import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseStatusBadge, ConfidentialityBadge } from "@/components/status-badges";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { requireInternalUser } from "@/lib/auth/authorization";
import { hasPermission, RESOURCE_ROLES } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/demo-data";

export const metadata = { title: "Expedientes" };
export default async function CasesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; error?: string; success?: string }> }) {
  const [{ supabase, profile }, query] = await Promise.all([requireInternalUser(), searchParams]);
  let request = supabase.from("cases").select("id,internal_number,judicial_number,title,chamber,status,confidentiality_level,filed_at,claimant_name,defendant_name,archived_at").order("filed_at", { ascending: false }).limit(100);
  if (query.q) request = request.or(`internal_number.ilike.%${query.q}%,judicial_number.ilike.%${query.q}%,title.ilike.%${query.q}%`);
  if (query.status) request = request.eq("status", query.status);
  const { data: cases, error } = await request;
  return <><AdminPageHeader title="Expedientes judiciales" description="Radicación, asignación y seguimiento con datos reales de Supabase." action={<Button asChild className="gap-2 bg-[#153b5c]"><Link href="/admin/expedientes/nuevo"><Plus className="size-4" /> Nueva radicación</Link></Button>} />
    <ActionMessage error={query.error ?? error?.message} success={query.success} />
    <div className="rounded-lg border bg-white"><form className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_220px_auto]"><Input name="q" defaultValue={query.q} placeholder="Radicado, número interno o título…" /><select name="status" defaultValue={query.status ?? ""} className="h-9 rounded-md border bg-white px-3 text-sm"><option value="">Todos los estados</option>{["Radicado", "En reparto", "En trámite", "Cerrado", "Archivado"].map((v) => <option key={v}>{v}</option>)}</select><Button type="submit" variant="outline">Filtrar</Button></form>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Radicado</TableHead><TableHead>Proceso / partes</TableHead><TableHead>Sala</TableHead><TableHead>Estado</TableHead><TableHead>Reserva</TableHead><TableHead>Fecha</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{(cases ?? []).map((item) => <TableRow key={item.id} className={item.archived_at ? "bg-slate-50/70" : undefined}><TableCell><Link href={`/admin/expedientes/${item.id}`} className="mono-number text-xs font-semibold text-[#153b5c] hover:underline">{item.internal_number}</Link><p className="mono-number mt-1 text-[10px] text-muted-foreground">{item.judicial_number}</p></TableCell><TableCell><p className="text-sm font-medium text-[#153553]">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.claimant_name} / {item.defendant_name}</p></TableCell><TableCell className="text-xs">{item.chamber}</TableCell><TableCell><CaseStatusBadge status={item.status} /></TableCell><TableCell><ConfidentialityBadge level={item.confidentiality_level} /></TableCell><TableCell className="text-xs">{formatDate(item.filed_at)}</TableCell><TableCell><div className="flex items-center gap-2"><Button asChild variant="ghost" size="icon"><Link href={`/admin/expedientes/${item.id}`} aria-label={`Ver ${item.internal_number}`}><Eye className="size-4" /></Link></Button><LifecycleActions resource="cases" recordId={item.id} recordLabel={item.internal_number} destination="/admin/expedientes" archived={Boolean(item.archived_at)} canArchive={hasPermission(profile, RESOURCE_ROLES.archive)} canRestore={profile.is_owner} canHardDelete={profile.is_owner} compact /></div></TableCell></TableRow>)}</TableBody></Table></div>
      {!cases?.length && <p className="p-8 text-center text-sm text-muted-foreground">No hay expedientes que coincidan con la búsqueda.</p>}
      <p className="border-t p-4 text-xs text-muted-foreground">Se muestran hasta 100 resultados recientes. Use los filtros para acotar la consulta.</p>
    </div></>;
}
