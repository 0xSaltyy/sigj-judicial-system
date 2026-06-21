import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createCase } from "@/app/actions/cases";
import { AdminPageHeader } from "@/components/admin-page";
import { CatalogSelect } from "@/components/catalog-select";
import { DocumentUploader } from "@/components/document-uploader";
import { DraftForm } from "@/components/draft-form";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export const metadata = { title: "Nueva radicación" };
const authorities = [
  "Corte Suprema de Justicia",
  "Tribunal Superior de Justicia",
  "Juzgado de Circuito",
  "Juzgado Municipal",
];
const chambers = [
  "Sala Civil",
  "Sala Penal",
  "Sala Laboral",
  "Sala Familia",
  "Sala Constitucional y Tutelas",
  "Juzgados de Circuito",
  "Juzgados Municipales",
];
const processTypes = [
  "Civil",
  "Penal",
  "Laboral",
  "Administrativo",
  "Constitucional",
  "Disciplinario",
];
const subtypes = [
  "Tutela",
  "Apelación",
  "Recurso extraordinario",
  "Nulidad",
  "Responsabilidad",
  "Ejecutivo",
  "Declarativo",
  "Control de legalidad",
  "Consulta",
  "Avocamiento",
];

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, query] = await Promise.all([
    requirePermission(PERMISSIONS.casesCreate),
    searchParams,
  ]);
  const { supabase, profile } = session;
  const canUploadDocuments = await can(profile, "upload", "documentos", {
    supabase,
  });
  const hasInstitutionWideScope = [
    "SUPER_ADMIN",
    "SECRETARIO_GENERAL",
    "RADICADOR",
    "REPARTO",
  ].includes(profile.role);
  let dependencyRequest = supabase
    .from("dependencies")
    .select("id,name")
    .eq("is_active", true);
  if (!hasInstitutionWideScope) {
    dependencyRequest = dependencyRequest.eq(
      "id",
      profile.dependency_id ?? "00000000-0000-0000-0000-000000000000",
    );
  }
  const { data: dependencies, error: dependenciesError } =
    await dependencyRequest.order("name");
  return (
    <>
      <AdminPageHeader
        title="Radicar nuevo expediente"
        description="Complete la información de recepción. Los números se generan de forma transaccional."
      />
      {query.error && (
        <Alert variant="destructive" className="mb-5">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            {query.error} Los datos diligenciados se conservaron en esta
            pestaña.
          </AlertDescription>
        </Alert>
      )}
      {dependenciesError && (
        <Alert variant="destructive" className="mb-5">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            No fue posible consultar las dependencias autorizadas. Intente
            nuevamente.
          </AlertDescription>
        </Alert>
      )}
      {!dependenciesError && !dependencies?.length && (
        <Alert variant="destructive" className="mb-5">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Su perfil no tiene una dependencia activa asignada. Solicite la
            corrección antes de radicar.
          </AlertDescription>
        </Alert>
      )}
      <DraftForm
        action={createCase}
        storageKey="sigj:new-case"
        className="space-y-5"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">
              1. Clasificación del asunto
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 md:col-span-2 xl:col-span-4">
              <Label htmlFor="ticket_name">Nombre de ticket / asunto breve</Label>
              <Input id="ticket_name" name="ticket_name" maxLength={120} placeholder="Ej. Tutela por acceso a información" />
              <p className="text-xs text-muted-foreground">Etiqueta interna opcional. No sustituye el título formal del expediente.</p>
            </div>
            <CatalogSelect
              label="Tipo de autoridad"
              name="authority_type"
              options={authorities}
            />
            <CatalogSelect
              label="Sala o despacho"
              name="chamber"
              options={chambers}
            />
            <CatalogSelect
              label="Clase de proceso"
              name="process_type"
              options={processTypes}
            />
            <CatalogSelect
              label="Subclase"
              name="process_subtype"
              options={subtypes}
            />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="dependency_id">
                Dependencia destino <Required />
              </Label>
              <select
                id="dependency_id"
                name="dependency_id"
                required
                className="h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">Seleccione…</option>
                {(dependencies ?? []).map((dependency) => (
                  <option key={dependency.id} value={dependency.id}>
                    {dependency.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">
              2. Partes principales
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <TextField
              label="Demandante / accionante / solicitante"
              name="claimant_name"
              required
            />
            <TextField
              label="Demandado / accionado / investigado (opcional)"
              name="defendant_name"
            />
            <TextField
              label="Identificación del solicitante (opcional)"
              name="claimant_document"
            />
            <TextField
              label="Identificación de la parte convocada (opcional)"
              name="defendant_document"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">
              3. Contenido y pretensiones
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <TextAreaField
              label="Resumen de hechos"
              name="summary"
              hint="Mínimo 20 caracteres."
              required
            />
            <TextAreaField
              label="Pretensiones o asunto (opcional)"
              name="claims"
            />
            <div className="max-w-sm">
              <TextField
                label="Cuantía (opcional)"
                name="amount"
                type="number"
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">
              4. Datos de recepción
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <TextField
              label="Departamento"
              name="department"
              defaultValue="Valle del Cauca"
              required
            />
            <TextField
              label="Municipio"
              name="municipality"
              defaultValue="Santiago de Cali"
              required
            />
            <TextField
              label="Fecha de recepción"
              name="filed_at"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
            <CatalogSelect
              label="Medio de recepción"
              name="reception_method"
              options={[
                "Ventanilla",
                "Correo institucional",
                "Reparto interno",
                "Remisión de juzgado",
                "Recurso",
              ]}
            />
            <SelectField
              label="Nivel de reserva"
              name="confidentiality_level"
              options={["Público", "Reservado", "Confidencial"]}
            />
            <div className="md:col-span-2 xl:col-span-3">
              <TextField label="Observaciones (opcional)" name="observations" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">
              5. Documentos anexos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {canUploadDocuments ? (
              <DocumentUploader />
            ) : (
              <p className="text-sm text-muted-foreground">
                Puede radicar el expediente, pero su perfil no tiene permiso
                para cargar anexos. Secretaría podrá agregarlos posteriormente.
              </p>
            )}
          </CardContent>
        </Card>
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="size-4 text-amber-800" />
          <AlertDescription className="text-amber-900">
            Los expedientes reservados o confidenciales nunca se publican
            automáticamente.
          </AlertDescription>
        </Alert>
        <div className="flex justify-end gap-3">
          <Button asChild type="button" variant="outline">
            <Link href="/admin/expedientes">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Radicando…">
            Radicar expediente
          </SubmitButton>
        </div>
      </DraftForm>
    </>
  );
}

function Required() {
  return <span className="text-red-600">*</span>;
}
function TextField({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label} {required && <Required />}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
      />
    </div>
  );
}
function TextAreaField({
  label,
  name,
  hint,
  required,
}: {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label} {required && <Required />}
      </Label>
      <Textarea
        id={name}
        name={name}
        required={required}
        className="min-h-28"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label} <Required />
      </Label>
      <select
        id={name}
        name={name}
        required
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      >
        <option value="">Seleccione…</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}
