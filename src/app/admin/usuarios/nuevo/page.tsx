import { inviteUser } from "@/app/actions/users";
import { AdminPageHeader } from "@/components/admin-page";
import { DraftForm } from "@/components/draft-form";
import { SubmitButton } from "@/components/submit-button";
import { PermissionDeniedNotice } from "@/components/access-denied";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  APP_ROLES,
  ROLE_DESCRIPTIONS,
  type AppRole,
} from "@/lib/user-management";

type Dependency = {
  id: string;
  parent_id: string | null;
  name: string;
  type: string;
  level: number;
};
const headRoles: AppRole[] = [
  "MAGISTRADO_CORTE_SUPREMA",
  "MAGISTRADO_TRIBUNAL",
  "JUEZ_CIRCUITO",
  "JUEZ_MUNICIPAL",
];
const workerRoles: AppRole[] = [
  "SECRETARIO_DESPACHO",
  "OFICIAL_MAYOR",
  "RADICADOR",
  "ARCHIVO",
  "CONSULTA_PUBLICA",
];

function rootOf(id: string | null, values: Dependency[]) {
  const map = new Map(values.map((v) => [v.id, v]));
  let item = id ? map.get(id) : undefined;
  let root = item?.id ?? null;
  const seen = new Set<string>();
  while (item?.parent_id && !seen.has(item.id)) {
    seen.add(item.id);
    item = map.get(item.parent_id);
    root = item?.id ?? root;
  }
  return root;
}
function within(child: string, parent: string, values: Dependency[]) {
  const map = new Map(values.map((v) => [v.id, v]));
  let item = map.get(child);
  const seen = new Set<string>();
  while (item && !seen.has(item.id)) {
    if (item.id === parent) return true;
    seen.add(item.id);
    item = item.parent_id ? map.get(item.parent_id) : undefined;
  }
  return false;
}

