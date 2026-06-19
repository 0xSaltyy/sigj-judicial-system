import { updatePassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default function UpdatePasswordPage() { return <><h1 className="text-3xl font-semibold text-[#102d49]">Nueva contraseña</h1><p className="mt-3 text-sm text-muted-foreground">Defina una contraseña de al menos ocho caracteres.</p><form action={updatePassword} className="mt-7 space-y-4"><div className="space-y-2"><Label htmlFor="password">Nueva contraseña</Label><Input id="password" name="password" type="password" minLength={8} required className="h-11" /></div><Button className="h-11 w-full bg-[#153b5c]">Actualizar contraseña</Button></form></>; }
