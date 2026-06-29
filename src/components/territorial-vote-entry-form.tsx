"use client";

import { useMemo, useState } from "react";
import { saveElectionCityVoteBatch } from "@/app/actions/elections";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";

type Option = { id: string; candidate_name: string; display_order: number };

export function TerritorialVoteEntryForm({
  electionId,
  city,
  expected,
  validated,
  inReview,
  options,
  correctionOf,
  defaults,
}: {
  electionId: string;
  city: string;
  expected: number;
  validated: number;
  inReview: number;
  options: Option[];
  correctionOf?: string | null;
  defaults?: { option_counts?: Record<string, number>; annulled_votes?: number; rejected_votes?: number } | null;
}) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const option of options) initial[option.id] = Number(defaults?.option_counts?.[option.id] ?? 0);
    initial.annulled_votes = Number(defaults?.annulled_votes ?? 0);
    initial.rejected_votes = Number(defaults?.rejected_votes ?? 0);
    return initial;
  });
  const added = useMemo(() => Object.values(values).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0), [values]);
  const before = validated + inReview;
  const after = before + added;
  const remaining = Math.max(0, expected - before);
  const over = added > remaining;
  const complete = after === expected;
  const update = (key: string, value: string) => setValues((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }));

  return (
    <form action={saveElectionCityVoteBatch} className="mt-3 grid gap-3 rounded-xl border bg-slate-50 p-4">
      <input type="hidden" name="election_id" value={electionId} />
      <input type="hidden" name="city" value={city} />
      {correctionOf && <input type="hidden" name="correction_of" value={correctionOf} />}
      <div className="rounded border bg-white p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-[#153553]">Agregar votos nuevos</p>
        <p>Ciudad: {city}</p>
        <p>Total esperado: {expected.toLocaleString("es-CO")}</p>
        <p>Ya validado: {validated.toLocaleString("es-CO")} · En revisión: {inReview.toLocaleString("es-CO")} · Restante disponible: {remaining.toLocaleString("es-CO")}</p>
      </div>
      {options.map((option) => (
        <label key={option.id} className="grid gap-1 text-sm font-medium">
          Tarjeta Electoral {option.display_order} · {option.candidate_name}
          <Input name={`option_${option.id}`} type="number" min={0} value={values[option.id] ?? 0} onChange={(event) => update(option.id, event.target.value)} />
        </label>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">Anulados<Input name="annulled_votes" type="number" min={0} value={values.annulled_votes ?? 0} onChange={(event) => update("annulled_votes", event.target.value)} /></label>
        <label className="grid gap-1 text-sm font-medium">Rechazados/otros<Input name="rejected_votes" type="number" min={0} value={values.rejected_votes ?? 0} onChange={(event) => update("rejected_votes", event.target.value)} /></label>
      </div>
      <div className={`rounded border p-3 text-xs ${over ? "border-red-200 bg-red-50 text-red-800" : complete ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-white text-muted-foreground"}`}>
        <p className="font-semibold text-current">Confirmar votos a agregar</p>
        <p>Votos que se agregarán: {added.toLocaleString("es-CO")}</p>
        <p>Antes: {before.toLocaleString("es-CO")} / {expected.toLocaleString("es-CO")} contabilizados</p>
        <p>Después: {after.toLocaleString("es-CO")} / {expected.toLocaleString("es-CO")} contabilizados</p>
        <p>{over ? "No puede agregar más votos que el restante de la ciudad." : complete ? "Estos votos completarían el 100% de la ciudad." : "Estos votos dejarían la ciudad en conteo parcial."}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="submit" value="draft" variant="outline" pendingLabel="Guardando…" className={over ? "pointer-events-none opacity-50" : ""}>Guardar borrador</SubmitButton>
        <SubmitButton name="submit" value="submitted" pendingLabel="Enviando…" confirmMessage="Estos votos se enviarán a revisión. No se publicarán hasta que sean validados y se publique una actualización." className={over ? "pointer-events-none opacity-50" : ""}>Enviar a revisión</SubmitButton>
      </div>
    </form>
  );
}
