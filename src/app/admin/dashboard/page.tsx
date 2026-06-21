import Link from "next/link";
import {
  CalendarDays,
  FolderKanban,
  Gavel,
  Plus,
} from "lucide-react";
import { AdminPageHeader, MetricCard } from "@/components/admin-page";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaseStatusBadge } from "@/components/status-badges";
import { requireInternalUser } from "@/lib/auth/authorization";
import { DASHBOARD_REALTIME } from "@/lib/realtime-subscriptions";
export default async function DashboardPage() {
  const { supabase } = await requireInternalUser();
  const now = new Date().toISOString();
  const [
    { count: cases },
    { count: hearings },
    { count: pending },
    { count: pendingSala },
    { data: pendingOpinions },
    { data: recent },
    { data: next },
  ] = await Promise.all([
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
    supabase
      .from("hearings")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", now)
      .in("status", ["Programada", "Reprogramada"]),
    supabase
      .from("proceedings")
      .select("id", { count: "exact", head: true })
      .in("status", ["Borrador", "En revisión"]),
    supabase.from("sala_sessions").select("id", { count: "exact", head: true }).in("status", ["En sala", "En estudio", "Con salvamento/aclaración"]),
    supabase.from("vote_documents").select("id,title,vote_type,status,proceeding_id").in("status", ["Borrador", "Presentado"]).order("updated_at", { ascending: false }).limit(5),
      supabase
        .from("cases")
        .select("id,internal_number,title,status")
        .is("archived_at", null)
        .order("filed_at", { ascending: false })
      .limit(5),
    supabase
      .from("hearings")
      .select("id,title,scheduled_at,room")
      .gte("scheduled_at", now)
      .order("scheduled_at")
      .limit(5),
  ]);
  return (
    <>
      <RealtimeRefresh channel="admin-dashboard" subscriptions={DASHBOARD_REALTIME} />
      <AdminPageHeader
        title="Panel del Palacio Judicial"
        description="Resumen operativo en tiempo real."
        action={
          <Button asChild className="bg-[#153b5c]">
            <Link href="/admin/expedientes/nuevo">
              <Plus className="size-4" /> Nueva radicación
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Expedientes activos"
          value={String(cases ?? 0)}
          detail="No archivados"
          icon={<FolderKanban className="size-5" />}
        />
        <MetricCard label="Votaciones de Sala pendientes" value={String(pendingSala ?? 0)} detail="En estudio, votación o con voto particular" icon={<Gavel className="size-5" />} />
        <MetricCard
          label="Audiencias próximas"
          value={String(hearings ?? 0)}
          detail="Programadas o reprogramadas"
          icon={<CalendarDays className="size-5" />}
        />
        <MetricCard
          label="Providencias pendientes"
          value={String(pending ?? 0)}
          detail="Borrador o en revisión"
          icon={<Gavel className="size-5" />}
        />
      </div>
      {(pendingOpinions ?? []).length > 0 && <Card className="mt-5"><CardHeader><CardTitle>Votos particulares pendientes</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{(pendingOpinions ?? []).map((vote) => <Link key={vote.id} href={`/admin/providencias/${vote.proceeding_id}/votos/${vote.id}`} className="rounded border p-3 text-sm"><b>{vote.vote_type}</b><small className="mt-1 block text-muted-foreground">{vote.title} · {vote.status}</small></Link>)}</CardContent></Card>}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimos expedientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(recent ?? []).map((c) => (
              <Link
                key={c.id}
                href={`/admin/expedientes/${c.id}`}
                className="flex justify-between rounded border p-3"
              >
                <span className="mono-number text-xs">
                  {c.internal_number}
                  <small className="mt-1 block text-muted-foreground">
                    {c.title}
                  </small>
                </span>
                <CaseStatusBadge status={c.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Próximas audiencias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(next ?? []).map((h) => (
              <Link
                key={h.id}
                href={`/admin/audiencias/${h.id}/editar`}
                className="block rounded border p-3 text-sm"
              >
                <b>{h.title}</b>
                <small className="mt-1 block text-muted-foreground">
                  {new Intl.DateTimeFormat("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(h.scheduled_at))}{" "}
                  · {h.room}
                </small>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
