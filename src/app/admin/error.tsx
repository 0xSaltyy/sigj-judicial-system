"use client";

import { useEffect } from "react";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Admin route error", error.digest || error.name); }, [error]);
  return <div><AccessDenied title="No fue posible abrir el recurso" message="La operación no pudo completarse. Su sesión continúa activa; vuelva al panel o intente cargar nuevamente." /><div className="-mt-16 mb-8 text-center"><Button type="button" onClick={reset} variant="outline">Intentar nuevamente</Button></div></div>;
}
