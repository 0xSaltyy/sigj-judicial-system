"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin route render error", error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-4 py-12">
      <section className="rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-800">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#102d49]">No fue posible cargar esta sección administrativa</h1>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              La operación pudo haberse guardado, pero la vista encontró un error al actualizarse. Intente recargar la sección; si persiste, revise la consola o los logs del deployment.
            </p>
            {error.digest ? <p className="mono-number mt-3 text-xs text-slate-500">Referencia: {error.digest}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" onClick={reset} className="gap-2 bg-[#153b5c]">
                <RotateCcw className="size-4" />
                Reintentar
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/dashboard">Volver al dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
