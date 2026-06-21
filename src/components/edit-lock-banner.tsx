"use client";

import { useEffect, useState, useTransition } from "react";
import { LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { acquireEditLock, heartbeatEditLock, releaseEditLock, type EditLockState } from "@/app/actions/edit-locks";
import { Button } from "@/components/ui/button";

export function EditLockBanner({ recordType, recordId, initial, canTakeControl = false }: {
  recordType: "proceeding" | "hearing_minute" | "case" | "case_action" | "document";
  recordId: string;
  initial: EditLockState;
  canTakeControl?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!state.acquired) return;
    const heartbeat = window.setInterval(() => void heartbeatEditLock(recordType, recordId), 60_000);
    return () => {
      window.clearInterval(heartbeat);
      void releaseEditLock(recordType, recordId);
    };
  }, [recordId, recordType, state.acquired]);

  if (state.acquired) {
    return <div className="no-print mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900"><ShieldCheck className="size-4" /> Edición protegida para su sesión. El bloqueo se libera al guardar, salir o tras cuatro minutos sin actividad.</div>;
  }
  const expired = state.expiresAt ? new Date(state.expiresAt) <= new Date() : false;
  return (
    <div className="no-print mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status">
      <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">Este documento está siendo editado por {state.lockedBy ?? "otro usuario"}{state.lockedAt ? ` desde ${new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" }).format(new Date(state.lockedAt))}` : ""}.</p><p className="mt-1 text-xs">La vista permanece en solo lectura para proteger cambios sin guardar.</p></div></div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}><RefreshCw className="size-4" /> Solicitar actualización</Button>
        {(expired || canTakeControl) && <Button type="button" size="sm" disabled={pending} onClick={() => startTransition(async () => { const next = await acquireEditLock(recordType, recordId, true); setState(next); router.refresh(); })}>Tomar control</Button>}
      </div>
    </div>
  );
}
