import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CaseStatusBadge } from "@/components/status-badges";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { can, requirePermission } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/demo-data";
import { PROCEEDING_LIST_REALTIME } from "@/lib/realtime-subscriptions";
export default async function AdminProceedingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { supabase, profile } = await requirePermission({
    resource: "providencias",
    action: "view",
  });
  const [query, canCreate, canArchive, canRestore, canHardDelete] =
    await Promise.all([
      searchParams,
      can(profile, "create", "providencias", { supabase }),
      can(profile, "archive", "providencias", { supabase }),
      can(profile, "restore", "providencias", { supabase }),
      can(profile, "hard_delete", "providencias", { supabase }),
    ]);
  const { data, error } = await supabase
    .from("proceedings")
    .select(
      "id,providence_number,title,type,chamber,status,created_at,archived_at,case:cases(internal_number)",
    )
    .order("created_at", { ascending: false });
  return (
    <>
      <RealtimeRefresh
        channel="admin-proceedings"
        subscriptions={PROCEEDING_LIST_REALTIME}
      />
      <AdminPageHeader
        title="Providencias"
        description="Redacción, revisión, firma y publicación sobre Supabase."
        action={
          canCreate ? (
            <Button asChild className="bg-[#153b5c]">
              <Link href="/admin/providencias/nueva">
                <Plus className="size-4" /> Nueva providencia
              </Link>
            </Button>
          ) : (
            <Button disabled title="No tiene permiso para crear providencias">
              <Plus className="size-4" /> Nueva providencia
            </Button>
          )
        }
      />
      <ActionMessage
        error={query.error ?? (error ? "No fue posible cargar las providencias disponibles para su perfil." : undefined)}
        success={query.success}
      />
      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Tipo / título</TableHead>
              <TableHead>Expediente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((p) => (
              <TableRow
                key={p.id}
                className={p.archived_at ? "bg-slate-50/70" : undefined}
              >
                <TableCell className="mono-number text-xs">
                  {p.providence_number}
                </TableCell>
                <TableCell>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.type} · {p.chamber}
                  </p>
                </TableCell>
                <TableCell className="mono-number text-xs">
                  {p.case?.[0]?.internal_number}
                </TableCell>
                <TableCell className="text-xs">
                  {formatDate(p.created_at)}
                </TableCell>
                <TableCell>
                  <CaseStatusBadge status={p.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button asChild size="icon" variant="ghost">
                      <Link href={`/admin/providencias/${p.id}`}>
                        <Eye className="size-4" />
                      </Link>
                    </Button>
                    <LifecycleActions
                      resource="proceedings"
                      recordId={p.id}
                      recordLabel={p.providence_number}
                      destination="/admin/providencias"
                      archived={Boolean(p.archived_at)}
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
        {!data?.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No hay providencias.
          </p>
        )}
      </div>
    </>
  );
}
