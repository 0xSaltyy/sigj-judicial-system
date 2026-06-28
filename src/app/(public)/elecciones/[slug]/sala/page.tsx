import Link from "next/link";
import { notFound } from "next/navigation";
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

export default async function LiveScrutinyRoom({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: election } = supabase
    ? await supabase.from("public_elections").select("*").eq("slug", slug).maybeSingle()
    : { data: null };
  if (!election || !supabase) notFound();
  const [{ data: results }, { data: zones }] = await Promise.all([
    supabase.rpc("election_public_percentage_totals", { p_election_id: election.id }),
    supabase
      .from("public_election_territorial_results")
      .select("zone_name,counted_percentage,status")
      .eq("election_id", election.id)
      .order("counted_percentage", { ascending: false })
      .limit(4),
  ]);
  const rows = (results ?? []) as ResultRow[];
  const progress = rows[0] ? Number(rows[0].progress_percent) : 0;
  const lastUpdate = rows[0]?.results_updated_at ?? election.closes_at;

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
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-right">
              <p className="text-xs uppercase tracking-[.18em] text-[#d8c083]">Avance</p>
              <p className="mt-1 text-4xl font-bold">{progress.toFixed(2)}%</p>
              <p className="mt-1 text-xs text-slate-300">Actualizado {formatDate(lastUpdate)}</p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {rows.map((row) => (
              <article key={row.option_id} className="rounded-2xl bg-white p-5 text-[#153553]">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9a752f]">
                  {row.card_label}
                </p>
                <h2 className="mt-2 min-h-12 text-xl font-semibold">{row.candidate_name}</h2>
                <p className="mt-4 text-5xl font-bold">{Number(row.public_percent).toFixed(2)}%</p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-[#b38a3c] transition-all duration-300" style={{ width: `${Math.min(100, Number(row.public_percent))}%` }} />
                </div>
              </article>
            ))}
          </div>
          {!rows.length && (
            <p className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-5 text-sm text-slate-200">
              La sala está lista. Los porcentajes aparecerán cuando sean publicados por personal autorizado.
            </p>
          )}
        </section>
        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {zones?.map((zone) => (
            <article key={zone.zone_name} className="rounded-xl border bg-white p-4">
              <p className="font-semibold text-[#153553]">{zone.zone_name}</p>
              <p className="mt-1 text-2xl font-bold">{Number(zone.counted_percentage).toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground">{zone.status}</p>
            </article>
          ))}
        </section>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/elecciones/${slug}/mapa`}>Mapa electoral</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/elecciones/${slug}/resultados`}>Resultados detallados</Link>
          </Button>
        </div>
      </main>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
