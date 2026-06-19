import { inviteUser } from "@/app/actions/users";
import { AdminPageHeader } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireOwner } from "@/lib/auth/authorization";
import { APP_ROLES, ROLE_DESCRIPTIONS } from "@/lib/user-management";

export default async function InviteUserPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ supabase }, query] = await Promise.all([requireOwner(), searchParams]);
  const { data: dependencies } = await supabase.from("dependencies").select("id,name").eq("is_active", true).order("name");
  return <>
    <AdminPageHeader title="Invitar usuario interno" description="Solo el propietario puede crear cuentas. Supabase enviará un enlace seguro para establecer la contraseña." />
    {query.error && <p className="mb-5 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{query.error}</p>}
    <Card className="max-w-4xl"><CardContent><form action={inviteUser} className="grid gap-5 md:grid-cols-2"><Field label="Nombre completo" name="full_name" /><Field label="Correo institucional privado" name="email" type="email" /><div className="space-y-2"><Label htmlFor="role">Rol</Label><select id="role" name="role" required className="h-9 w-full rounded-md border px-3 text-sm">{APP_ROLES.map((role) => <option key={role} value={role}>{ROLE_DESCRIPTIONS[role].label}</option>)}</select><p className="text-xs text-muted-foreground">La cuenta propietaria no se crea desde este formulario.</p></div><div className="space-y-2"><Label htmlFor="dependency_id">Institución, corte o despacho</Label><select id="dependency_id" name="dependency_id" className="h-9 w-full rounded-md border px-3 text-sm"><option value="">Sin asignar</option>{(dependencies ?? []).map((dependency) => <option key={dependency.id} value={dependency.id}>{dependency.name}</option>)}</select></div><Field label="Cargo" name="position_title" required={false} /><div className="flex items-end justify-end"><Button type="submit" className="bg-[#153b5c]">Enviar invitación</Button></div></form></CardContent></Card>
  </>;
}

function Field({ label, name, type = "text", required = true }: { label: string; name: string; type?: string; required?: boolean }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} /></div>; }
