"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CasesError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-amber-950">
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-5" />
        <h1 className="text-lg font-semibold">
          No fue posible cargar los expedientes
        </h1>
      </div>
      <p className="mt-3 text-sm">
        La consulta no pudo completarse. Sus permisos y datos permanecen
        protegidos; puede intentar nuevamente o volver al listado.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={reset} className="gap-2">
          <RotateCcw className="size-4" /> Intentar nuevamente
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/dashboard">Volver al panel</Link>
        </Button>
      </div>
    </div>
  );
}
