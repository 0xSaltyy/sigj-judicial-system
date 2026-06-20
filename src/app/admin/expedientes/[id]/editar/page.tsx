import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, Save, Trash2 } from "lucide-react";
import {
  manageCaseParty,
  saveCaseParty,
  updateCaseFull,
} from "@/app/actions/cases";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { DraftForm } from "@/components/draft-form";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { can, PERMISSIONS, requireCaseAccess } from "@/lib/auth/permissions";

export default async function EditCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, profile } = await requireCaseAccess(
    id,
    PERMISSIONS.casesEdit,
  );
  const [
    { data: item },
    { data: dependencies },
    { data: judges },
    { data: parties },
  ] = await Promise.all([
    supabase.from("cases").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("dependencies")
      .select("id,name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("profiles")
      .select("id,full_name,position_title")
      .eq("is_active", true)
      .in("role", [
        "MAGISTRADO_CORTE_SUPREMA",
        "MAGISTRADO_TRIBUNAL",
        "JUEZ_CIRCUITO",
        "JUEZ_MUNICIPAL",
      ])
      .order("full_name"),
    supabase
      .from("case_parties")
      .select("*")
      .eq("case_id", id)
      .order("created_at"),
  ]);
  if (!item) notFound();
  if (item.archived_at && !profile.is_owner) notFound();
  const [canRepartition, canAssignPonente] = await Promise.all([
    can(profile, "repartition", "expedientes", { supabase }),
    can(profile, "assign_ponente", "expedientes", { supabase }),
  ]);
  const field = "mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm";
  return (
    <>
      <AdminPageHeader
        title="Editar expediente"
        description={`${item.internal_number} · Cambios sensibles auditados con valor anterior y nuevo.`}
        action={
          <Button asChild variant="outline">
            <Link href={`/admin/expedientes/${id}`}>Volver al expediente</Link>
          </Button>
        }
      />
      <ActionMessage error={query.error} success={query.success} />
      {item.archived_at && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Expediente archivado. La edición excepcional está disponible
          únicamente para SUPER_ADMIN.
        </div>
      )}
      <DraftForm
        action={updateCaseFull}
        storageKey={`case-edit:${id}`}
        className="grid gap-5 rounded-xl border bg-white p-6 md:grid-cols-2"
      >
        <input type="hidden" name="case_id" value={id} />
        <Field label="Título / asunto" required>
          <Input name="title" defaultValue={item.title} required />
        </Field>
        <Field label="Autoridad" required>
          <Input
            name="authority_type"
            defaultValue={item.authority_type}
            required
          />
        </Field>
        <Field label="Tipo de proceso" required>
          <Input
            name="process_type"
            defaultValue={item.process_type}
            required
          />
        </Field>
        <Field label="Subtipo" required>
          <Input
            name="process_subtype"
            defaultValue={item.process_subtype}
            required
          />
        </Field>
        <Field label="Sala / despacho" required>
          <Input name="chamber" defaultValue={item.chamber} required />
        </Field>
        <Field label="Estado" required>
          <Input name="status" defaultValue={item.status} required />
        </Field>
        <Field label="Accionante / demandante" required>
          <Input
            name="claimant_name"
            defaultValue={item.claimant_name}
            required
          />
        </Field>
        <Field label="Accionado / demandado" required>
          <Input
            name="defendant_name"
            defaultValue={item.defendant_name}
            required
          />
        </Field>
        <Field label="Departamento" required>
          <Input name="department" defaultValue={item.department} required />
        </Field>
        <Field label="Municipio" required>
          <Input
            name="municipality"
            defaultValue={item.municipality}
            required
          />
        </Field>
        <Field label="Forma de recepción" required>
          <Input
            name="reception_method"
            defaultValue={item.reception_method}
            required
          />
        </Field>
        <Field label="Dependencia" required>
          <select
            name="dependency_id"
            defaultValue={item.dependency_id ?? ""}
            required
            className={field}
            disabled={!canRepartition}
            title={!canRepartition ? "No tiene permiso para cambiar el reparto o la dependencia" : undefined}
          >
            {(dependencies ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {!canRepartition && <input type="hidden" name="dependency_id" value={item.dependency_id ?? ""} />}
        </Field>
        <Field label="Juez / magistrado asignado" optional>
          <select
            name="assigned_judge_id"
            defaultValue={item.assigned_judge_id ?? ""}
            className={field}
            disabled={!canAssignPonente}
            title={!canAssignPonente ? "No tiene permiso para asignar ponente" : undefined}
          >
            <option value="">Sin asignar</option>
            {(judges ?? []).map((j) => (
              <option key={j.id} value={j.id}>
                {j.full_name}
              </option>
            ))}
          </select>
          {!canAssignPonente && <input type="hidden" name="assigned_judge_id" value={item.assigned_judge_id ?? ""} />}
        </Field>
        <Field label="Nivel de reserva" required>
          <select
            name="confidentiality_level"
            defaultValue={item.confidentiality_level}
            className={field}
          >
            <option>Público</option>
            <option>Reservado</option>
            <option>Confidencial</option>
          </select>
        </Field>
        <label className="flex items-center gap-3 rounded-lg border p-4 text-sm">
          <input
            type="checkbox"
            name="public_visibility"
            value="true"
            defaultChecked={item.public_visibility}
          />
          Visible en consulta pública (sólo nivel Público)
        </label>
        <Field label="Confirmación para desclasificar" optional>
          <Input
            name="declassification_confirmation"
            placeholder="CONFIRMAR PUBLICACIÓN"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Obligatoria al pasar de Reservado/Confidencial a Público.
          </span>
        </Field>
        <Field label="Resumen" required wide>
          <Textarea
            name="summary"
            defaultValue={item.summary}
            required
            className="min-h-32"
          />
        </Field>
        <Field label="Pretensiones" required wide>
          <Textarea
            name="claims"
            defaultValue={item.claims}
            required
            className="min-h-32"
          />
        </Field>
        <Field label="Observaciones internas" optional wide>
          <Textarea
            name="observations"
            defaultValue={item.observations ?? ""}
            className="min-h-24"
          />
        </Field>
        <div className="md:col-span-2">
          <SubmitButton pendingLabel="Guardando cambios…">
            <Save className="size-4" />
            Guardar expediente
          </SubmitButton>
        </div>
      </DraftForm>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Partes procesales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(parties ?? []).map((p) => (
            <details
              key={p.id}
              className={`rounded-lg border p-4 ${p.archived_at ? "bg-slate-100 opacity-75" : "bg-white"}`}
            >
              <summary className="cursor-pointer font-semibold">
                {p.party_type}: {p.name} {p.archived_at && "· Archivada"}
              </summary>
              <form
                action={saveCaseParty}
                className="mt-4 grid gap-3 md:grid-cols-2"
              >
                <input type="hidden" name="party_id" value={p.id} />
                <input type="hidden" name="case_id" value={id} />
                <Input
                  name="name"
                  defaultValue={p.name}
                  required
                  disabled={Boolean(p.archived_at)}
                />
                <Input
                  name="party_type"
                  defaultValue={p.party_type}
                  required
                  disabled={Boolean(p.archived_at)}
                />
                <Input
                  name="document_type"
                  defaultValue={p.document_type ?? ""}
                  placeholder="Tipo de documento (opcional)"
                  disabled={Boolean(p.archived_at)}
                />
                <Input
                  name="document_number"
                  defaultValue={p.document_number ?? ""}
                  placeholder="Número (opcional)"
                  disabled={Boolean(p.archived_at)}
                />
                <Input
                  name="email"
                  type="email"
                  defaultValue={p.email ?? ""}
                  placeholder="Correo (opcional)"
                  disabled={Boolean(p.archived_at)}
                />
                <Input
                  name="phone"
                  defaultValue={p.phone ?? ""}
                  placeholder="Teléfono (opcional)"
                  disabled={Boolean(p.archived_at)}
                />
                <Input
                  name="address"
                  defaultValue={p.address ?? ""}
                  placeholder="Dirección (opcional)"
                  disabled={Boolean(p.archived_at)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_confidential"
                    value="true"
                    defaultChecked={p.is_confidential}
                    disabled={Boolean(p.archived_at)}
                  />
                  Datos confidenciales
                </label>
                {!p.archived_at && (
                  <SubmitButton size="sm" pendingLabel="Guardando…">
                    Guardar parte
                  </SubmitButton>
                )}
              </form>
              <form
                action={manageCaseParty}
                className="mt-3 flex flex-wrap gap-2"
              >
                <input type="hidden" name="party_id" value={p.id} />
                <input type="hidden" name="case_id" value={id} />
                <input
                  type="hidden"
                  name="operation"
                  value={p.archived_at ? "restore" : "archive"}
                />
                <SubmitButton
                  size="sm"
                  variant="outline"
                  pendingLabel="Actualizando…"
                >
                  {p.archived_at ? (
                    <ArchiveRestore className="size-4" />
                  ) : (
                    <Archive className="size-4" />
                  )}
                  {p.archived_at ? "Restaurar" : "Archivar"}
                </SubmitButton>
              </form>
              {profile.is_owner && p.archived_at && (
                <form action={manageCaseParty} className="mt-3 flex gap-2">
                  <input type="hidden" name="party_id" value={p.id} />
                  <input type="hidden" name="case_id" value={id} />
                  <input type="hidden" name="operation" value="delete" />
                  <Input
                    name="confirmation"
                    placeholder="ELIMINAR DEFINITIVAMENTE"
                    required
                  />
                  <SubmitButton
                    variant="destructive"
                    size="sm"
                    pendingLabel="Eliminando…"
                  >
                    <Trash2 className="size-4" />
                    Eliminar
                  </SubmitButton>
                </form>
              )}
            </details>
          ))}
          <details className="rounded-lg border border-dashed p-4">
            <summary className="cursor-pointer font-semibold">
              Agregar parte procesal
            </summary>
            <form
              action={saveCaseParty}
              className="mt-4 grid gap-3 md:grid-cols-2"
            >
              <input type="hidden" name="case_id" value={id} />
              <Input name="name" placeholder="Nombre completo *" required />
              <Input
                name="party_type"
                placeholder="Calidad procesal *"
                required
              />
              <Input
                name="document_type"
                placeholder="Tipo de documento (opcional)"
              />
              <Input name="document_number" placeholder="Número (opcional)" />
              <Input
                name="email"
                type="email"
                placeholder="Correo (opcional)"
              />
              <Input name="phone" placeholder="Teléfono (opcional)" />
              <Input name="address" placeholder="Dirección (opcional)" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_confidential" value="true" />
                Datos confidenciales
              </label>
              <SubmitButton pendingLabel="Agregando…">
                Agregar parte
              </SubmitButton>
            </form>
          </details>
        </CardContent>
      </Card>
    </>
  );
}

function Field({
  label,
  required,
  optional,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`text-sm ${wide ? "md:col-span-2" : ""}`}>
      <span className="font-medium">{label}</span>{" "}
      <span className="text-xs text-muted-foreground">
        {required ? "(obligatorio)" : optional ? "(opcional)" : ""}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
