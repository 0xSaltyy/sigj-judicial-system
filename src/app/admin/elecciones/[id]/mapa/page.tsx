import Link from "next/link";
import { notFound } from "next/navigation";
import { updateElectionMapZone, validateElectionMapZone } from "@/app/actions/elections";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { VALLE_DEL_CAUCA_DEPARTMENT, VALLE_DEL_CAUCA_MUNICIPALITIES } from "@/lib/valle-del-cauca";

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
  const [{ data: election }, { data: zones }, { data: options }] = await Promise.all([
    supabase.from("elections").select("id,slug,title,territory,status").eq("id", id).maybeSingle(),
    supabase
      .from("election_territorial_results")
      .select("*")
      .eq("election_id", id)
      .order("zone_name"),
    supabase.from("election_options").select("id,candidate_name,display_order").eq("election_id", id).eq("active", true).order("display_order"),
  ]);
  if (!election) notFound();

  return (
    <>
      <AdminPageHeader
        title="Captura territorial del mapa electoral"
        description={`${election.title} · ${election.territory}. Guarde borradores o envíe zonas al escrutinio; nada se publica hasta usar “Actualizar resultados”.`}
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
                <Badge variant="outline">{validationStatusLabel(zone.validation_status ?? "draft")}</Badge>
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
              <div className="mt-4 grid gap-2 text-xs">
                {Object.entries((zone.option_percentages ?? {}) as Record<string, number>).map(([key,value])=><div key={key}><div className="mb-1 flex justify-between"><span>{optionName(options??[],key)}</span><span>{Number(value).toFixed(2)}%</span></div><div className="h-1.5 rounded bg-slate-100"><div className="h-full rounded bg-[#b38a3c]" style={{width:`${Math.min(100,Number(value))}%`}}/></div></div>)}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Última edición interna: {formatDate(zone.updated_at ?? zone.public_updated_at)}
                {zone.published_at ? ` · Última publicación: ${formatDate(zone.published_at)}` : " · No publicado"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">Flujo: {validationStatusLabel(zone.validation_status ?? "draft")}</Badge>
                {["submitted","pending_validation"].includes(zone.validation_status ?? "")&&<><form action={validateElectionMapZone}><input type="hidden" name="election_id" value={id}/><input type="hidden" name="zone_id" value={zone.id}/><input type="hidden" name="status" value="validated"/><SubmitButton size="sm" pendingLabel="Validando…">Validar</SubmitButton></form><form action={validateElectionMapZone}><input type="hidden" name="election_id" value={id}/><input type="hidden" name="zone_id" value={zone.id}/><input type="hidden" name="status" value="pending_submission"/><SubmitButton size="sm" variant="outline" pendingLabel="Devolviendo…">Devolver</SubmitButton></form><form action={validateElectionMapZone}><input type="hidden" name="election_id" value={id}/><input type="hidden" name="zone_id" value={zone.id}/><input type="hidden" name="status" value="rejected"/><SubmitButton size="sm" variant="outline" pendingLabel="Rechazando…">Rechazar</SubmitButton></form></>}
              </div>
            </article>
          ))}
        </section>

        <aside className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold text-[#153553]">Registrar datos territoriales</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Guarde el avance como borrador o envíelo al escrutinio territorial. Los datos enviados no afectan resultados públicos hasta que se validen y se publique una actualización.
          </p>
          <form action={updateElectionMapZone} className="mt-4 grid gap-3">
            <input type="hidden" name="election_id" value={id} />
            <label className="grid gap-1 text-sm font-medium">
              Departamento
              <select name="department" defaultValue={VALLE_DEL_CAUCA_DEPARTMENT} className="h-9 rounded-md border px-3 text-sm">
                <option value={VALLE_DEL_CAUCA_DEPARTMENT}>{VALLE_DEL_CAUCA_DEPARTMENT}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Municipio / ciudad
              <select name="zone_name" required defaultValue="Cali" className="h-9 rounded-md border px-3 text-sm">
                {VALLE_DEL_CAUCA_MUNICIPALITIES.map((name)=><option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Zona electoral / territorio
              <Input name="zone_label" placeholder="Cabecera municipal, corregimiento, zona 1…" />
              <input type="hidden" name="zone_type" value="municipio" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Total esperado / final de la zona
              <Input name="expected_votes" type="number" min={1} defaultValue={100} required />
            </label>
            {options?.map((option)=><label key={option.id} className="grid gap-1 text-sm font-medium">Tarjeta Electoral {option.display_order} · {option.candidate_name}<Input name={`option_${option.id}`} type="number" min={0} defaultValue={0}/></label>)}
            <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Anulados<Input name="annulled_votes" type="number" min={0} defaultValue={0}/></label><label className="grid gap-1 text-sm font-medium">Rechazados/otros<Input name="rejected_votes" type="number" min={0} defaultValue={0}/></label></div>
            <p className="rounded border bg-slate-50 p-3 text-xs leading-5 text-muted-foreground">El sistema calcula porcentajes y avance automáticamente. Los conteos quedan reservados al panel interno; la vista pública solo lee la última foto publicada.</p>
            <div className="flex flex-wrap gap-2"><SubmitButton name="submit" value="submitted" pendingLabel="Enviando…">Enviar al escrutinio</SubmitButton><SubmitButton name="submit" value="draft" variant="outline" pendingLabel="Guardando…">Guardar borrador</SubmitButton></div>
          </form>
        </aside>
      </div>
    </>
  );
}

function optionName(options:Array<{id:string;candidate_name:string;display_order:number}>, key:string){const found=options.find((option)=>option.id===key);return found?`Tarjeta Electoral ${found.display_order}`:key;}

function validationStatusLabel(value: string) {
  return (
    {
      draft: "Borrador",
      pending_submission: "Pendiente de envío",
      submitted: "Enviado al escrutinio",
      pending_validation: "Pendiente de validación",
      validated: "Validado",
      rejected: "Rechazado",
      cancelled: "Cancelado",
      published: "Publicado",
    } as Record<string, string>
  )[value] ?? value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
