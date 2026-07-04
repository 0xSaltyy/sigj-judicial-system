import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type PublicTotal = { option_id: string; candidate_name: string; card_label: string; ballot_card_image_path: string | null; candidate_image_path: string | null; public_percent: number | string; progress_percent: number | string; results_updated_at: string | null };

export default async function PublicElectionMap({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: election } = supabase
    ? await supabase.from("public_elections").select("*").eq("slug", slug).maybeSingle()
    : { data: null };
  if (!election || !supabase) notFound();
  const { data: totals } = await supabase.rpc("election_public_percentage_totals", { p_election_id: election.id });
  const rows = (totals ?? []) as PublicTotal[];
  const visible = ["preliminary_results", "definitively_closed", "final_results_published"].includes(election.status);
  const progress = Math.max(0, Math.min(100, Number(rows[0]?.progress_percent ?? 0)));
  const winner = rows.find((row) => row.option_id === election.winner_option_id);
  const winnerVisible = Boolean(election.winner_option_id && election.winner_published_at && winner);

  return (
    <>
      <PageHero
        title="Visualización general de resultados"
        description={`${election.title} · porcentajes publicados por tarjeta electoral`}
      />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={`/elecciones/${slug}/resultados`}>Resultados</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/elecciones/${slug}/sala`}>Sala en vivo</Link>
          </Button>
        </div>
        {!visible ? (
          <p className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">
            Resultados aún no publicados.
          </p>
        ) : (
          <>
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Badge variant="outline">Actualización pública</Badge>
                  <h2 className="mt-3 text-2xl font-semibold text-[#153553]">Avance general del escrutinio</h2>
                  <p className="mt-1 text-sm text-muted-foreground">La visualización pública muestra porcentajes, no conteos internos.</p>
                  {winnerVisible && <p className="mt-3 text-sm font-semibold text-emerald-800">Ganador oficial declarado: {winner?.candidate_name}</p>}
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-[#102d49]">{formatPercent(progress)}</p>
                  <p className="text-xs text-muted-foreground">Actualizado: {rows[0]?.results_updated_at ? formatDate(rows[0].results_updated_at) : "—"}</p>
                </div>
              </div>
              <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#b38a3c]" style={{ width: `${progress}%` }} />
              </div>
            </section>
            <section className="mt-6 grid gap-5 md:grid-cols-3">
              {rows.map((row) => (
                <article key={row.option_id} className="app-card-enter overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <div className="bg-slate-50 p-3">
                    {row.ballot_card_image_path ? (
                      <Image src={row.ballot_card_image_path} alt={`${row.card_label} · ${row.candidate_name}`} width={543} height={724} className="mx-auto max-h-80 w-full rounded border bg-white object-contain" />
                    ) : (
                      <div className="grid aspect-[3/4] place-items-center rounded border border-dashed text-center text-sm text-muted-foreground">Imagen de tarjeta electoral no disponible.</div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9a752f]">{row.card_label}</p>
                    <h2 className="mt-2 break-words text-lg font-semibold text-[#153553]">{row.candidate_name}</h2>
                    {winnerVisible && election.winner_option_id === row.option_id && <Badge className="mt-3 bg-emerald-700">Ganador oficial</Badge>}
                    <p className="mt-4 text-4xl font-bold text-[#102d49]">{formatPercent(Number(row.public_percent))}</p>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#153b5c]" style={{ width: `${Math.min(100, Math.max(0, Number(row.public_percent)))}%` }} />
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
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
