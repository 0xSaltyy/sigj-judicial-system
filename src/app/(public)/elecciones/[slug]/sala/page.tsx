import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ELECTION_STATUS_LABELS, statusLabel } from "@/lib/elections";

type ResultRow = {
  option_id: string;
  candidate_name: string;
  card_label: string;
  public_percent: number | string;
  progress_percent: number | string;
  results_updated_at: string;
};

type HistoryRow = {
  update_number: number;
  snapshot_type: string;
  progress_percentage: number | string;
  updated_at: string;
};

export default async function LiveScrutinyRoom({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: election } = supabase
    ? await supabase
      .from("public_elections")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
    : { data: null };
  if (!election || !supabase) notFound();

  const [{ data: results }, { data: history }] = await Promise.all([
    supabase.rpc("election_public_percentage_totals", { p_election_id: election.id }),
    supabase
      .from("public_election_update_history")
      .select("update_number,snapshot_type,progress_percentage,updated_at")
      .eq("election_id", election.id)
      .order("update_number", { ascending: false })
      .limit(3),
  ]);
  const rows = (results ?? []) as ResultRow[];
  const updates = (history ?? []) as HistoryRow[];
  const visible = ["preliminary_results", "definitively_closed", "final_results_published"].includes(election.status) && updates.length > 0;
  const progress = Math.max(0, Math.min(100, Number(rows[0]?.progress_percent ?? 0)));
  const lastUpdate = rows[0]?.results_updated_at ?? updates[0]?.updated_at ?? election.closes_at;
  const winner = rows.find((row) => row.option_id === election.winner_option_id);
  const winnerVisible = Boolean(election.winner_option_id && election.winner_published_at && winner);

  return (
    <>
      <PageHero title="Sala de escrutinio en vivo" description={election.title} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="rounded-3xl border bg-[#0e2943] p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge className="bg-white/10 text-white hover:bg-white/10">
                {statusLabel(ELECTION_STATUS_LABELS, election.status)}
              </Badge>
              <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight md:text-5xl">
                {election.title}
              </h1>
              <p className="mt-3 text-sm text-slate-300">
                {election.office} · {election.territory} · {election.round_label}
              </p>
              {winnerVisible && (
                <p className="mt-4 rounded-xl border border-emerald-200/40 bg-emerald-500/10 p-3 text-sm text-emerald-50">
                  Ganador oficial declarado: <strong>{winner?.candidate_name}</strong>.
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-right">
              <p className="text-xs uppercase tracking-[.18em] text-[#d8c083]">Avance publicado</p>
              <p className="mt-1 text-4xl font-bold">{formatPercent(progress)}</p>
              <p className="mt-1 text-xs text-slate-300">Actualizado {formatDate(lastUpdate)}</p>
              <div className="mt-3 flex justify-end">
                <AutoRefresh intervalMs={45000} label="Actualización automática cada 45 s" />
              </div>
            </div>
          </div>
          {!visible ? (
            <p className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-5 text-sm text-slate-200">
              La sala está lista. Los porcentajes aparecerán cuando sean publicados por personal autorizado.
            </p>
          ) : (
            <>
              <div className="mt-8 h-4 overflow-hidden rounded-full bg-white/15">
                <div className="h-full progress-smooth rounded-full bg-[#d8c083]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                {rows.map((row) => (
                  <article key={row.option_id} className="rounded-2xl bg-white p-5 text-[#153553]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9a752f]">
                      {row.card_label}
                    </p>
                    <h2 className="mt-2 min-h-12 text-xl font-semibold">{row.candidate_name}</h2>
                    {winnerVisible && election.winner_option_id === row.option_id && <Badge className="mt-3 bg-emerald-700">Ganador oficial</Badge>}
                    <p className="mt-4 text-5xl font-bold">{formatPercent(Number(row.public_percent))}</p>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full progress-smooth bg-[#b38a3c]" style={{ width: `${Math.min(100, Math.max(0, Number(row.public_percent)))}%` }} />
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
        {updates.length > 0 && (
          <section className="mt-6 rounded-xl border bg-white p-5">
            <h2 className="font-semibold text-[#153553]">Últimas actualizaciones públicas</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {updates.map((update) => (
                <article key={update.update_number} className="rounded border bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">Actualización {update.update_number}</p>
                  <p className="text-muted-foreground">{snapshotLabel(update.snapshot_type)} · {formatPercent(Number(update.progress_percentage))}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(update.updated_at)}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/elecciones/${slug}/mapa`}>Visualización general</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/elecciones/${slug}/resultados`}>Resultados detallados</Link>
          </Button>
        </div>
      </main>
    </>
  );
}

function formatPercent(value: number) {
  return `${Math.min(100, Math.max(0, value)).toFixed(2).replace(/\.00$/, "")}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function snapshotLabel(value: string) {
  return ({ preliminary: "Preliminar", final: "Definitiva", winner: "Ganador oficial", act: "Acta" } as Record<string, string>)[value] ?? value;
}
