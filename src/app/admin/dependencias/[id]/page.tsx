import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskEmail } from "@/lib/user-management";

export default async function DependencyPanel({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePermission(PERMISSIONS.dependenciesView);
  const admin = createAdminClient();
  if (!admin) notFound();
  const [
    { data: dep },
    { data: members },
    { data: cases },
    { data: hearings },
  ] = await Promise.all([
    admin.from("dependencies").select("*").eq("id", id).maybeSingle(),
    admin
      .from("profiles")
      .select("id,full_name,email,position_title,role,is_active,is_owner")
      .or(`dependency_id.eq.${id},institution_id.eq.${id}`)
      .order("full_name"),
    admin
      .from("cases")
      .select("id,internal_number,ticket_name,title,status")
      .eq("dependency_id", id)
      .is("archived_at", null)
      .order("filed_at", { ascending: false })
      .limit(20),
    admin
      .from("hearings")
      .select("id,title,scheduled_at,status")
      .eq("dependency_id", id)
      .order("scheduled_at", { ascending: false })
      .limit(20),
  ]);
  if (!dep) notFound();
  if (!session.profile.is_owner) {
    const scopeRoot = session.profile.institution_id ?? session.profile.dependency_id;
    const { data: inScope } = scopeRoot
      ? await session.supabase.rpc("dependency_is_within", { p_child: id, p_parent: scopeRoot })
      : { data: false };
    if (!inScope) notFound();
  }
  return (
    <>
      <AdminPageHeader
        title={dep.name}
        description={`${dep.type} · ${dep.competence}`}
        action={
          <Button asChild>
            <Link href="/admin/usuarios/nuevo">Agregar miembro</Link>
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Miembros asignados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(members ?? []).map((m) => (
              <article
                key={m.id}
                className="flex justify-between rounded border p-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {m.is_owner ? "Lilith D'Amico" : m.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.position_title || m.role} ·{" "}
                    {m.is_owner ? "Correo protegido" : maskEmail(m.email)}
                  </p>
                </div>
                <Badge>{m.is_active ? "Activo" : "Inactivo"}</Badge>
              </article>
            ))}
            {!members?.length && (
              <p className="text-sm text-muted-foreground">
                Sin miembros asignados.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expedientes activos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(cases ?? []).map((c) => (
              <Link
                key={c.id}
                href={`/admin/expedientes/${c.id}`}
                className="block rounded border p-3 text-sm"
              >
                <b>{c.ticket_name || c.title}</b>
                <span className="block text-xs text-muted-foreground">
                  {c.internal_number} · {c.status}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Audiencias</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {(hearings ?? []).map((h) => (
              <article key={h.id} className="rounded border p-3 text-sm">
                <b>{h.title}</b>
                <p className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(h.scheduled_at))}{" "}
                  · {h.status}
                </p>
              </article>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
