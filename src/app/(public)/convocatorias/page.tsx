import Link from "next/link";
import { CalendarClock, MapPin, SearchCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function PublicSelections() {
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from("public_selection_processes").select("*").order("closing_at")
    : { data: [] };

  return (
    <>
      <PageHero
        title="Convocatorias y procesos de selección"
        description="Procesos públicos abiertos por las dependencias participantes."
      />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="mb-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9a752f]">
                Panel del postulante
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#153553]">
                Estado de mi postulación
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Si ya se postuló, consulte el avance con su código de
                seguimiento y el correo usado en el formulario.
              </p>
            </div>
            <Button asChild>
              <Link href="/convocatorias/estado">
                <SearchCheck className="size-4" />
                Consultar estado de mi postulación
              </Link>
            </Button>
          </div>
        </section>

        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {data?.map((process) => (
            <article
              key={process.id}
              className="min-w-0 rounded-xl border bg-white p-6"
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-xs font-semibold uppercase tracking-wide text-[#9a752f]">
                    {process.position_title}
                  </p>
                  <h2 className="mt-1 break-words font-semibold text-[#153553]">
                    {process.title}
                  </h2>
                </div>
                <Badge variant="outline">
                  {process.vacancies} vacante{process.vacancies === 1 ? "" : "s"}
                </Badge>
              </div>
              <p className="mt-3 flex items-start gap-1 break-words text-xs text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                {process.institution_name} · {process.dependency_name}
              </p>
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                Cierra {formatDate(process.closing_at)}
              </p>
              <p className="mt-4 line-clamp-3 break-words text-sm leading-6 text-slate-700">
                {process.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/convocatorias/${process.slug}`}>
                    Ver convocatoria y postular
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/convocatorias/estado">Ya me postulé</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>

        {!data?.length && (
          <p className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">
            No hay convocatorias públicas abiertas en este momento.
          </p>
        )}
      </main>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}
