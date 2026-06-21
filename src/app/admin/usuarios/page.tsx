import Link from "next/link";
import Image from "next/image";
import { KeyRound, LockKeyhole, ShieldCheck, UserPlus } from "lucide-react";
import { sendPasswordSetup, updateManagedUser } from "@/app/actions/users";
import { AdminPageHeader } from "@/components/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { can, requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { profileAssetDataUrl } from "@/lib/profile-assets";
import {
  APP_ROLES,
  ROLE_DESCRIPTIONS,
  maskEmail,
  type AppRole,
} from "@/lib/user-management";
import { judicialResponsibilityLabel } from "@/lib/institutional-language";

type Query = { error?: string; success?: string };
type Dep = {
  id: string;
  parent_id: string | null;
  name: string;
  level: number;
};
function rootOf(id: string | null, values: Dep[]) {
  const map = new Map(values.map((v) => [v.id, v]));
  let i = id ? map.get(id) : undefined;
  let root = i?.id ?? null;
  const seen = new Set<string>();
  while (i?.parent_id && !seen.has(i.id)) {
    seen.add(i.id);
    i = map.get(i.parent_id);
    root = i?.id ?? root;
  }
  return root;
}
function within(child: string | null, parent: string | null, values: Dep[]) {
  if (!child || !parent) return false;
  const map = new Map(values.map((v) => [v.id, v]));
  let i = map.get(child);
  const seen = new Set<string>();
  while (i && !seen.has(i.id)) {
    if (i.id === parent) return true;
    seen.add(i.id);
    i = i.parent_id ? map.get(i.parent_id) : undefined;
  }
  return false;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const [session, query] = await Promise.all([
    requirePermission({ resource: "usuarios", action: "view" }),
    searchParams,
  ]);
  const admin = createAdminClient();
  const [{ data: allProfiles, error }, { data: allDependencies }] = admin
    ? await Promise.all([
        admin
          .from("profiles")
          .select(
            "id,full_name,email,role,institution_id,dependency_id,supervisor_id,position_title,is_active,is_owner,public_profile,last_access_at,created_at,avatar_path,is_dependency_leader",
          )
          .order("is_owner", { ascending: false })
          .order("full_name"),
        admin
          .from("dependencies")
          .select("id,parent_id,name,level")
          .eq("is_active", true)
          .is("archived_at", null)
          .order("level")
          .order("name"),
      ])
    : [{ data: [], error: null }, { data: [] }];
  const deps = (allDependencies ?? []) as Dep[];
  const [canViewAll, canViewDependency, canCreateUsers, canEditUsers, canAssignRole, canAssignDependency, canDeactivate, canReactivate, canAssignLeader] = await Promise.all([
    can(session.profile, "view_all", "usuarios", { supabase: session.supabase }), can(session.profile, "view_dependency", "usuarios", { supabase: session.supabase }),
    can(session.profile, "create", "usuarios", { supabase: session.supabase }), can(session.profile, "edit", "usuarios", { supabase: session.supabase }),
    can(session.profile, "assign_role", "usuarios", { supabase: session.supabase }), can(session.profile, "assign_dependency", "usuarios", { supabase: session.supabase }),
    can(session.profile, "deactivate", "usuarios", { supabase: session.supabase }), can(session.profile, "reactivate", "usuarios", { supabase: session.supabase }),
    can(session.profile, "assign_leader", "dependencias", { supabase: session.supabase }),
  ]);
  const actorRoot =
    session.profile.institution_id ||
    rootOf(session.profile.dependency_id, deps);
  const scopedProfiles = (allProfiles ?? []).filter(
    (item) =>
      session.profile.is_owner || canViewAll ||
      (session.profile.role === "ADMIN_INSTITUCIONAL"
        ? within(item.dependency_id || item.institution_id, actorRoot, deps)
        : canViewDependency && item.dependency_id === session.profile.dependency_id),
  );
  const profiles = await Promise.all(
    scopedProfiles.map(async (item) => ({
      ...item,
      avatar: item.avatar_path
        ? await profileAssetDataUrl(item.avatar_path)
        : null,
    })),
  );
  const allowedDeps = session.profile.is_owner
    ? deps
    : session.profile.role === "ADMIN_INSTITUCIONAL"
      ? deps.filter((d) => within(d.id, actorRoot, deps))
      : deps.filter((d) => d.id === session.profile.dependency_id);
  const names = new Map(deps.map((d) => [d.id, d.name]));
  const profileNames = new Map(
    (allProfiles ?? []).map((p) => [p.id, p.full_name]),
  );
  return (
    <>
      <AdminPageHeader
        title="Usuarios internos"
        description="Directorio institucional con asignación por corporación, despacho y superior responsable."
        action={
          <div className="flex flex-wrap gap-2">
            {session.profile.is_owner&&<Button asChild variant="outline">
              <Link href="/admin/roles">Roles y permisos</Link>
            </Button>}
            {canCreateUsers&&<Button asChild className="gap-2 bg-[#153b5c]">
              <Link href="/admin/usuarios/nuevo">
                <UserPlus className="size-4" /> Agregar miembro
              </Link>
            </Button>}
          </div>
        }
      />
      {query.error && <Message tone="error">{query.error}</Message>}
      {query.success && <Message tone="success">{query.success}</Message>}
      {error && (
        <Message tone="error">No fue posible cargar los usuarios.</Message>
      )}
      <div className="mb-5 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <ShieldCheck className="size-5 shrink-0" />
        <p>
          Los correos permanecen privados y se enmascaran. Cada alta,
          reasignación, cambio de rol o estado queda auditado. La cuenta
          propietaria no puede ser modificada.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Miembro</TableHead>
              <TableHead>Rol y asignación</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Gestión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((item) => {
              const role = item.role as AppRole;
              return (
                <TableRow key={item.id}>
                  <TableCell className="min-w-64 align-top">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-[#173b5e] text-xs font-bold text-white">
                        {item.avatar ? <Image src={item.avatar} alt="" width={40} height={40} unoptimized className="size-full object-cover" /> : item.full_name
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((p: string) => p[0])
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-[#153553]">
                          {item.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.is_owner
                            ? "Correo protegido"
                            : maskEmail(item.email)}
                        </p>
                      </div>
                      {item.is_owner && (
                        <Badge className="gap-1 bg-amber-50 text-amber-900">
                          <LockKeyhole className="size-3" /> Protegida
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.position_title || "Sin cargo registrado"}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-72 align-top">
                    <Badge
                      variant="outline"
                      className="mono-number bg-slate-50 text-[10px]"
                    >
                      {role}
                    </Badge>
                    <p className="mt-2 text-xs font-medium">
                      {ROLE_DESCRIPTIONS[role]?.label ?? role}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.institution_id
                        ? names.get(item.institution_id)
                        : "Institución sin registrar"}{" "}
                      ·{" "}
                      {item.dependency_id
                        ? names.get(item.dependency_id)
                        : "Sin despacho"}
                    </p>
                    {item.is_dependency_leader && <Badge className="mt-2 bg-blue-50 text-blue-900">{judicialResponsibilityLabel(role)}</Badge>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Superior:{" "}
                      {item.supervisor_id
                        ? (profileNames.get(item.supervisor_id) ??
                          "No disponible")
                        : "Sin asignar"}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      className={
                        item.is_active
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-red-50 text-red-800"
                      }
                    >
                      {item.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Perfil público: {item.public_profile ? "Sí" : "No"}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-[410px] align-top">
                    {item.is_owner ? (
                      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs">
                        Cuenta protegida contra baja, degradación y
                        reasignación.
                      </div>
                    ) : (
                      <>
                        {canEditUsers&&<details>
                          <summary className="cursor-pointer text-xs font-semibold text-[#153b5c]">
                            Editar acceso y asignación
                          </summary>
                          <form
                            action={updateManagedUser}
                            className="mt-3 grid gap-3 rounded border bg-slate-50 p-3 sm:grid-cols-2"
                          >
                            <input
                              type="hidden"
                              name="target_id"
                              value={item.id}
                            />
                            <Input
                              name="full_name"
                              defaultValue={item.full_name}
                              required
                            />
                            <Input
                              name="position_title"
                              defaultValue={item.position_title ?? ""}
                              placeholder="Cargo"
                            />
                            <select
                              name="role"
                              defaultValue={role}
                              disabled={!canAssignRole}
                              className="h-9 rounded-md border bg-white px-3 text-xs"
                            >
                              {APP_ROLES.filter(
                                (r) =>
                                  session.profile.is_owner ||
                                  r !== "SUPER_ADMIN",
                              ).map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                            {!canAssignRole&&<input type="hidden" name="role" value={role}/>}
                            <select
                              name="institution_id"
                              defaultValue={item.institution_id ?? ""}
                              className="h-9 rounded-md border bg-white px-3 text-xs"
                            >
                              <option value="">
                                Institución por dependencia
                              </option>
                              {allowedDeps
                                .filter((d) => !d.parent_id || d.level === 1)
                                .map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                            </select>
                            <select
                              name="dependency_id"
                              defaultValue={item.dependency_id ?? ""}
                              disabled={!canAssignDependency}
                              className="h-9 rounded-md border bg-white px-3 text-xs"
                            >
                              <option value="">Sin despacho</option>
                              {allowedDeps.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                            {!canAssignDependency && (
                              <input type="hidden" name="dependency_id" value={item.dependency_id ?? ""} />
                            )}
                            <select
                              name="supervisor_id"
                              defaultValue={item.supervisor_id ?? ""}
                              className="h-9 rounded-md border bg-white px-3 text-xs"
                            >
                              <option value="">Sin superior</option>
                              {profiles
                                .filter((p) => p.id !== item.id && p.is_active)
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.full_name}
                                  </option>
                                ))}
                            </select>
                            <select
                              name="is_active"
                              defaultValue={String(item.is_active)}
                              disabled={item.is_active?!canDeactivate:!canReactivate}
                              className="h-9 rounded-md border bg-white px-3 text-xs"
                            >
                              <option value="true">Activo</option>
                              <option value="false">Inactivo</option>
                            </select>
                            {(item.is_active ? !canDeactivate : !canReactivate) && (
                              <input type="hidden" name="is_active" value={String(item.is_active)} />
                            )}
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                name="public_profile"
                                value="true"
                                defaultChecked={item.public_profile}
                              />{" "}
                              Perfil público
                            </label>
                            {canAssignLeader ? (
                              <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="is_dependency_leader" value="true" defaultChecked={item.is_dependency_leader}/> {judicialResponsibilityLabel(role)}</label>
                            ) : (
                              <input type="hidden" name="is_dependency_leader" value={String(item.is_dependency_leader)} />
                            )}
                            <Button
                              type="submit"
                              size="sm"
                              className="bg-[#153b5c]"
                            >
                              Guardar cambio
                            </Button>
                          </form>
                        </details>}
                        {session.profile.is_owner&&<Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="mt-3"
                        >
                          <Link href={`/admin/usuarios/${item.id}/permisos`}>
                            <ShieldCheck className="size-3.5" /> Permisos
                            personalizados
                          </Link>
                        </Button>}
                      </>
                    )}
                    {canEditUsers&&<form action={sendPasswordSetup} className="mt-3">
                      <input type="hidden" name="target_id" value={item.id} />
                      <Button type="submit" variant="outline" size="sm">
                        <KeyRound className="size-3.5" /> Enviar configuración
                        de contraseña
                      </Button>
                    </form>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!profiles.length && !error && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No hay perfiles disponibles para su alcance.
          </p>
        )}
      </div>
    </>
  );
}
function Message({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "success";
}) {
  return (
    <p
      className={`mb-5 rounded border p-4 text-sm ${tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
    >
      {children}
    </p>
  );
}
