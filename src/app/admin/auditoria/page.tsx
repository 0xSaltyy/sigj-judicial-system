import { History } from "lucide-react";
import Link from "next/link";
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
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type Query = {
  module?: string;
  action?: string;
  user?: string;
  dependency?: string;
  from?: string;
  to?: string;
};
function summarize(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  const safe = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([key]) =>
        ![
          "email",
          "id",
          "created_at",
          "updated_at",
          "signature_data",
          "token_hash",
        ].includes(key),
    ),
  );
  return Object.keys(safe).length ? JSON.stringify(safe) : "—";
}
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const [session, query] = await Promise.all([
    requirePermission(PERMISSIONS.auditView),
    searchParams,
  ]);
  const { supabase, profile } = session;
  const admin = createAdminClient();
  const [{ data: profiles }, { data: dependencies }] = admin
    ? await Promise.all([
        admin.from("profiles").select("id,full_name,dependency_id,is_owner"),
        admin.from("dependencies").select("id,name").order("name"),
      ])
    : [{ data: [] }, { data: [] }];
  let request = supabase
    .from("audit_logs")
    .select(
      "id,user_id,target_user_id,action,table_name,description,old_values,new_values,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (query.module) request = request.eq("table_name", query.module);
  if (query.action) request = request.ilike("action", `%${query.action}%`);
  if (query.user)
    request = request.or(
      `user_id.eq.${query.user},target_user_id.eq.${query.user}`,
    );
  if (query.from)
    request = request.gte("created_at", `${query.from}T00:00:00Z`);
  if (query.to)
    request = request.lte("created_at", `${query.to}T23:59:59.999Z`);
  const { data: rawLogs, error } = await request;
  const names = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p.is_owner ? "Lilith D'Amico" : p.full_name,
    ]),
  );
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const logs = (rawLogs ?? []).filter((log) => {
    if (profile.is_owner)
      return (
        !query.dependency ||
        profileById.get(log.user_id ?? "")?.dependency_id ===
          query.dependency ||
        profileById.get(log.target_user_id ?? "")?.dependency_id ===
          query.dependency
      );
    const actor = profileById.get(log.user_id ?? "");
    const target = profileById.get(log.target_user_id ?? "");
    return (
      actor?.dependency_id === profile.dependency_id ||
      target?.dependency_id === profile.dependency_id
    );
  });
  const canExport = await can(profile, "export", "auditoria", { supabase });
  return (
    <>
      <AdminPageHeader
        title="Logs y auditoría"
        description="Trazabilidad interna filtrable. Los logs técnicos nunca forman parte de documentos formales."
        action={
          canExport ? (
            <Button asChild variant="outline">
              <Link href="/admin/auditoria/exportar">
                <History className="size-4" /> Exportar informe interno
              </Link>
            </Button>
          ) : (
            <Button disabled title="No tiene permiso para exportar auditoría">
              Exportar informe
            </Button>
          )
        }
      />
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          No fue posible consultar los logs.
        </p>
      )}
      <form className="mb-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Módulo o tabla
          <Input name="module" defaultValue={query.module} placeholder="Ej. profiles" />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Acción
          <Input name="action" defaultValue={query.action} placeholder="Ej. UPDATE" />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Usuario relacionado
          <select
            name="user"
            defaultValue={query.user ?? ""}
            className="h-9 min-w-0 rounded-md border px-3 text-sm font-normal"
          >
            <option value="">Cualquier usuario</option>
            {(profiles ?? [])
              .filter(
                (p) =>
                  profile.is_owner || p.dependency_id === profile.dependency_id,
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.is_owner ? "Lilith D'Amico" : p.full_name}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Dependencia
          <select
            name="dependency"
            defaultValue={query.dependency ?? ""}
            className="h-9 min-w-0 rounded-md border px-3 text-sm font-normal"
          >
            <option value="">Cualquier dependencia</option>
            {(dependencies ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Desde
          <Input type="date" name="from" defaultValue={query.from} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Hasta
          <Input type="date" name="to" defaultValue={query.to} />
        </label>
        <div className="flex gap-2 md:col-span-3 xl:col-span-6">
          <Button type="submit">Filtrar logs</Button>
          <Button asChild variant="outline">
            <Link href="/admin/auditoria">Limpiar</Link>
          </Button>
        </div>
      </form>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Detalle seguro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {new Intl.DateTimeFormat("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(log.created_at))}
                </TableCell>
                <TableCell className="text-xs">
                  {log.user_id
                    ? (names.get(log.user_id) ?? "Sistema")
                    : "Sistema"}
                  {log.target_user_id && (
                    <p className="text-muted-foreground">
                      Objetivo:{" "}
                      {names.get(log.target_user_id) ?? "Registro protegido"}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{log.table_name}</TableCell>
                <TableCell className="max-w-xl text-xs">
                  <p>{log.description}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground">
                      Valores auditados
                    </summary>
                    <p className="break-all">
                      Anterior: {summarize(log.old_values)}
                    </p>
                    <p className="break-all">
                      Nuevo: {summarize(log.new_values)}
                    </p>
                  </details>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!logs.length && !error && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No hay logs para los filtros y alcance actuales.
          </p>
        )}
      </div>
    </>
  );
}
