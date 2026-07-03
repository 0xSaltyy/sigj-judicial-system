"use client";

import { useState } from "react";
import { deleteElectionUpdateSnapshot } from "@/app/actions/elections";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function DeleteElectionUpdateForm({
  electionId,
  electionTitle,
  updateId,
  updateNumber,
  snapshotType,
  status,
  updatedAt,
  note,
}: {
  electionId: string;
  electionTitle: string;
  updateId: string;
  updateNumber: number;
  snapshotType: string;
  status: string;
  updatedAt: string;
  note?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  return (
    <div className="mt-4">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50">
          Eliminar actualización
        </button>
      ) : (
        <form action={deleteElectionUpdateSnapshot} className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
          <input type="hidden" name="election_id" value={electionId} />
          <input type="hidden" name="update_id" value={updateId} />
          <h3 className="font-semibold">Eliminar actualización electoral</h3>
          <p className="mt-2 leading-6">
            Esta acción eliminará completamente esta actualización del historial de resultados. No se convertirá en borrador ni quedará publicada. Esta acción no debe usarse para corregir resultados oficiales ya publicados sin autorización.
          </p>
          <dl className="mt-3 grid gap-1 rounded border border-red-200 bg-white/70 p-3 text-xs">
            <div><dt className="font-semibold">Actualización</dt><dd>#{updateNumber}</dd></div>
            <div><dt className="font-semibold">Elección</dt><dd>{electionTitle}</dd></div>
            <div><dt className="font-semibold">Fecha</dt><dd>{updatedAt}</dd></div>
            <div><dt className="font-semibold">Estado</dt><dd>{snapshotType} · {status}</dd></div>
            {note && <div><dt className="font-semibold">Nota</dt><dd>{note}</dd></div>}
          </dl>
          <label className="mt-3 grid gap-1 text-xs font-semibold">
            Razón de eliminación
            <Textarea name="reason" placeholder="Actualización de prueba con porcentajes incorrectos." className="min-h-16 bg-white text-red-950" />
          </label>
          <label className="mt-3 grid gap-1 text-xs font-semibold">
            Escriba ELIMINAR para confirmar
            <Input name="confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="bg-white text-red-950" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              Cancelar
            </button>
            <SubmitButton variant="destructive" pendingLabel="Eliminando…" className={confirmation === "ELIMINAR" ? "" : "pointer-events-none opacity-50"} confirmMessage="Esta acción eliminará definitivamente la actualización electoral seleccionada. ¿Continuar?">
              Eliminar definitivamente
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