export default async function InviteUserPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, query] = await Promise.all([
    requirePermission(PERMISSIONS.usersCreate),
    searchParams,
  ]);
  const admin = createAdminClient();
  const [{ data: allDependencies }, { data: allSupervisors }] = admin
    ? await Promise.all([
        admin
          .from("dependencies")
          .select("id,parent_id,name,type,level")
          .eq("is_active", true)
          .is("archived_at", null)
          .order("level")
          .order("name"),
        admin
          .from("profiles")
          .select("id,full_name,position_title,dependency_id,role")
          .eq("is_active", true)
          .neq("role", "CONSULTA_PUBLICA")
          .order("full_name"),
      ])
    : [{ data: [] }, { data: [] }];
  const tree = (allDependencies ?? []) as Dependency[];
  const profile = session.profile;
  const [canCreateInstitution, canCreateDependency] = await Promise.all([can(profile, "create_in_institution", "usuarios", { supabase: session.supabase }), can(profile, "create_in_dependency", "usuarios", { supabase: session.supabase })]);
  const actorRoot =
    profile.institution_id || rootOf(profile.dependency_id, tree);
  const dependencies = profile.is_owner
    ? tree
    : canCreateInstitution && actorRoot
      ? tree.filter((d) => within(d.id, actorRoot, tree))
      : canCreateDependency ? tree.filter((d) => d.id === profile.dependency_id) : [];
  const institutions = dependencies.filter(
    (d) => !d.parent_id || d.level === 1,
  );
  const roles = profile.is_owner
    ? APP_ROLES.filter((r) => r !== "CONSULTA_PUBLICA")
    : profile.role === "ADMIN_INSTITUCIONAL"
      ? APP_ROLES.filter((r) => r !== "SUPER_ADMIN")
      : headRoles.includes(profile.role)
        ? workerRoles
        : workerRoles;
  const supervisors = (allSupervisors ?? []).filter((s) =>
    dependencies.some((d) => d.id === s.dependency_id),
  );
  if (!profile.is_owner && !canCreateInstitution && !canCreateDependency) return <><AdminPageHeader title="Crear usuario interno" description="Alta activa con alcance institucional controlado."/><PermissionDeniedNotice>Puede abrir el módulo de usuarios, pero no tiene alcance para crear cuentas. Solicite “Crear en mi institución” o “Crear en mi dependencia/despacho”.</PermissionDeniedNotice></>;
  return (
    <>
      <AdminPageHeader
        title="Crear usuario interno"
        description="Alta activa con asignación institucional y alcance jerárquico controlado."
      />
      <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><p className="font-semibold">Alcance efectivo para esta alta</p><p className="mt-1">{profile.is_owner ? "Global: puede crear usuarios en cualquier institución o dependencia autorizada." : profile.role === "ADMIN_INSTITUCIONAL" ? `Mi institución: solo puede crear usuarios dentro de ${institutions[0]?.name || "su institución asignada"}.` : `Solo mi dependencia: ${dependencies[0]?.name || "sin dependencia asignada"}. No puede asignar otro despacho ni crear roles superiores.`}</p><p className="mt-2 text-xs">“Mi dependencia” es el despacho, juzgado, sala u oficina del perfil. “Mi institución” es su corporación superior. “Global” comprende toda la estructura autorizada.</p></div>
      {query.error && (
        <p className="mb-5 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {query.error} Los campos no sensibles se conservaron; vuelva a
          escribir la contraseña temporal.
        </p>
      )}
      <Card className="max-w-5xl">
        <CardContent>
          <DraftForm
            action={inviteUser}
            storageKey="sigj:user:new"
            className="grid gap-5 md:grid-cols-2"
          >
            <Field label="Nombre completo *" name="full_name" />
            <Field
              label="Correo institucional privado *"
              name="email"
              type="email"
            />
            <Select
              label="Rol *"
              name="role"
              required
              options={roles.map((role) => ({
                value: role,
                label: ROLE_DESCRIPTIONS[role].label,
              }))}
              helper="La cuenta propietaria no se crea desde este formulario."
            />
            <Select
              label="Institución / corporación"
              name="institution_id"
              options={institutions.map((d) => ({
                value: d.id,
                label: d.name,
              }))}
              empty="Se determina por la dependencia"
            />
            <Select
              label="Dependencia / despacho / sala"
              name="dependency_id"
              options={dependencies.map((d) => ({
                value: d.id,
                label: `${"— ".repeat(Math.max(0, d.level - 1))}${d.name}`,
              }))}
              empty="Sin asignar"
              helper="Asignar despacho"
            />
            <Select
              label="Superior, juez o magistrado responsable"
              name="supervisor_id"
              options={supervisors.map((s) => ({
                value: s.id,
                label: `${s.full_name}${s.position_title ? ` · ${s.position_title}` : ""}`,
              }))}
              empty="Sin superior directo"
            />
            <Field label="Cargo" name="position_title" required={false} />
            <Select
              label="Método de alta"
              name="creation_method"
              required
              options={[
                { value: "temporary_password", label: "Crear usuario activo" },
              ]}
              helper="El usuario podrá iniciar sesión inmediatamente con la contraseña temporal."
            />
            <Field
              label="Contraseña temporal (mín. 8) *"
              name="temporary_password"
              type="password"
            />
            <Select
              label="Estado inicial"
              name="is_active"
              required
              options={[
                { value: "true", label: "Activo" },
                { value: "false", label: "Inactivo" },
              ]}
            />
            <label className="flex items-start gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                name="public_profile"
                value="true"
                className="mt-1"
              />
              <span>
                Mostrar nombre, cargo y foto en el panel público de la
                institución. El correo nunca se publica.
              </span>
            </label>
            {profile.is_owner && <label className="flex items-start gap-2 text-sm md:col-span-2"><input type="checkbox" name="is_dependency_leader" value="true" className="mt-1"/><span><strong>Juez/Magistrado del despacho o responsable de oficina.</strong> Identifica a la persona responsable; crear personal seguirá requiriendo el permiso correspondiente.</span></label>}
            <div className="flex items-end justify-end md:col-span-2">
              <SubmitButton pendingLabel="Creando usuario…">
                Crear usuario activo
              </SubmitButton>
            </div>
          </DraftForm>
        </CardContent>
      </Card>
    </>
  );
}
function Field({
  label,
  name,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}
function Select({
  label,
  name,
  options,
  empty,
  helper,
  required = false,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  empty?: string;
  helper?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        required={required}
        className="h-9 w-full rounded-md border px-3 text-sm"
      >
        {empty && <option value="">{empty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
