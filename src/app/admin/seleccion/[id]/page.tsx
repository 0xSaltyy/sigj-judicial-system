import Link from "next/link";
import { AlertTriangle, ExternalLink, Mail, UserRoundSearch } from "lucide-react";
import { updateSelectionApplication } from "@/app/actions/selection";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { CopyTextButton } from "@/components/copy-text-button";
import { SelectionProcessForm } from "@/components/selection-process-form";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

type ProcessRow = {
  id: string;
  slug: string;
  title: string;
  position_title: string;
  institution_id: string;
  dependency_id: string;
  description: string;
  requirements: string;
  responsibilities: string | null;
  opening_at: string;
  closing_at: string;
  status: string;
  vacancies: number;
  visibility: string;
  application_instructions: string | null;
  responsible_user_id: string | null;
};

type ApplicationRow = {
  id: string;
  tracking_code: string | null;
  applicant_name: string;
  applicant_email: string;
  applicant_identifier: string | null;
  phone: string | null;
  statement: string;
  experience: string | null;
  status: string;
  internal_notes: string | null;
  public_message: string | null;
  public_updated_at: string | null;
  score: number | null;
  reviewed_at: string | null;
  source: string;
  created_at: string;
};

type DependencyRow = { id: string; name: string; parent_id?: string | null };
type ReviewerRow = { id: string; full_name: string; is_owner: boolean };

