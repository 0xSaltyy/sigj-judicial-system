import Link from "next/link";
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarDays, FileCheck2, FolderKanban, Gavel, Plus, ShieldAlert } from "lucide-react";
import { AdminPageHeader, MetricCard } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaseStatusBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/display";

export const metadata = { title: "Panel institucional" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const [mattersCount, casesCount, hearingsCount, warrantsCount, applicationsCount, complaintsCount, latestCases, latestHearings, auditLogs] = supabase ? await Promise.all([
    supabase.from("matters").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("cases").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("hearings").select("id", { count: "exact", head: true }).gte("scheduled_at", new Date().toISOString()).is("archived_at", null),
    supabase.from("roleplay_warrants").select("id", { count: "exact", head: true }).in("status", ["Aprobada", "Activa"]).is("archived_at", null),
    supabase.from("roleplay_applications").select("id", { count: "exact", head: true }).in("status", ["Recibida", "En revisión"]).is("archived_at", null),
    supabase.from("complaints").select("id", { count: "exact", head: true }).eq("status", "Recibida").is("archived_at", null),
    supabase.from("cases").select("id,case_number,internal_number,case_caption,title,status").is("archived_at", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("hearings").select("id,title,scheduled_at,room,status").gte("scheduled_at", new Date().toISOString()).is("archived_at", null).order("scheduled_at", { ascending: true }).limit(4),
    supabase.from("audit_logs").select("id,action,description,created_at").order("created_at", { ascending: false }).limit(6),
  ]) : [];
  const caseRows = latestCases?.data ?? [];
  const hearingRows = latestHearings?.data ?? [];
  const logRows = auditLogs?.data ?? [];
  return (
    <>
      <AdminPageHeader title="Panel interno DOJ" description="Resumen operativo basado en datos reales de Supabase. Si no existen registros, los contadores muestran 0." action={<Button asChild className="gap-2 rounded-none bg-[#005ea8] hover:bg-[#1a4480]"><Link href="/admin/expedientes/nuevo"><Plus className="size-4" /> Abrir Matter o Case</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="DOJ Matters" value={String(mattersCount?.count ?? 0)} detail="Trabajo interno no archivado" icon={<BriefcaseBusiness className="size-5" />} />
        <MetricCard label="Federal Cases" value={String(casesCount?.count ?? 0)} detail="Cases no archivados" icon={<FolderKanban className="size-5" />} />
        <MetricCard label="Audiencias próximas" value={String(hearingsCount?.count ?? 0)} detail="Desde este momento" icon={<CalendarDays className="size-5" />} />
        <MetricCard label="Warrants activos" value={String(warrantsCount?.count ?? 0)} detail="Aprobados o activos" icon={<Gavel className="size-5" />} />
        <MetricCard label="Postulaciones pendientes" value={String(applicationsCount?.count ?? 0)} detail="Recibidas o en revisión" icon={<FileCheck2 className="size-5" />} />
        <MetricCard label="Denuncias nuevas" value={String(complaintsCount?.count ?? 0)} detail="Pendientes de revisión" icon={<ShieldAlert className="size-5" />} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base text-[#153553]">Latest Federal Cases</CardTitle><Link href="/admin/expedientes" className="text-xs font-semibold text-[#005ea8]">Ver Cases</Link></CardHeader><CardContent className="divide-y p-0">{caseRows.length === 0 ? <EmptyList text="No hay Federal Cases registrados." /> : caseRows.map((item) => <Link key={item.id} href={`/admin/expedientes/${item.id}`} className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50"><div><p className="mono-number text-xs font-semibold text-[#153553]">{item.case_number || item.internal_number}</p><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.case_caption || item.title}</p></div><CaseStatusBadge status={item.status} /></Link>)}</CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base text-[#153553]">Próximas audiencias</CardTitle><Link href="/admin/audiencias" className="text-xs font-semibold text-[#005ea8]">Ver agenda</Link></CardHeader><CardContent className="divide-y p-0">{hearingRows.length === 0 ? <EmptyList text="No hay audiencias próximas." /> : hearingRows.map((item) => <div key={item.id} className="flex items-center gap-4 px-6 py-4"><div className="bg-[#112f4e] px-2 py-1.5 text-center text-[10px] text-white"><p className="mono-number text-white">{formatDateTime(item.scheduled_at)}</p></div><div><p className="text-xs font-semibold text-[#153553]">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.room} · {item.status}</p></div></div>)}</CardContent></Card>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_.55fr]">
        <Card><CardHeader><CardTitle className="text-base text-[#153553]">Actividad reciente</CardTitle></CardHeader><CardContent className="divide-y p-0">{logRows.length === 0 ? <EmptyList text="Aún no hay eventos de auditoría visibles." /> : logRows.map((item) => <div key={item.id} className="flex gap-3 px-6 py-4"><div className="mt-1 size-2 rounded-full bg-[#b21b1b]" /><div><p className="text-xs font-semibold text-[#153553]">{item.action}</p><p className="mt-1 text-xs text-muted-foreground">{item.description} · {formatDateTime(item.created_at)}</p></div></div>)}</CardContent></Card>
        <Card className="border-slate-200 bg-white"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#112f4e]"><AlertTriangle className="size-4" /> Alertas operativas</CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-5 text-slate-700"><p className="border bg-slate-50 p-3">Las alertas se calculan con registros reales. Si no hay datos, no se muestran cifras inventadas.</p><Link href="/admin/denuncias" className="flex items-center gap-1 font-semibold text-[#005ea8]">Revisar denuncias <ArrowRight className="size-3.5" /></Link></CardContent></Card>
      </div>
    </>
  );
}

function EmptyList({ text }: { text: string }) {
  return <div className="px-6 py-8 text-sm text-slate-600">{text}</div>;
}
