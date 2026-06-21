import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessDenied({ title = "Acceso no autorizado", message = "No tiene permiso para acceder a este recurso.", backHref }: { title?: string; message?: string; backHref?: string }) {
  return <div className="mx-auto grid min-h-[480px] max-w-xl place-items-center px-4 text-center"><div><div className="mx-auto grid size-16 place-items-center rounded-full bg-red-50 text-red-700"><ShieldX className="size-8" /></div><h1 className="mt-6 text-3xl font-semibold text-[#102d49]">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p><div className="mt-6 flex justify-center gap-2">{backHref && <Button asChild variant="outline"><Link href={backHref}>Volver a la lista</Link></Button>}<Button asChild className="bg-[#153b5c]"><Link href="/admin/dashboard">Volver al panel</Link></Button><Button asChild variant="ghost"><Link href="/">Ir a inicio</Link></Button></div></div></div>;
}

export function PermissionDeniedNotice({ children = "No tiene permiso para realizar esta acción." }: { children?: React.ReactNode }) { return <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{children}</div>; }
export function NotAvailableForProfile({ children = "Este registro no está disponible para su perfil." }: { children?: React.ReactNode }) { return <AccessDenied title="Recurso no disponible" message={String(children)} />; }
export function ModuleUnavailableNotice({ module }: { module: string }) { return <PermissionDeniedNotice>El módulo {module} no está habilitado para su perfil.</PermissionDeniedNotice>; }
export function AccountDisabledNotice() { return <AccessDenied title="Cuenta desactivada" message="Su cuenta institucional está desactivada. La sesión se conserva; contacte al administrador para solicitar la reactivación." />; }
