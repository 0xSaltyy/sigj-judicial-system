import Link from "next/link";
import { CalendarClock, MapPin, Search, SearchCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function PublicSelections({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; institution?: string; dependency?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from("public_selection_processes").select("*").order("closing_at")
    : { data: [] };
  const normalized = (query.q ?? "").trim().toLocaleLowerCase("es");
  const institutions = Array.from(new Set((data ?? []).map((item) => item.institution_name).filter(Boolean))).sort();
  const dependencies = Array.from(new Set((data ?? []).map((item) => item.dependency_name).filter(Boolean))).sort();
  const rows = (data ?? []).filter((item) => {
    const haystack = `${item.title} ${item.position_title} ${item.institution_name} ${item.dependency_name}`.toLocaleLowerCase("es");
    return (!normalized || haystack.includes(normalized)) &&
      (!query.institution || item.institution_name === query.institution) &&
      (!query.dependency || item.dependency_name === query.dependency);
  });

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
                seguimiento.
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

        <section className="mb-8 rounded-2xl border bg-white p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9a752f]">
              Convocatorias abiertas
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#153553]">
              Buscar procesos públicos
            </h2>
          </div>
          <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
            <label className="grid gap-1 text-xs font-medium">
              Cargo, despacho o convocatoria
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input name="q" defaultValue={query.q} className="h-10 w-full rounded-md border pl-9 pr-3 text-sm" />
              </div>
            </label>
            <Filter label="Institución" name="institution" value={query.institution}>
              <option value="">Todas</option>
              {institutions.map((name) => <option key={name} value={name}>{name}</option>)}
            </Filter>
            <Filter label="Despacho" name="dependency" value={query.dependency}>
              <option value="">Todos</option>
              {dependencies.map((name) => <option key={name} value={name}>{name}</option>)}
            </Filter>
            <div className="flex items-end gap-2">
              <Button type="submit">Filtrar</Button>
              <Button asChild variant="outline"><Link href="/convocatorias">Limpiar</Link></Button>
            </div>
          </form>
        </section>

        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {rows.map((process) => (
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

        {!rows.length && (
          <p className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">
            No hay convocatorias públicas abiertas en este momento.
          </p>
        )}
      </main>
    </>
  );
}

function Filter({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium">
      {label}
      <select name={name} defaultValue={value ?? ""} className="h-10 rounded-md border px-3 text-sm">
        {children}
      </select>
    </label>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}
