import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
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
import {
  CaseStatusBadge,
  ConfidentialityBadge,
} from "@/components/status-badges";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { can, requirePermission } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/demo-data";
import { CASE_LIST_REALTIME } from "@/lib/realtime-subscriptions";

export const metadata = { title: "Expedientes" };
export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const { supabase, profile } = await requirePermission({
    resource: "expedientes",
    action: "view",
  });
  const [query, canCreate, canArchive, canRestore, canHardDelete] =
    await Promise.all([
      searchParams,
      can(profile, "create", "expedientes", { supabase }),
      can(profile, "archive", "expedientes", { supabase }),
      can(profile, "restore", "expedientes", { supabase }),
      can(profile, "hard_delete", "expedientes", { supabase }),
    ]);
  let request = supabase
    .from("cases")
    .select(
      "id,internal_number,judicial_number,title,ticket_name,chamber,status,confidentiality_level,filed_at,claimant_name,defendant_name,archived_at",
    )
    .order("filed_at", { ascending: false })
    .limit(100);
  if (query.q)
    request = request.or(
      `internal_number.ilike.%${query.q}%,judicial_number.ilike.%${query.q}%,title.ilike.%${query.q}%,ticket_name.ilike.%${query.q}%`,
    );
  if (query.status) request = request.eq("status", query.status);
  const { data: cases, error } = await request;
  if (error) {
    console.error("[admin/expedientes] case list query failed", {
      code: error.code,
      details: error.details,
    });
  }
  return (
    <>
      <RealtimeRefresh channel="admin-cases" subscriptions={CASE_LIST_REALTIME} />
      <AdminPageHeader
        title="Expedientes judiciales"
        description="Radicación, asignación y seguimiento con datos reales de Supabase."
        action={
          canCreate ? (
            <Button asChild className="gap-2 bg-[#153b5c]">
              <Link href="/admin/expedientes/nuevo">
                <Plus className="size-4" /> Nueva radicación
              </Link>
            </Button>
          ) : (
            <Button disabled title="No tiene permiso para crear expedientes">
              <Plus className="size-4" /> Nueva radicación
            </Button>
          )
        }
      />
      <ActionMessage
        error={
          query.error ??
          (error
            ? "No fue posible consultar los expedientes. Intente nuevamente."
            : undefined)
        }
        success={query.success}
      />
      <div className="rounded-lg border bg-white">
        <form className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_220px_auto]">
          <Input
            name="q"
            defaultValue={query.q}
            placeholder="Radicado, número, título o asunto breve…"
          />
          <select
            name="status"
            defaultValue={query.status ?? ""}
            className="h-9 rounded-md border bg-white px-3 text-sm"
          >
            <option value="">Todos los estados</option>
            {[
              "Radicado",
              "En reparto",
              "En trámite",
              "Cerrado",
              "Archivado",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </form>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Radicado</TableHead>
                <TableHead>Proceso / partes</TableHead>
                <TableHead>Sala</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Reserva</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cases ?? []).map((item) => (
                <TableRow
                  key={item.id}
                  className={item.archived_at ? "bg-slate-50/70" : undefined}
                >
                  <TableCell>
                    <Link
                      href={`/admin/expedientes/${item.id}`}
                      className="mono-number text-xs font-semibold text-[#153b5c] hover:underline"
                    >
                      {item.internal_number || "Sin número interno"}
                    </Link>
                    <p className="mono-number mt-1 text-[10px] text-muted-foreground">
                      {item.judicial_number || "Sin radicado judicial"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-[#153553]">
                      {item.ticket_name || item.title || "Expediente sin título"}
                    </p>
                    {item.ticket_name && <p className="mt-1 text-xs text-muted-foreground">{item.title}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.claimant_name || "Parte no registrada"} / {item.defendant_name || "Parte no registrada"}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.chamber || "Sin asignar"}
                  </TableCell>
                  <TableCell>
                    <CaseStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <ConfidentialityBadge level={item.confidentiality_level} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(item.filed_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="ghost" size="icon">
                        <Link
                          href={`/admin/expedientes/${item.id}`}
                          aria-label={`Ver ${item.internal_number || "expediente"}`}
                        >
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                      <LifecycleActions
                        resource="cases"
                        recordId={item.id}
                        recordLabel={item.internal_number || "Expediente sin número"}
                        destination="/admin/expedientes"
                        archived={Boolean(item.archived_at)}
                        canArchive={canArchive}
                        canRestore={canRestore}
                        canHardDelete={canHardDelete}
                        compact
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!error && !cases?.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No hay expedientes disponibles para su perfil o que coincidan con la búsqueda.
          </p>
        )}
        <p className="border-t p-4 text-xs text-muted-foreground">
          Se muestran hasta 100 resultados recientes. Use los filtros para
          acotar la consulta.
        </p>
      </div>
    </>
  );
}
