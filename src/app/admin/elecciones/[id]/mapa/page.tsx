import Link from "next/link";
import { notFound } from "next/navigation";
import { updateElectionMapZone } from "@/app/actions/elections";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function ElectionMapAdmin({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, query, { supabase }] = await Promise.all([
    params,
    searchParams,
    requirePermission(PERMISSIONS.electionsMapView),
  ]);
  const [{ data: election }, { data: zones }] = await Promise.all([
    supabase.from("elections").select("id,slug,title,territory,status").eq("id", id).maybeSingle(),
    supabase
      .from("election_territorial_results")
      .select("*")
      .eq("election_id", id)
      .order("zone_name"),
  ]);
  if (!election) notFound();

  return (
    <>
      <AdminPageHeader
        title="Mapa electoral"
        description={`${election.title} · ${election.territory}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/admin/elecciones/${id}`}>Volver</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/elecciones/${election.slug}/mapa`}>Vista pública</Link>
            </Button>
          </div>
        }
      />
      <ActionMessage error={query.error} success={query.success} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="grid gap-3 md:grid-cols-2">
          {zones?.map((zone) => (
            <article key={zone.id} className="app-card-enter rounded-xl border bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#9a752f]">
                    {zone.zone_type}
                  </p>
                  <h2 className="text-lg font-semibold text-[#153553]">
                    {zone.zone_name}
                  </h2>
                </div>
                <Badge variant="outline">{statusLabel(zone.status)}</Badge>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Avance territorial</span>
                  <span>{Number(zone.counted_percentage).toFixed(2)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-[#153b5c] transition-all duration-300"
                    style={{ width: `${Math.min(100, Number(zone.counted_percentage))}%` }}
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Última actualización: {formatDate(zone.public_updated_at)}
              </p>
            </article>
          ))}
        </section>

        <aside className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold text-[#153553]">Enviar / Actualizar resultados</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Registre porcentajes territoriales públicos. Use JSON con pares
            nombre/porcentaje para las opciones.
          </p>
          <form action={updateElectionMapZone} className="mt-4 grid gap-3">
            <input type="hidden" name="election_id" value={id} />
            <label className="grid gap-1 text-sm font-medium">
              Municipio o zona
              <Input name="zone_name" required placeholder="Cali" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Tipo de zona
              <Input name="zone_type" defaultValue="municipio" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Votos esperados
              <Input name="expected_votes" type="number" min={1} defaultValue={100} required />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Avance contado (%)
              <Input name="counted_percentage" type="number" min={0} max={100} step="0.01" defaultValue={0} required />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Estado
              <select name="status" defaultValue="preliminar" className="h-9 rounded-md border px-3 text-sm">
                <option value="sin_reporte">Sin reporte</option>
                <option value="en_escrutinio">En escrutinio</option>
                <option value="preliminar">Preliminar</option>
                <option value="final">Final</option>
                <option value="observado">Observado</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Porcentajes por opción
              <Textarea name="option_percentages" placeholder='{"Tarjeta Electoral 1":45.2,"Tarjeta Electoral 2":38.1,"Tarjeta Electoral 3":16.7}' className="min-h-28 font-mono text-xs" />
            </label>
            <SubmitButton pendingLabel="Actualizando…">Enviar / Actualizar resultados</SubmitButton>
          </form>
        </aside>
      </div>
    </>
  );
}

function statusLabel(value: string) {
  return (
    {
      sin_reporte: "Sin reporte",
      en_escrutinio: "En escrutinio",
      preliminar: "Preliminar",
      final: "Final",
      observado: "Observado",
    } as Record<string, string>
  )[value] ?? value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
