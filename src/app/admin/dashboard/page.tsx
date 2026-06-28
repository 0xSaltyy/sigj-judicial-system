import Link from "next/link";
import {
  CalendarDays,
  BellRing,
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
import { can } from "@/lib/auth/permissions";

export default async function DashboardPage() {
  const { supabase, profile } = await requireInternalUser();
  const [canCases, canCreateCases, canHearings, canProceedings, canSala, canVotes, canElections, canSelection, canReminders] =
    await Promise.all([
      can(profile, "view", "expedientes", { supabase }),
      can(profile, "create", "expedientes", { supabase }),
      can(profile, "view", "audiencias", { supabase }),
      can(profile, "view", "providencias", { supabase }),
      can(profile, "view", "sala", { supabase }),
      can(profile, "view", "votos", { supabase }),
      can(profile, "ver_votos", "elecciones", { supabase }),
      can(profile, "view_applications", "seleccion", { supabase }),
      can(profile, "ver", "recordatorios", { supabase }),
    ]);
  const now = new Date().toISOString();
  const [
    { count: cases },
    { count: hearings },
    { count: pending },
    { count: pendingSala },
    { data: pendingOpinions },
    { data: recent },
    { data: next },
    { count: pendingElectionVotes },
    { count: pendingApplications },
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
    canElections
      ? supabase.from("election_votes").select("id", { count: "exact", head: true }).in("status", ["pending_validation", "observed"])
      : Promise.resolve({ count: 0 }),
    canSelection
      ? supabase.from("selection_applications").select("id", { count: "exact", head: true }).eq("status", "recibida")
      : Promise.resolve({ count: 0 }),
  ]);
  const reminders = [
    canHearings && (next ?? []).length > 0
      ? { title: "Tiene audiencias próximas.", detail: "Revise la agenda judicial y confirme ubicación o enlace.", href: "/admin/audiencias/agenda" }
      : null,
    canHearings && hearings
      ? { title: "Audiencias próximas registradas.", detail: `${hearings} audiencia(s) programadas o reprogramadas.`, href: "/admin/audiencias" }
      : null,
    canProceedings && pending
      ? { title: "Providencias pendientes de revisión o firma.", detail: `${pending} providencia(s) en borrador o revisión.`, href: "/admin/providencias" }
      : null,
    canElections && pendingElectionVotes
      ? { title: "Hay votos pendientes de validación.", detail: `${pendingElectionVotes} voto(s) requieren control humano.`, href: "/admin/elecciones" }
      : null,
    canSelection && pendingApplications
      ? { title: "Hay postulaciones pendientes de revisión.", detail: `${pendingApplications} postulación(es) recién recibidas.`, href: "/admin/seleccion" }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string; href: string }>;
  return (
    <>
      <RealtimeRefresh channel="admin-dashboard" subscriptions={DASHBOARD_REALTIME} />
      <AdminPageHeader
        title="Panel del Palacio Judicial"
        description="Resumen operativo en tiempo real."
        action={
          canCreateCases ? (
            <Button asChild className="bg-[#153b5c]">
              <Link href="/admin/expedientes/nuevo">
                <Plus className="size-4" /> Nueva radicación
              </Link>
            </Button>
          ) : (
            <Button disabled title="No tiene permiso para crear expedientes">
              <Plus className="size-4" /> Nueva radicación
            </Button>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canCases && (
          <MetricCard label="Expedientes activos" value={String(cases ?? 0)} detail="No archivados" icon={<FolderKanban className="size-5" />} />
        )}
        {canSala && (
          <MetricCard label="Votaciones de Sala pendientes" value={String(pendingSala ?? 0)} detail="En estudio, votación o con voto particular" icon={<Gavel className="size-5" />} />
        )}
        {canHearings && (
          <MetricCard label="Audiencias próximas" value={String(hearings ?? 0)} detail="Programadas o reprogramadas" icon={<CalendarDays className="size-5" />} />
        )}
        {canProceedings && (
          <MetricCard label="Providencias pendientes" value={String(pending ?? 0)} detail="Borrador o en revisión" icon={<Gavel className="size-5" />} />
        )}
      </div>
      {canReminders && reminders.length > 0 && (
        <Card className="mt-5 border-amber-200 bg-amber-50/60">
          <CardHeader><CardTitle className="flex items-center gap-2 text-[#153553]"><BellRing className="size-5" />Recordatorios internos</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {reminders.map((item) => (
              <Link key={item.title} href={item.href} className="notice-enter rounded-lg border bg-white p-4 text-sm transition hover:-translate-y-0.5 hover:shadow-sm">
                <b>{item.title}</b>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.detail}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
      {canVotes && (pendingOpinions ?? []).length > 0 && (
        <Card className="mt-5">
          <CardHeader><CardTitle>Votos particulares pendientes</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {(pendingOpinions ?? []).map((vote) => (
              <Link key={vote.id} href={`/admin/providencias/${vote.proceeding_id}/votos/${vote.id}`} className="rounded border p-3 text-sm">
                <b>{vote.vote_type}</b>
                <small className="mt-1 block text-muted-foreground">{vote.title} · {vote.status}</small>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {canCases && <Card>
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
            {!recent?.length && <p className="text-sm text-muted-foreground">No hay expedientes disponibles para su perfil.</p>}
          </CardContent>
        </Card>}
        {canHearings && <Card>
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
            {!next?.length && <p className="text-sm text-muted-foreground">No hay audiencias próximas disponibles.</p>}
          </CardContent>
        </Card>}
      </div>
      {!canCases && !canHearings && !canProceedings && !canSala && !canVotes && (
        <Card className="mt-5">
          <CardContent className="p-8 text-center">
            <p className="font-semibold">No hay módulos operativos habilitados para su perfil.</p>
            <p className="mt-2 text-sm text-muted-foreground">Su sesión permanece activa. Un administrador puede conceder acceso específico mediante permisos personalizados.</p>
            <Button asChild variant="outline" className="mt-4"><Link href="/admin/perfil">Abrir mi perfil</Link></Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
