import Link from "next/link";
import { headers } from "next/headers";
import { ExternalLink, LockKeyhole, Mail, ShieldAlert } from "lucide-react";
import { login } from "@/app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isTechnicalPreviewHostname, requestHostname, siteUrl } from "@/lib/site-url";

export const metadata = { title: "Acceso institucional" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  const [query, requestHeaders] = await Promise.all([searchParams, headers()]);
  const preview = requestHeaders.get("x-sigj-preview") === "1" ||
    isTechnicalPreviewHostname(requestHostname(requestHeaders));

  return <><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#9b762f]">{preview ? "Vista previa técnica" : "Área institucional privada"}</p><h2 className="mt-2 text-3xl font-semibold text-[#102d49]">Iniciar sesión</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{preview ? "Por seguridad, el inicio de sesión solo está habilitado en el dominio oficial." : "Ingrese con las credenciales asignadas por la administración."}</p></div>{query.error && !preview && <Alert variant="destructive" className="mt-5"><AlertDescription>{query.error}</AlertDescription></Alert>}{query.updated && !preview && <Alert className="mt-5 border-emerald-200 bg-emerald-50"><AlertDescription>Contraseña actualizada. Ya puede ingresar.</AlertDescription></Alert>}{preview ? <div className="mt-7 space-y-4"><Alert className="border-amber-300 bg-amber-50 text-amber-950"><ShieldAlert className="size-4" /><AlertDescription>No ingrese credenciales en este dominio de vista previa.</AlertDescription></Alert><Button asChild className="h-11 w-full bg-[#153b5c]"><a href={siteUrl("/login")}>Ir al dominio oficial <ExternalLink className="size-4" /></a></Button></div> : <form action={login} className="mt-7 space-y-5"><div className="space-y-2"><Label htmlFor="email">Correo institucional</Label><div className="relative"><Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input id="email" name="email" type="email" autoComplete="email" required placeholder="usuario@institucion.gov.co" className="h-11 pl-9" /></div></div><div className="space-y-2"><div className="flex justify-between"><Label htmlFor="password">Contraseña</Label><Link href="/recuperar-password" className="text-xs font-semibold text-[#806024]">¿Olvidó su contraseña?</Link></div><div className="relative"><LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11 pl-9" /></div></div><Button type="submit" className="h-11 w-full bg-[#153b5c]">Ingresar al sistema</Button></form>}</>;
}
