import { recoverPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
export const metadata = { title: "Recuperar contraseña" };
export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) { const query = await searchParams; return <><h1 className="text-3xl font-semibold text-[#102d49]">Recuperar contraseña</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Enviaremos un enlace de recuperación al correo asociado a su perfil.</p>{query.sent && <Alert className="mt-5 border-emerald-200 bg-emerald-50"><AlertDescription>Si el correo existe, recibirá instrucciones en unos minutos.</AlertDescription></Alert>}{query.error && <Alert variant="destructive" className="mt-5"><AlertDescription>{query.error}</AlertDescription></Alert>}<form action={recoverPassword} className="mt-7 space-y-4"><div className="space-y-2"><Label htmlFor="email">Correo institucional</Label><Input id="email" name="email" type="email" required className="h-11" /></div><Button className="h-11 w-full bg-[#153b5c]">Enviar enlace seguro</Button></form></>; }
