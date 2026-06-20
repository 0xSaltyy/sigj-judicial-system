import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge } from "@/components/status-badges";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { can, requirePermission } from "@/lib/auth/permissions";

export default async function AdminHearingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { supabase, profile } = await requirePermission({ resource: "audiencias", action: "view" });
  const [query, canCreate, canEdit, canArchive, canRestore, canHardDelete] = await Promise.all([searchParams, can(profile, "create", "audiencias", { supabase }), can(profile, "edit", "audiencias", { supabase }), can(profile, "archive", "audiencias", { supabase }), can(profile, "restore", "audiencias", { supabase }), can(profile, "hard_delete", "audiencias", { supabase })]);
  const { data, error } = await supabase.from("hearings").select("*,case:cases(internal_number,chamber)").order("scheduled_at", { ascending: false }).limit(100);
  return <>
    <AdminPageHeader title="Agenda de audiencias" description="Programación y gestión de sesiones físicas y virtuales." action={canCreate ? <Button asChild className="bg-[#153b5c]"><Link href="/admin/audiencias/nueva"><CalendarPlus className="size-4" /> Programar audiencia</Link></Button> : <Button disabled title="No tiene permiso para crear audiencias"><CalendarPlus className="size-4" /> Programar audiencia</Button>} />
    <ActionMessage error={query.error ?? error?.message} success={query.success} />
    <div className="grid gap-4 lg:grid-cols-2">
      {(data ?? []).map((hearing) => <article key={hearing.id} className={`rounded-lg border bg-white p-5 ${hearing.archived_at ? "opacity-75" : ""}`}>
        <div className="flex justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-[#9a752f]">{hearing.hearing_type}</p><h2 className="mt-1 font-semibold text-[#153553]">{hearing.title}</h2><p className="mono-number mt-1 text-xs text-muted-foreground">{Array.isArray(hearing.case) ? hearing.case[0]?.internal_number : hearing.case?.internal_number}</p></div><CaseStatusBadge status={hearing.status} /></div>
        <p className="mt-4 text-xs text-muted-foreground">{new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(hearing.scheduled_at))} · {hearing.room || "Sala por definir"} · {hearing.is_public ? "Pública" : "Interna"}</p>
        <div className="mt-4 flex flex-wrap gap-2">{canEdit ? <Button asChild size="sm" variant="outline"><Link href={`/admin/audiencias/${hearing.id}/editar`}>Editar / reprogramar</Link></Button> : <Button size="sm" variant="outline" disabled title="No tiene permiso para editar audiencias">Editar / reprogramar</Button>}<Button asChild size="sm" variant="outline"><Link href={`/admin/audiencias/${hearing.id}/acta`}>Imprimir acta</Link></Button><LifecycleActions resource="hearings" recordId={hearing.id} recordLabel={hearing.title} destination="/admin/audiencias" archived={Boolean(hearing.archived_at)} canArchive={canArchive} canRestore={canRestore} canHardDelete={canHardDelete} compact /></div>
      </article>)}
    </div>
    {!data?.length && <p className="rounded border bg-white p-8 text-center text-sm text-muted-foreground">No hay audiencias.</p>}
  </>;
}
