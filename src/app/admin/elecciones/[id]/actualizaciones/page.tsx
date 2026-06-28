import Link from "next/link";
import { createElectionUpdateSnapshot } from "@/app/actions/elections";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function ElectionUpdatesAdmin({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, query, { supabase }] = await Promise.all([
    params,
    searchParams,
    requirePermission(PERMISSIONS.electionsViewUpdates),
  ]);
  const [{ data: election }, { data: updates }] = await Promise.all([
    supabase.from("elections").select("id,title,status").eq("id", id).maybeSingle(),
    supabase
      .from("election_public_updates")
      .select("*,updated_by_profile:profiles!election_public_updates_updated_by_fkey(full_name,is_owner)")
      .eq("election_id", id)
      .order("update_number", { ascending: false }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Actualizaciones electorales"
        description={election?.title ?? "Historial de publicaciones"}
        action={
          <Button asChild variant="outline">
            <Link href={`/admin/elecciones/${id}`}>Volver</Link>
          </Button>
        }
      />
      <ActionMessage error={query.error} success={query.success} />
      <section className="mb-5 rounded-xl border bg-white p-5">
        <h2 className="font-semibold text-[#153553]">Registrar snapshot público</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conserva un corte histórico con porcentajes públicos, sin votos
          individuales ni usuarios.
        </p>
        <form action={createElectionUpdateSnapshot} className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]">
          <input type="hidden" name="election_id" value={id} />
          <select name="snapshot_type" defaultValue="preliminary" className="h-10 rounded-md border px-3 text-sm">
            <option value="preliminary">Preliminar</option>
            <option value="final">Final</option>
            <option value="winner">Ganador</option>
            <option value="map">Mapa</option>
          </select>
          <Textarea name="note" placeholder="Nota pública opcional" className="min-h-10" />
          <SubmitButton pendingLabel="Registrando…">Publicar actualización</SubmitButton>
        </form>
      </section>
      <div className="space-y-3">
        {updates?.map((update) => (
          <article key={update.id} className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[#153553]">
                  Actualización {update.update_number}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {label(update.snapshot_type)} · {update.status_at_time} · {formatDate(update.updated_at)}
                </p>
              </div>
              <p className="text-2xl font-bold text-[#153553]">
                {Number(update.progress_percentage).toFixed(2)}%
              </p>
            </div>
            {update.note && <p className="mt-3 text-sm">{update.note}</p>}
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {(update.option_percentages ?? []).map((item: { label: string; candidate_name: string; percent: number }) => (
                <div key={`${update.id}-${item.label}`} className="rounded border bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{item.label}</p>
                  <p className="break-words font-medium">{item.candidate_name}</p>
                  <p className="mt-1 font-bold">{Number(item.percent).toFixed(2)}%</p>
                </div>
              ))}
            </div>
          </article>
        ))}
        {!updates?.length && (
          <p className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">
            Aún no hay snapshots publicados.
          </p>
        )}
      </div>
    </>
  );
}

function label(value: string) {
  return ({ preliminary: "Preliminar", final: "Final", winner: "Ganador", map: "Mapa", act: "Acta" } as Record<string, string>)[value] ?? value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
