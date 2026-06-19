import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, FilePlus2, Printer, Upload } from "lucide-react";
import { generateCertificate, updateCase } from "@/app/actions/cases";
import { uploadCaseDocuments } from "@/app/actions/documents";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { CaseTimeline, type TimelineItem } from "@/components/case-timeline";
import {
  DocumentPreview,
  type SavedDocument,
} from "@/components/document-preview";
import { DocumentUploader } from "@/components/document-uploader";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { ShareAccessForm } from "@/components/share-access-form";
import { SubmitButton } from "@/components/submit-button";
import {
  CaseStatusBadge,
  ConfidentialityBadge,
} from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { requireInternalUser } from "@/lib/auth/authorization";
import { hasPermission, RESOURCE_ROLES } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/demo-data";

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, query, session] = await Promise.all([
    params,
    searchParams,
    requireInternalUser(),
  ]);
  const { supabase, profile } = session;
  const [
    { data: item },
    { data: parties },
    { data: radications },
    { data: actions },
    { data: documents },
    { data: hearings },
    { data: proceedings },
    { data: notifications },
    { data: certificates },
    { data: audit },
    { data: dependencies },
    { data: judges },
  ] = await Promise.all([
    supabase.from("cases").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("case_parties")
      .select("*")
      .eq("case_id", id)
      .order("created_at"),
    supabase
      .from("radications")
      .select("*")
      .eq("case_id", id)
      .order("received_at", { ascending: false }),
    supabase
      .from("case_actions")
      .select("id,title,description,action_date,action_type,visibility")
      .eq("case_id", id)
      .order("action_date", { ascending: false }),
    supabase
      .from("documents")
      .select(
        "id,title,original_name,file_path,file_type,size_bytes,visibility,created_at,uploaded_by,archived_at",
      )
      .eq("case_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("hearings")
      .select("*")
      .eq("case_id", id)
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("proceedings")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("certificates")
      .select("*")
      .eq("case_id", id)
      .order("issued_at", { ascending: false }),
    profile.is_owner
      ? supabase
          .from("audit_logs")
          .select("id,action,description,created_at")
          .eq("record_id", id)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    supabase
      .from("dependencies")
      .select("id,name")
      .eq("is_active", true)
      .order("name"),
    profile.is_owner
      ? supabase
          .from("profiles")
          .select("id,full_name")
          .eq("is_active", true)
          .neq("role", "CONSULTA_PUBLICA")
          .order("full_name")
      : Promise.resolve({ data: [] }),
  ]);
  if (!item) notFound();
  const signedDocuments: SavedDocument[] = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data } = await supabase.storage
        .from("case-documents")
        .createSignedUrl(doc.file_path, 900, { download: false });
      return {
        ...doc,
        signedUrl: doc.archived_at ? null : (data?.signedUrl ?? null),
        canArchive:
          profile.is_owner ||
          doc.uploaded_by === profile.id ||
          hasPermission(profile, [
            ...RESOURCE_ROLES.actionsWrite,
            ...RESOURCE_ROLES.archive,
          ]),
        canRestore: profile.is_owner,
        canHardDelete: profile.is_owner,
      };
    }),
  );
  const canEdit = hasPermission(profile, RESOURCE_ROLES.casesEdit);
  const canAct = hasPermission(profile, RESOURCE_ROLES.actionsWrite);
  const canHear = hasPermission(profile, RESOURCE_ROLES.hearingsWrite);
  const canProceed = hasPermission(profile, RESOURCE_ROLES.proceedingsWrite);
  const canArchive = hasPermission(profile, RESOURCE_ROLES.archive);
  const canCertificate = hasPermission(profile, [
    ...RESOURCE_ROLES.secretarialWrite,
    ...RESOURCE_ROLES.archive,
  ]);
  return (
    <>
      <AdminPageHeader
        title={item.internal_number}
        description={item.title}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/admin/expedientes/${id}/constancia`}>
                <Printer className="size-4" /> Constancia
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/admin/expedientes/${id}/imprimir`}>
                <Printer className="size-4" /> Imprimir expediente
              </Link>
            </Button>
          </div>
        }
      />
      <ActionMessage error={query.error} success={query.success} />
      <Card className="overflow-hidden py-0">
        <div className="border-b-4 border-[#b38a3c] bg-[#102d49] p-6 text-white">
          <p className="text-xs uppercase tracking-[.16em] text-[#d7bf83]">
            Expediente judicial
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="mono-number text-xl font-semibold">
                {item.internal_number}
              </h2>
              <p className="mono-number text-xs text-slate-300">
                {item.judicial_number}
              </p>
            </div>
            <div className="flex gap-2">
              <CaseStatusBadge status={item.status} />
              <ConfidentialityBadge level={item.confidentiality_level} />
            </div>
          </div>
        </div>
        <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Sala / despacho" value={item.chamber} />
          <Info
            label="Proceso"
            value={`${item.process_type} · ${item.process_subtype}`}
          />
          <Info label="Autoridad" value={item.authority_type} />
          <Info label="Radicación" value={formatDate(item.filed_at)} />
        </CardContent>
      </Card>
      <div className="mt-5 flex flex-wrap gap-2">
        {canCertificate && (
          <form action={generateCertificate}>
            <input type="hidden" name="case_id" value={id} />
            <SubmitButton variant="outline" pendingLabel="Generando…">
              Generar constancia
            </SubmitButton>
          </form>
        )}
        {canAct && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/actuaciones/nueva?caseId=${id}`}>
              <FilePlus2 className="size-4" /> Agregar actuación
            </Link>
          </Button>
        )}
        {canHear && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/audiencias/nueva?caseId=${id}`}>
              <CalendarPlus className="size-4" /> Programar audiencia
            </Link>
          </Button>
        )}
        {canProceed && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/providencias/nueva?caseId=${id}`}>
              <FilePlus2 className="size-4" /> Crear providencia
            </Link>
          </Button>
        )}
      </div>
      <div className="mt-5">
        <ShareAccessForm
          resourceType="case"
          resourceId={id}
          caseId={id}
          destination={`/admin/expedientes/${id}`}
          users={(judges ?? []).map((user) => ({
            id: user.id,
            name: user.full_name,
          }))}
          dependencies={(dependencies ?? []).map((dependency) => ({
            id: dependency.id,
            name: dependency.name,
          }))}
        />
      </div>
      <Tabs defaultValue="resumen" className="mt-6">
        <div className="overflow-x-auto">
          <TabsList className="h-auto min-w-max">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="partes">Partes</TabsTrigger>
            <TabsTrigger value="radicacion">Radicación</TabsTrigger>
            <TabsTrigger value="actuaciones">Actuaciones</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="audiencias">Audiencias</TabsTrigger>
            <TabsTrigger value="providencias">Providencias</TabsTrigger>
            <TabsTrigger value="notificaciones">Notificaciones</TabsTrigger>
            <TabsTrigger value="constancias">Constancias</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="resumen">
          <Card>
            <CardContent className="grid gap-6 p-6 lg:grid-cols-2">
              <section>
                <h3 className="font-semibold text-[#153553]">Resumen</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {item.summary}
                </p>
                <h3 className="mt-5 font-semibold text-[#153553]">
                  Pretensiones
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {item.claims}
                </p>
              </section>
              <section>
                <InfoRow
                  label="Departamento / municipio"
                  value={`${item.department} / ${item.municipality}`}
                />
                <InfoRow label="Recepción" value={item.reception_method} />
                <InfoRow
                  label="Observaciones"
                  value={item.observations || "Sin observaciones"}
                />
                {canEdit && !item.archived_at && (
                  <details className="mt-5 rounded border p-4">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Editar asignación y estado
                    </summary>
                    <form action={updateCase} className="mt-4 grid gap-3">
                      <input type="hidden" name="case_id" value={id} />
                      <Input
                        name="status"
                        defaultValue={item.status}
                        required
                      />
                      <select
                        name="dependency_id"
                        defaultValue={item.dependency_id ?? ""}
                        className="h-9 rounded-md border px-3 text-sm"
                        required
                      >
                        {(dependencies ?? []).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <select
                        name="assigned_judge_id"
                        defaultValue={item.assigned_judge_id ?? ""}
                        className="h-9 rounded-md border px-3 text-sm"
                      >
                        <option value="">Sin asignar</option>
                        {(judges ?? []).map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.full_name}
                          </option>
                        ))}
                      </select>
                      <Textarea
                        name="observations"
                        defaultValue={item.observations ?? ""}
                      />
                      <SubmitButton pendingLabel="Guardando…">
                        Guardar cambios
                      </SubmitButton>
                    </form>
                  </details>
                )}
                <div className="mt-5">
        <LifecycleActions
          resource="cases"
          recordId={id}
          recordLabel={item.internal_number}
          destination="/admin/expedientes"
                    archived={Boolean(item.archived_at)}
                    canArchive={canArchive}
                    canRestore={profile.is_owner}
                    canHardDelete={profile.is_owner}
                  />
                </div>
              </section>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="partes">
          <List
            items={(parties ?? []).map(
              (p) =>
                `${p.party_type}: ${p.name}${p.document_number ? ` · ${p.document_number}` : ""}`,
            )}
            empty="No hay partes registradas."
          />
        </TabsContent>
        <TabsContent value="radicacion">
          <List
            items={(radications ?? []).map(
              (r) =>
                `${formatDate(r.received_at)} · ${r.reception_method} · ${r.validation_status}`,
            )}
            empty="No hay radicaciones."
          />
        </TabsContent>
        <TabsContent value="actuaciones">
          <Card>
            <CardContent className="p-6">
              <CaseTimeline items={(actions ?? []) as TimelineItem[]} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="documentos">
          <div id="documentos" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  <Upload className="mr-2 inline size-4" />
                  Adjuntar documentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={uploadCaseDocuments} className="space-y-4">
                  <input type="hidden" name="case_id" value={id} />
                  <DocumentUploader />
                  <select
                    name="visibility"
                    className="h-9 rounded-md border px-3 text-sm"
                  >
                    <option value="internal">Interno</option>
                    <option value="reserved">Reservado</option>
                    <option value="public">Público</option>
                  </select>
                  <SubmitButton pendingLabel="Subiendo…">
                    Subir documentos
                  </SubmitButton>
                </form>
              </CardContent>
            </Card>
            <div className="grid gap-4 xl:grid-cols-2">
              {signedDocuments.map((doc) => (
                <DocumentPreview key={doc.id} document={doc} caseId={id} />
              ))}
            </div>
            {!signedDocuments.length && (
              <List items={[]} empty="No hay documentos adjuntos." />
            )}
          </div>
        </TabsContent>
        <TabsContent value="audiencias">
          <List
            items={(hearings ?? []).map(
              (h) =>
                `${formatDate(h.scheduled_at)} · ${h.title} · ${h.room} · ${h.status}`,
            )}
            empty="No hay audiencias."
            links={(hearings ?? []).map(
              (h) => `/admin/audiencias/${h.id}/editar`,
            )}
          />
        </TabsContent>
        <TabsContent value="providencias">
          <List
            items={(proceedings ?? []).map(
              (p) => `${p.providence_number} · ${p.title} · ${p.status}`,
            )}
            empty="No hay providencias."
            links={(proceedings ?? []).map(
              (p) => `/admin/providencias/${p.id}`,
            )}
          />
        </TabsContent>
        <TabsContent value="notificaciones">
          <List
            items={(notifications ?? []).map(
              (n) =>
                `${n.notification_type} · ${n.recipient_name} · ${n.status}`,
            )}
            empty="No hay notificaciones registradas."
          />
        </TabsContent>
        <TabsContent value="constancias">
          <List
            items={(certificates ?? []).map(
              (c) =>
                `${c.certificate_number} · ${c.certificate_type} · ${formatDate(c.issued_at)}`,
            )}
            empty="No hay constancias almacenadas. Puede imprimir la constancia de radicación desde el encabezado."
          />
        </TabsContent>
        <TabsContent value="auditoria">
          <List
            items={
              profile.is_owner
                ? (audit ?? []).map(
                    (a) =>
                      `${formatDate(a.created_at)} · ${a.action} · ${a.description}`,
                  )
                : []
            }
            empty={
              profile.is_owner
                ? "No hay eventos para este registro."
                : "La auditoría detallada es exclusiva del propietario."
            }
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-5">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-[#153553]">{value}</p>
    </div>
  );
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
function List({
  items,
  empty,
  links,
}: {
  items: string[];
  empty: string;
  links?: string[];
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        {items.length ? (
          items.map((text, i) =>
            links?.[i] ? (
              <Link
                key={`${text}-${i}`}
                href={links[i]}
                className="block rounded border p-4 text-sm hover:bg-slate-50"
              >
                {text}
              </Link>
            ) : (
              <p key={`${text}-${i}`} className="rounded border p-4 text-sm">
                {text}
              </p>
            ),
          )
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}
