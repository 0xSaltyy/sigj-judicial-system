import { headers } from "next/headers";
import { updatePassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isTechnicalPreviewHostname, requestHostname, siteUrl } from "@/lib/site-url";

export default async function UpdatePasswordPage() {
  const requestHeaders = await headers();
  const preview = requestHeaders.get("x-sigj-preview") === "1" ||
    isTechnicalPreviewHostname(requestHostname(requestHeaders));

  return <><h1 className="text-3xl font-semibold text-[#102d49]">Nueva contraseña</h1><p className="mt-3 text-sm text-muted-foreground">{preview ? "Por seguridad, la actualización de contraseña solo está habilitada en el dominio oficial." : "Defina una contraseña de al menos ocho caracteres."}</p>{preview ? <Button asChild className="mt-7 h-11 w-full bg-[#153b5c]"><a href={siteUrl("/actualizar-password")}>Continuar en el dominio oficial</a></Button> : <form action={updatePassword} className="mt-7 space-y-4"><div className="space-y-2"><Label htmlFor="password">Nueva contraseña</Label><Input id="password" name="password" type="password" minLength={8} required className="h-11" /></div><Button className="h-11 w-full bg-[#153b5c]">Actualizar contraseña</Button></form>}</>;
}
