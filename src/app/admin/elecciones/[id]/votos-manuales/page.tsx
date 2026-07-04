import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ManualVotesRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ legacy?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (query.legacy === "1") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9a752f]">Flujo heredado</p>
          <h1 className="mt-3 text-2xl font-semibold text-[#153553]">Votos manuales reemplazados por conteo general</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            El registro normal de votos físicos o administrativos ahora se realiza como lotes generales por tarjeta electoral en el panel de Conteo electoral.
            Los lotes manuales históricos siguen conservados internamente y los validados continúan incluidos en los totales.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="rounded-md bg-[#153b5c] px-4 py-2 text-sm font-medium text-white" href={`/admin/elecciones/${id}/resultados`}>
              Ir a Conteo electoral
            </Link>
            <Link className="rounded-md border px-4 py-2 text-sm font-medium" href={`/admin/elecciones/${id}`}>
              Volver a la elección
            </Link>
          </div>
        </section>
      </main>
    );
  }
  redirect(`/admin/elecciones/${id}/resultados`);
}
