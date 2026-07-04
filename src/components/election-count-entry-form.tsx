"use client";

import { useMemo, useState } from "react";
import { saveElectionCountBatch } from "@/app/actions/elections";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; candidate_name: string; display_order: number };

export function ElectionCountEntryForm({
  electionId,
  expected,
  counted,
  inReview,
  options,
  defaults,
}: {
  electionId: string;
  expected: number;
  counted: number;
  inReview: number;
  options: Option[];
  defaults?: { option_counts?: Record<string, number> | null; annulled_votes?: number | null; rejected_votes?: number | null; note?: string | null } | null;
}) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const option of options) initial[option.id] = Number(defaults?.option_counts?.[option.id] ?? 0);
    initial.annulled_votes = Number(defaults?.annulled_votes ?? 0);
    initial.rejected_votes = Number(defaults?.rejected_votes ?? 0);
    return initial;
  });
  const added = useMemo(
    () => Object.values(values).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0),
    [values],
  );
  const before = counted + inReview;
  const after = before + added;
  const remaining = Math.max(0, expected - before);
  const over = added > remaining;
  const complete = after === expected;
  const update = (key: string, value: string) => setValues((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }));

  return (
    <form action={saveElectionCountBatch} className="grid gap-4 rounded-xl border bg-slate-50 p-4">
      <input type="hidden" name="election_id" value={electionId} />
      <div className="rounded border bg-white p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-[#153553]">Agregar votos al conteo general</p>
        {defaults && <p className="mt-1 rounded bg-amber-50 p-2 text-amber-900">Corrección sugerida desde un lote devuelto. Revise los valores antes de enviarlos nuevamente.</p>}
        <p>Total esperado: {expected.toLocaleString("es-CO")}</p>
        <p>Validado/publicado: {counted.toLocaleString("es-CO")} · En revisión: {inReview.toLocaleString("es-CO")} · Restante disponible: {remaining.toLocaleString("es-CO")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => (
          <label key={option.id} className="grid gap-1 text-sm font-medium">
            Tarjeta Electoral {option.display_order} · {option.candidate_name}
            <Input name={`option_${option.id}`} type="number" min={0} value={values[option.id] ?? 0} onChange={(event) => update(option.id, event.target.value)} />
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">Votos anulados<Input name="annulled_votes" type="number" min={0} value={values.annulled_votes ?? 0} onChange={(event) => update("annulled_votes", event.target.value)} /></label>
        <label className="grid gap-1 text-sm font-medium">Votos rechazados / no válidos<Input name="rejected_votes" type="number" min={0} value={values.rejected_votes ?? 0} onChange={(event) => update("rejected_votes", event.target.value)} /></label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Observación
        <Textarea name="note" defaultValue={defaults?.note ?? ""} placeholder="Origen del conteo, acta, mesa, observación o soporte interno." />
      </label>
      <div className={`rounded border p-3 text-xs ${over ? "border-red-200 bg-red-50 text-red-800" : complete ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-white text-muted-foreground"}`}>
        <p className="font-semibold text-current">Confirmar conteo a registrar</p>
        <p>Votos que se agregarán: {added.toLocaleString("es-CO")}</p>
        <p>Antes: {before.toLocaleString("es-CO")} / {expected.toLocaleString("es-CO")} contabilizados o en revisión</p>
        <p>Después: {after.toLocaleString("es-CO")} / {expected.toLocaleString("es-CO")}</p>
        <p>{over ? "No puede agregar más votos que el restante disponible." : complete ? "Estos votos completarían el 100% del conteo." : "Estos votos quedarán pendientes de revisión antes de contar públicamente."}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="submit" value="draft" variant="outline" pendingLabel="Guardando…" className={over ? "pointer-events-none opacity-50" : ""}>Guardar borrador</SubmitButton>
        <SubmitButton name="submit" value="submitted" pendingLabel="Enviando…" confirmMessage="Estos votos se enviarán a revisión. No se publicarán hasta que sean validados y se publique una actualización." className={over ? "pointer-events-none opacity-50" : ""}>Enviar a revisión</SubmitButton>
      </div>
    </form>
  );
}
