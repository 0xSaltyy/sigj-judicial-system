import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, ExternalLink, ShieldCheck } from "lucide-react";
import { createExternalShare, revokeExternalShare } from "@/app/actions/shares";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { CopyLink } from "@/components/copy-link";
import { ShareAccessForm } from "@/components/share-access-form";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PERMISSIONS, requireCaseAccess } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/demo-data";

export default async function ShareCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
    shareLink?: string;
  }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase } = await requireCaseAccess(id, PERMISSIONS.linksCreate);
  const [
    { data: item },
    { data: links },
    { data: users },
    { data: dependencies },
  ] = await Promise.all([
    supabase
      .from("cases")
      .select("id,internal_number,title,confidentiality_level")
      .eq("id", id)
      .single(),
    supabase
      .from("share_links")
      .select(
        "id,label,external_name,external_email_masked,include_documents,include_proceedings,include_hearings,include_parties,actions_scope,expires_at,revoked_at,last_access_at,created_at",
      )
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id,full_name")
      .eq("is_active", true)
      .neq("role", "CONSULTA_PUBLICA")
      .order("full_name"),
    supabase
      .from("dependencies")
      .select("id,name")
      .eq("is_active", true)
      .order("name"),
  ]);
  if (!item) notFound();
  return (
    <>
      <AdminPageHeader
        title="Compartir expediente"
        description={`${item.internal_number} · ${item.confidentiality_level}. Compartir no cambia la clasificación pública.`}
        action={
          <Button asChild variant="outline">
            <Link href={`/admin/expedientes/${id}`}>Volver</Link>
          </Button>
        }
      />
      <ActionMessage error={query.error} success={query.success} />
      {query.shareLink && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div>
            <p className="font-semibold text-emerald-950">
              Enlace seguro generado
            </p>
            <p className="text-xs text-emerald-700">
              Se muestra una sola vez. No se guarda el token en texto plano.
            </p>
          </div>
          <CopyLink value={query.shareLink} />
        </div>
      )}
      <ShareAccessForm
        resourceType="case"
        resourceId={id}
        caseId={id}
        destination={`/admin/expedientes/${id}/compartir`}
        users={users ?? []}
        dependencies={dependencies ?? []}
      />
      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-[#8a6a2c]" />
            Enlace externo de sólo lectura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={createExternalShare}
            className="grid gap-4 md:grid-cols-2"
          >
            <input type="hidden" name="case_id" value={id} />
            <label className="text-sm">
              Etiqueta *
              <Input
                name="label"
                required
                placeholder="Ej. Consulta apoderado"
                className="mt-1"
              />
            </label>
            <label className="text-sm">
              Nombre externo (opcional)
              <Input name="external_name" className="mt-1" />
            </label>
            <label className="text-sm">
              Correo (opcional)
              <Input name="external_email" type="email" className="mt-1" />
              <span className="mt-1 block text-xs text-muted-foreground">
                Sólo se conserva hash y versión enmascarada.
              </span>
            </label>
            <label className="text-sm">
              Vigencia
              <select
                name="expires_minutes"
                defaultValue="1440"
                className="mt-1 h-10 w-full rounded-md border bg-white px-3"
              >
                <option value="15">15 minutos</option>
                <option value="60">1 hora</option>
                <option value="1440">24 horas</option>
                <option value="10080">7 días</option>
              </select>
            </label>
            <label className="text-sm">
              Vigencia personalizada (opcional)
              <Input
                name="custom_expires_minutes"
                type="number"
                min="15"
                max="10080"
                placeholder="Minutos: 15–10080"
                className="mt-1"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Si se indica, reemplaza el valor predefinido.
              </span>
            </label>
            <fieldset className="rounded-lg border p-4 md:col-span-2">
              <legend className="px-2 text-sm font-semibold">
                Alcance autorizado
              </legend>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <Check
                  name="include_documents"
                  label="Incluir documentos / pruebas"
                />
                <Check
                  name="include_proceedings"
                  label="Incluir providencias"
                  checked
                />
                <Check
                  name="include_hearings"
                  label="Incluir audiencias / actas"
                />
                <Check
                  name="include_parties"
                  label="Incluir partes procesales"
                />
              </div>
              <label className="mt-4 block text-sm">
                Actuaciones
                <select
                  name="actions_scope"
                  defaultValue="public"
                  className="mt-1 h-10 w-full rounded-md border bg-white px-3"
                >
                  <option value="public">Sólo actuaciones públicas</option>
                  <option value="all">Todas las actuaciones autorizadas</option>
                </select>
              </label>
            </fieldset>
            <div className="md:col-span-2">
              <SubmitButton pendingLabel="Creando enlace…">
                <ExternalLink className="size-4" />
                Crear enlace seguro
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="mt-5 space-y-3">
        {(links ?? []).map((link) => (
          <article key={link.id} className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{link.label}</p>
                <p className="text-sm text-muted-foreground">
                  {link.external_name || "Destinatario externo"}
                  {link.external_email_masked
                    ? ` · ${link.external_email_masked}`
                    : ""}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3" />
                  Vence {formatDate(link.expires_at)} ·{" "}
                  {link.revoked_at
                    ? "Revocado"
                    : new Date(link.expires_at) <= new Date()
                      ? "Vencido"
                      : "Activo"}
                </p>
                <p className="mt-2 text-xs">
                  Alcance: {link.include_documents ? "documentos, " : ""}
                  {link.include_proceedings ? "providencias, " : ""}
                  {link.include_hearings ? "audiencias, " : ""}
                  {link.include_parties ? "partes, " : ""}actuaciones{" "}
                  {link.actions_scope === "all" ? "autorizadas" : "públicas"}.
                </p>
              </div>
              {!link.revoked_at && new Date(link.expires_at) > new Date() && (
                <form action={revokeExternalShare}>
                  <input type="hidden" name="share_id" value={link.id} />
                  <input type="hidden" name="case_id" value={id} />
                  <SubmitButton
                    variant="outline"
                    size="sm"
                    pendingLabel="Revocando…"
                  >
                    Revocar
                  </SubmitButton>
                </form>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function Check({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={checked}
      />
      {label}
    </label>
  );
}