export default async function SelectionDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, query, { supabase, profile }] = await Promise.all([
    params,
    searchParams,
    requirePermission(PERMISSIONS.selectionView),
  ]);

  const [
    processResult,
    canEdit,
    canViewApplications,
    canEditApplications,
    canEvaluate,
    canUpdateStatus,
    canEditPublicMessage,
  ] = await Promise.all([
    supabase
      .from("selection_processes")
      .select("*")
      .eq("id", id)
      .maybeSingle<ProcessRow>(),
    can(profile, "edit", "seleccion", { supabase }),
    can(profile, "view_applications", "seleccion", { supabase }),
    can(profile, "edit_applications", "seleccion", { supabase }),
    can(profile, "evaluate_applications", "seleccion", { supabase }),
    can(profile, "update_application_status", "seleccion", { supabase }),
    can(profile, "edit_public_message", "seleccion", { supabase }),
  ]);

  const selectionProcess = processResult.data;

  if (processResult.error || !selectionProcess) {
    if (processResult.error && globalThis.process.env.NODE_ENV !== "production") {
      console.warn("[selection-detail]", {
        route: "/admin/seleccion/[id]",
        processId: id,
        userId: profile.id,
        role: profile.role,
        code: processResult.error.code,
        message: processResult.error.message,
      });
    }

    return (
      <>
        <AdminPageHeader
          title="No se pudo abrir el proceso de selección"
          description="El proceso no existe, fue archivado o no está dentro de su alcance autorizado."
          action={
            <Button asChild variant="outline">
              <Link href="/admin/seleccion">Volver a procesos</Link>
            </Button>
          }
        />
        <ActionMessage error={query.error} success={query.success} />
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">
          <AlertTriangle className="mx-auto mb-3 size-8 text-amber-600" />
          <p className="font-medium text-[#153553]">
            No tiene permiso para abrir este proceso o el recurso ya no está
            disponible.
          </p>
          <p className="mt-2">
            Su sesión continúa activa. Regrese al listado y verifique que el
            proceso pertenezca a su institución o despacho.
          </p>
        </div>
      </>
    );
  }

  const process = selectionProcess;

  const [dependencyResult, institutionResult, responsibleResult] = await Promise.all([
    process.dependency_id
      ? supabase
          .from("dependencies")
          .select("id,name,parent_id")
          .eq("id", process.dependency_id)
          .maybeSingle<DependencyRow>()
      : Promise.resolve({ data: null }),
    process.institution_id
      ? supabase
          .from("dependencies")
          .select("id,name,parent_id")
          .eq("id", process.institution_id)
          .maybeSingle<DependencyRow>()
      : Promise.resolve({ data: null }),
    process.responsible_user_id
      ? supabase
          .from("profiles")
          .select("id,full_name,is_owner")
          .eq("id", process.responsible_user_id)
          .maybeSingle<ReviewerRow>()
      : Promise.resolve({ data: null }),
  ]);

  const [{ data: dependencies }, { data: reviewers }, applicationsResult] =
    await Promise.all([
      canEdit
        ? supabase
            .from("dependencies")
            .select("id,name,parent_id")
            .eq("is_active", true)
            .is("archived_at", null)
            .order("name")
        : Promise.resolve({ data: [] }),
      canEdit
        ? supabase
            .from("profiles")
            .select("id,full_name,is_owner")
            .eq("is_active", true)
            .neq("role", "CONSULTA_PUBLICA")
            .order("full_name")
        : Promise.resolve({ data: [] }),
      canViewApplications
        ? supabase
            .from("selection_applications")
            .select(
              "id,tracking_code,applicant_name,applicant_email,applicant_identifier,phone,statement,experience,status,internal_notes,public_message,public_updated_at,score,reviewed_at,source,created_at",
            )
            .eq("process_id", id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

  const applications = (applicationsResult.data ?? []) as ApplicationRow[];
  const dependency = dependencyResult.data;
  const institution = institutionResult.data;
  const responsible = responsibleResult.data;
  const statusLookupUrl = `${(globalThis.process.env.NEXT_PUBLIC_APP_URL || "https://palaciodejusticia.fyi").replace(/\/$/, "")}/convocatorias/estado`;
  const processTitle = process.title ?? "Proceso sin título";
  const positionTitle = process.position_title ?? "Cargo no definido";
  const isPublic = process.visibility === "publico" && Boolean(process.slug);

  return (
    <>
      <AdminPageHeader
        title={processTitle}
        description={`${positionTitle} · ${dependency?.name ?? "Sin despacho"}`}
        action={
          <div className="flex flex-wrap gap-2">
            {isPublic ? (
              <Button asChild variant="outline">
                <Link href={`/convocatorias/${process.slug}`} target="_blank">
                  <ExternalLink className="size-4" />
                  Convocatoria pública
                </Link>
              </Button>
            ) : (
              <Button disabled variant="outline" title="Esta convocatoria aún no está publicada.">
                Convocatoria no publicada
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/admin/seleccion">Volver</Link>
            </Button>
          </div>
        }
      />
      <ActionMessage
        error={
          query.error ??
          ("error" in applicationsResult && applicationsResult.error
            ? "No fue posible cargar las postulaciones del proceso."
            : undefined)
        }
        success={query.success}
      />

      <section className="mb-5 grid min-w-0 gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Estado" value={statusLabel(process.status)} />
        <Fact label="Institución" value={institution?.name ?? "Sin institución"} />
        <Fact label="Despacho" value={dependency?.name ?? "Sin despacho"} />
        <Fact
          label="Responsable"
          value={
            responsible?.is_owner
              ? "Lilith D'Amico"
              : responsible?.full_name ?? "Sin responsable asignado"
          }
        />
        <Fact label="Apertura" value={formatDate(process.opening_at)} />
        <Fact label="Cierre" value={formatDate(process.closing_at)} />
        <Fact label="Vacantes" value={String(process.vacancies ?? 0)} />
        <Fact
          label="Visibilidad"
          value={process.visibility === "publico" ? "Pública" : "Interna"}
        />
      </section>

      {canEdit ? (
        <details className="mb-5 rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-semibold text-[#153553]">
            Editar configuración del proceso
          </summary>
          <div className="mt-4">
            <SelectionProcessForm
              dependencies={dependencies ?? []}
              reviewers={reviewers ?? []}
              process={process}
            />
          </div>
        </details>
      ) : (
        <p className="mb-5 rounded border bg-white p-4 text-sm text-muted-foreground">
          Puede consultar este proceso, pero no modificarlo.
        </p>
      )}

      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#153553]">Postulaciones</h2>
          <p className="text-sm text-muted-foreground">
            Información privada visible únicamente dentro del alcance autorizado.
          </p>
        </div>
        <Badge variant="outline">{applications.length} postulaciones</Badge>
      </div>

      {!canViewApplications ? (
        <p className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">
          No tiene permiso para consultar las postulaciones de este proceso.
        </p>
      ) : (
        <div className="space-y-4">
          {applications.map((application) => (
            <article key={application.id} className="min-w-0 rounded-xl border bg-white p-5">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold text-[#153553]">
                    {application.applicant_name}
                  </h3>
                  <p className="mt-1 flex min-w-0 items-center gap-1 break-all text-xs text-muted-foreground">
                    <Mail className="size-3 shrink-0" />
                    {application.applicant_email}
                  </p>
                  {application.applicant_identifier && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      Identificador: {application.applicant_identifier}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Interno: {applicationStatus(application.status)}</Badge>
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-800"
                  >
                    Público: {publicStatus(application.status, process.status)}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 rounded border bg-slate-50 p-3">
                <span className="break-all font-mono text-xs font-semibold">
                  {application.tracking_code ?? "Sin código"}
                </span>
                {application.tracking_code && (
                  <CopyTextButton text={application.tracking_code} label="Copiar código" />
                )}
                <CopyTextButton text={statusLookupUrl} label="Copiar consulta con código de seguimiento" />
                <Badge variant="outline">Consulta pública disponible</Badge>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <TextBlock label="Presentación" value={application.statement} />
                <TextBlock
                  label="Experiencia"
                  value={application.experience || "Sin experiencia adicional registrada."}
                />
              </div>

              {canEditApplications ? (
                <form
                  action={updateSelectionApplication}
                  className="mt-4 grid min-w-0 gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-[180px_120px_minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <input type="hidden" name="application_id" value={application.id} />
                  <input type="hidden" name="process_id" value={id} />
                  <label className="grid gap-1 text-xs font-medium">
                    Estado
                    <select
                      name="status"
                      defaultValue={application.status}
                      disabled={!canUpdateStatus}
                      className="h-9 rounded-md border bg-white px-2 text-sm"
                    >
                      {applicationStatuses.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {!canUpdateStatus && (
                      <input type="hidden" name="status" value={application.status} />
                    )}
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Puntaje
                    <Input
                      name="score"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      defaultValue={application.score ?? ""}
                      disabled={!canEvaluate}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Notas internas
                    <Textarea
                      name="internal_notes"
                      defaultValue={application.internal_notes ?? ""}
                      disabled={!canEvaluate}
                      className="min-h-20 bg-white"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Nunca son visibles al postulante.
                    </span>
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Mensaje público para el postulante
                    <Textarea
                      name="public_message"
                      defaultValue={application.public_message ?? ""}
                      disabled={!canEditPublicMessage}
                      maxLength={1000}
                      className="min-h-20 border-amber-300 bg-amber-50"
                    />
                    <span className="text-[10px] font-semibold text-amber-800">
                      Este mensaje sí es visible al postulante.
                    </span>
                  </label>
                  <div className="flex items-end">
                    <SubmitButton pendingLabel="Guardando…">Actualizar</SubmitButton>
                  </div>
                </form>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  Consulta únicamente; no tiene permiso para cambiar el estado o
                  la evaluación.
                </p>
              )}
            </article>
          ))}

          {!applications.length && (
            <p className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">
              <UserRoundSearch className="mx-auto mb-3 size-8" />
              No hay postulaciones registradas para este proceso.
            </p>
          )}
        </div>
      )}
    </>
  );
}

const applicationStatuses = [
  ["recibida", "Recibida"],
  ["en_revision", "En revisión"],
  ["preseleccionada", "Preseleccionada"],
  ["entrevista", "Entrevista"],
  ["aceptada", "Aceptada"],
  ["rechazada", "No seleccionada"],
  ["archivada", "Archivada"],
] as const;

const processStatuses: Record<string, string> = {
  borrador: "Borrador",
  abierto: "Abierto",
  cerrado: "Cerrado",
  en_revision: "En revisión",
  preseleccion: "Preselección",
  entrevistas: "Entrevistas",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
  archivado: "Archivado",
};

function applicationStatus(value: string) {
  return applicationStatuses.find(([key]) => key === value)?.[1] ?? value;
}

function statusLabel(value?: string | null) {
  if (!value) return "Estado no definido";
  return processStatuses[value] ?? value;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm">{value}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{value}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function publicStatus(application: string, process?: string | null) {
  if (process === "cancelado") return "Proceso cancelado";
  if (
    ["cerrado", "finalizado", "archivado"].includes(process ?? "") &&
    !["aceptada", "rechazada", "archivada"].includes(application)
  ) {
    return "Proceso cerrado";
  }
  return (
    {
      recibida: "Recibida",
      en_revision: "En revisión",
      preseleccionada: "Preseleccionada",
      entrevista: "Entrevista",
      aceptada: "Aceptada",
      rechazada: "No seleccionada",
      archivada: "Archivada",
    } as Record<string, string>
  )[application] ?? "En trámite";
}
