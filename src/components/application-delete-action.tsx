"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteRoleplayApplication } from "@/app/actions/applications";
import { Button } from "@/components/ui/button";

export function ApplicationDeleteAction({
  id,
  applicantName,
  trackingCode,
}: {
  id: string;
  applicantName: string;
  trackingCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [checked, setChecked] = useState(false);
  const [pending, startTransition] = useTransition();
  const canSubmit = checked && confirmation === "ELIMINAR POSTULACION" && !pending;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-2 rounded-none border-red-300 text-red-800 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" /> Eliminar
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#06192b]/70 p-4" role="dialog" aria-modal="true" aria-labelledby={`delete-application-${id}`}>
          <div className="w-full max-w-lg border border-red-300 bg-[#fffdf8] shadow-[0_24px_70px_rgba(6,25,43,.35)]">
            <div className="border-b border-red-200 bg-red-50 p-5">
              <h2 id={`delete-application-${id}`} className="font-serif text-xl font-semibold text-red-950">
                Eliminar postulación permanentemente
              </h2>
              <p className="mt-2 text-sm leading-6 text-red-900">
                Esta acción es exclusiva del OWNER y no se puede deshacer.
              </p>
            </div>
            <div className="grid gap-4 p-5 text-sm">
              <div className="border border-[#cfd6dc] bg-white p-4">
                <p><span className="font-semibold">Postulante:</span> {applicantName}</p>
                <p className="mono-number mt-1"><span className="font-sans font-semibold">Código:</span> {trackingCode}</p>
              </div>
              <p className="leading-6 text-slate-700">
                Se eliminará el registro de la postulación y se intentará borrar cualquier adjunto privado vinculado. Se conservará únicamente un tombstone mínimo en auditoría.
              </p>
              <label className="flex gap-3 border border-amber-300 bg-amber-50 p-3 text-amber-950">
                <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="mt-1" />
                <span>Confirmo que entiendo que esta eliminación permanente no puede recuperarse.</span>
              </label>
              <label className="grid gap-2">
                <span className="font-semibold text-[#0a2540]">Escriba exactamente: ELIMINAR POSTULACION</span>
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="h-10 border border-[#9aa8b5] bg-white px-3 outline-none focus:border-[#005ea8] focus:ring-3 focus:ring-[#005ea8]/15"
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-[#cfd6dc] bg-[#f7f1e5] p-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <form
                action={(formData) => {
                  startTransition(() => deleteRoleplayApplication(formData));
                }}
              >
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="applicant_name" value={applicantName} />
                <input type="hidden" name="tracking_code" value={trackingCode} />
                <input type="hidden" name="confirmation" value={confirmation} />
                <input type="hidden" name="reason" value="Eliminación permanente confirmada desde panel de postulaciones" />
                <Button type="submit" variant="destructive" disabled={!canSubmit} className="gap-2 rounded-none">
                  <Trash2 className="size-4" /> {pending ? "Eliminando…" : "Eliminar definitivamente"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
