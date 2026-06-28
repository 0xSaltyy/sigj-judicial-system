import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function PublicElectionMap({
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
  const [{ data: zones }, { data: options }] = await Promise.all([
    supabase
      .from("public_election_territorial_results")
      .select("*")
      .eq("election_id", election.id)
      .order("zone_name"),
    supabase.from("public_election_options").select("id,display_order,candidate_name").eq("election_id", election.id).order("display_order"),
  ]);
  const labels = new Map((options ?? []).map((option) => [option.id, `Tarjeta Electoral ${option.display_order}`]));

  return (
    <>
      <PageHero
        title="Mapa electoral del Valle del Cauca"
        description={`${election.title} · porcentajes territoriales publicados`}
      />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={`/elecciones/${slug}/resultados`}>Resultados</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/elecciones/${slug}/sala`}>Sala de escrutinio en vivo</Link>
          </Button>
        </div>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {zones?.map((zone) => (
            <article key={zone.zone_name} className="app-card-enter rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#9a752f]">
                    {zone.zone_type}
                  </p>
                  <h2 className="text-xl font-semibold text-[#153553]">{zone.zone_name}</h2>
                </div>
                <Badge variant="outline">{statusLabel(zone.status)}</Badge>
              </div>
              <div className="mt-5">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Avance</span>
                  <span>{Number(zone.counted_percentage).toFixed(2)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-[#153b5c] transition-all duration-300"
                    style={{ width: `${Math.min(100, Number(zone.counted_percentage))}%` }}
                  />
                </div>
              </div>
              <OptionPercentages value={zone.option_percentages} labels={labels} />
              <p className="mt-4 text-xs text-muted-foreground">
                Actualizado: {formatDate(zone.public_updated_at)}
              </p>
            </article>
          ))}
        </section>
        {!zones?.length && (
          <p className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">
            Aún no hay resultados territoriales publicados.
          </p>
        )}
      </main>
    </>
  );
}

function OptionPercentages({ value, labels }: { value: Record<string, number> | null; labels: Map<string,string> }) {
  const entries = Object.entries(value ?? {});
  if (!entries.length) return null;
  return (
    <div className="mt-4 grid gap-2">
      {entries.map(([label, percent]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="break-words">{labels.get(label) ?? label}</span>
            <span>{Number(percent).toFixed(2)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-[#b38a3c]" style={{ width: `${Math.min(100, Number(percent))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function statusLabel(value: string) {
  return ({ sin_reporte: "Sin reporte", en_escrutinio: "En escrutinio", preliminar: "Preliminar", final: "Final", observado: "Observado" } as Record<string, string>)[value] ?? value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
