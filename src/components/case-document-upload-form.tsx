"use client";

import { useState } from "react";
import { AlertTriangle, LockKeyhole } from "lucide-react";
import { uploadCaseDocument } from "@/app/actions/documents";
import { DocumentUploader } from "@/components/document-uploader";
import { DraftForm } from "@/components/draft-form";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const types = [
  "Prueba",
  "Anexo",
  "Providencia relacionada",
  "Oficio",
  "Constancia",
  "Acta",
  "Comunicación",
  "Imagen",
  "Otro",
];

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-700">Revise este campo.</p>}
    </div>
  );
}

export function CaseDocumentUploadForm({
  caseId,
  publicEligible,
  errorField,
}: {
  caseId: string;
  publicEligible: boolean;
  errorField?: string;
}) {
  const [type, setType] = useState("Prueba");
  const [visibility, setVisibility] = useState<"reserved" | "internal" | "public">(
    publicEligible ? "internal" : "reserved",
  );

  return (
    <DraftForm
      action={uploadCaseDocument}
      storageKey={`sigj:case:${caseId}:document:new`}
      className="grid gap-6 rounded-lg border bg-white p-5 shadow-sm sm:p-7"
    >
      <input type="hidden" name="case_id" value={caseId} />

      <div aria-invalid={errorField === "file"}>
        <DocumentUploader
          name="file"
          multiple={false}
          required
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp"
          label="Seleccionar archivo"
          hint="PDF, Word, Excel, texto, CSV o imagen · máximo 20 MB"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Por seguridad, el archivo no puede conservarse entre envíos y deberá seleccionarse nuevamente si ocurre un error.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Título del documento *" htmlFor="title" error={errorField === "title"}>
          <Input id="title" name="title" required maxLength={180} aria-invalid={errorField === "title"} />
        </Field>
        <Field label="Tipo de documento *" htmlFor="document_type" error={errorField === "document_type"}>
          <select
            id="document_type"
            name="document_type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            onInput={(event) => setType(event.currentTarget.value)}
            className="h-9 rounded-md border bg-white px-3 text-sm"
            aria-invalid={errorField === "document_type"}
          >
            {types.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        {type === "Otro" && (
          <Field label="Especifique otro *" htmlFor="custom_type" error={errorField === "custom_type"}>
            <Input id="custom_type" name="custom_type" required maxLength={100} aria-invalid={errorField === "custom_type"} />
          </Field>
        )}
        <Field label="Fecha del documento" htmlFor="document_date" error={errorField === "document_date"}>
          <Input id="document_date" name="document_date" type="date" aria-invalid={errorField === "document_date"} />
        </Field>
        <Field label="Número de folios" htmlFor="folios" error={errorField === "folios"}>
          <Input id="folios" name="folios" type="number" min={1} max={100000} inputMode="numeric" aria-invalid={errorField === "folios"} />
        </Field>
        <Field label="Origen / remitente" htmlFor="source" error={errorField === "source"}>
          <Input id="source" name="source" maxLength={180} placeholder="Despacho, parte o entidad remitente" aria-invalid={errorField === "source"} />
        </Field>
        <Field label="Visibilidad *" htmlFor="visibility" error={errorField === "visibility"}>
          <select
            id="visibility"
            name="visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as typeof visibility)}
            onInput={(event) => setVisibility(event.currentTarget.value as typeof visibility)}
            className="h-9 rounded-md border bg-white px-3 text-sm"
            aria-invalid={errorField === "visibility"}
          >
            <option value="reserved">Reservado</option>
            <option value="internal">Interno</option>
            <option value="public" disabled={!publicEligible}>Público</option>
          </select>
          {!publicEligible && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5" /> El expediente no está habilitado para publicación.
            </p>
          )}
        </Field>
      </div>

      <Field label="Descripción" htmlFor="description" error={errorField === "description"}>
        <Textarea id="description" name="description" maxLength={2000} rows={5} aria-invalid={errorField === "description"} />
      </Field>

      {visibility === "public" && (
        <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <input type="checkbox" name="public_confirmed" value="true" required className="mt-0.5 size-4" />
          <span>
            <span className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Confirmar publicación</span>
            Verifiqué que el documento no contiene información reservada y autorizo su visibilidad pública.
          </span>
        </label>
      )}

      <div className="flex justify-end border-t pt-5">
        <SubmitButton pendingLabel="Agregando documento…" className="bg-[#153b5c]">
          Agregar documento
        </SubmitButton>
      </div>
    </DraftForm>
  );
}
