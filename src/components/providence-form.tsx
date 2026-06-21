"use client";

import { useEffect, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { createProceeding } from "@/app/actions/proceedings";
import { DraftForm } from "@/components/draft-form";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DOCUMENT_TEMPLATES,
  PROVIDENCE_TYPES,
  TEMPLATE_STYLE_LABELS,
  TEMPLATE_STYLES,
  inferTemplateStyle,
  type DocumentMetadata,
  type TemplateStyle,
} from "@/lib/document-templates";

export type CaseOption = {
  id: string;
  internal_number: string;
  judicial_number?: string | null;
  chamber: string;
  authority_type?: string | null;
  claimant_name?: string | null;
  defendant_name?: string | null;
  municipality?: string | null;
  dependency_name?: string | null;
};

type Proceeding = {
  id: string;
  case_id: string;
  type: string;
  title: string;
  chamber: string;
  content_markdown: string;
  status: string;
  visibility: string;
  creation_mode?: "editor" | "pdf" | "mixed";
  providence_date?: string | null;
  requires_signature?: boolean;
  pdf_original_name?: string | null;
  template_key?: string | null;
  template_style?: TemplateStyle | null;
  document_metadata?: DocumentMetadata | null;
};

export function ProvidenceForm({
  cases,
  initialCaseId,
  proceeding,
  readOnly = false,
}: {
  cases: CaseOption[];
  initialCaseId?: string;
  proceeding?: Proceeding;
  readOnly?: boolean;
}) {
  const requestedCaseId = proceeding?.case_id ?? initialCaseId ?? "";
  const initialCase = cases.find((item) => item.id === requestedCaseId);
  const initialStyle = proceeding?.template_style && proceeding.template_style !== "auto"
    ? proceeding.template_style
    : inferTemplateStyle([initialCase?.dependency_name, initialCase?.authority_type, initialCase?.chamber]);
  const knownType = proceeding && PROVIDENCE_TYPES.includes(proceeding.type);
  const initialTemplateKey = proceeding?.template_key || DOCUMENT_TEMPLATES.find((item) => item.label === (knownType ? proceeding.type : PROVIDENCE_TYPES[0]))?.key || (initialStyle === "corte_suprema" ? "corte_suprema_base" : "blank");
  const [selectedType, setSelectedType] = useState(knownType ? proceeding.type : proceeding ? "__other" : PROVIDENCE_TYPES[0]);
  const [customType, setCustomType] = useState(knownType ? "" : proceeding?.type || "");
  const [selectedCaseId, setSelectedCaseId] = useState(requestedCaseId);
  const [templateKey, setTemplateKey] = useState(initialTemplateKey);
  const [templateStyle, setTemplateStyle] = useState<TemplateStyle>(proceeding?.template_style || "auto");
  const [mode, setMode] = useState(proceeding?.creation_mode ?? "editor");
  const [title, setTitle] = useState(proceeding?.title ?? PROVIDENCE_TYPES[0]);
  const [content, setContent] = useState(proceeding?.content_markdown ?? (DOCUMENT_TEMPLATES.find((item) => item.key === initialTemplateKey)?.content ?? DOCUMENT_TEMPLATES[0].content));
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const selectedCase = cases.find((item) => item.id === selectedCaseId);
  const selectedTemplate = DOCUMENT_TEMPLATES.find((item) => item.key === templateKey) || DOCUMENT_TEMPLATES[0];
  const metadata = proceeding?.document_metadata || {};
  const date = proceeding?.providence_date ?? new Date().toISOString().slice(0, 10);
  const resolvedStyle = templateStyle === "auto"
    ? inferTemplateStyle([selectedCase?.dependency_name, selectedCase?.authority_type, selectedCase?.chamber])
    : templateStyle;

  useEffect(() => () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
  }, [pdfPreviewUrl]);

  const previewContext = {
    judicialNumber: selectedCase?.judicial_number,
    internalNumber: selectedCase?.internal_number,
    providenceDate: date,
    chamber: selectedCase?.chamber,
    dependency: selectedCase?.dependency_name,
    documentType: selectedType === "__other" ? customType : selectedType,
    title,
    city: metadata.city || selectedCase?.municipality || undefined,
    roomName: metadata.roomName,
    rapporteurName: metadata.rapporteurName,
    secretaryName: metadata.secretaryName,
    claimantName: metadata.claimantName || selectedCase?.claimant_name || undefined,
    defendantName: metadata.defendantName || selectedCase?.defendant_name || undefined,
    linkedPartyName: metadata.linkedPartyName,
    subject: metadata.subject || title,
  };

  function changeType(next: string) {
    const currentResolved = selectedType === "__other" ? customType : selectedType;
    setSelectedType(next);
    if (!proceeding && (!title || title === currentResolved)) {
      setTitle(next === "__other" ? "" : next);
    }
    const suggested = DOCUMENT_TEMPLATES.find((item) => item.label === next);
    if (suggested && suggested.key !== templateKey) applyTemplate(suggested.key);
  }

  function applyTemplate(nextKey: string) {
    const next = DOCUMENT_TEMPLATES.find((item) => item.key === nextKey) ?? DOCUMENT_TEMPLATES[0];
    if (content.trim() && content !== selectedTemplate.content && !window.confirm("¿Reemplazar el contenido actual por esta plantilla? Los cambios no guardados del editor se sustituirán.")) return;
    setTemplateKey(next.key);
    setContent(next.content);
  }

  function previewPdf(file?: File) {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  return (
    <DraftForm action={createProceeding} storageKey={`sigj:proceeding:${proceeding?.id ?? "new"}`} className="space-y-5">
      {proceeding && <input type="hidden" name="id" value={proceeding.id} />}
      <fieldset disabled={readOnly} className="space-y-5 disabled:opacity-75">
      <div className="rounded-lg border bg-white p-6">
        <Label className="mb-3 block">Modo de creación</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["editor", "Redactar en el sistema", FileText],
            ["pdf", "Subir PDF existente", Upload],
            ["mixed", "PDF + resumen formal", FileText],
          ] as const).map(([value, label, Icon]) => (
            <label key={value} className={`cursor-pointer rounded-lg border p-4 ${mode === value ? "border-[#8a6a2c] bg-amber-50" : ""}`}>
              <input type="radio" name="creation_mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
              <Icon className="mb-2 size-5" />
              <span className="text-sm font-semibold">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Expediente *">
            <select name="case_id" value={selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)} className="h-9 w-full rounded-md border px-3 text-sm" required>
              <option value="">Seleccione…</option>
              {cases.map((item) => <option key={item.id} value={item.id}>{item.internal_number}</option>)}
            </select>
          </Field>
          <Field label="Tipo de providencia *">
            <select name="type" value={selectedType} onChange={(event) => changeType(event.target.value)} className="h-9 w-full rounded-md border px-3 text-sm" required>
              {PROVIDENCE_TYPES.map((name) => <option key={name} value={name}>{name}</option>)}
              <option value="__other">Otro / personalizado</option>
            </select>
            {selectedType === "__other" && <Input name="custom_type" value={customType} onChange={(event) => setCustomType(event.target.value)} placeholder="Especifique otro tipo…" required />}
          </Field>
          <Field label="Fecha de providencia *"><Input type="date" name="providence_date" defaultValue={date} required /></Field>
          <Field label="Sala o despacho *"><Input name="chamber" defaultValue={proceeding?.chamber ?? selectedCase?.chamber ?? "Despacho judicial"} placeholder="Especifique sala o despacho" required /></Field>
          <Field label="Título editable *"><Input name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título formal del documento" required /></Field>
          <Field label="Estado">
            <select name="status" defaultValue={proceeding?.status === "En revisión" ? "En revisión" : "Borrador"} className="h-9 w-full rounded-md border px-3 text-sm">
              <option>Borrador</option><option>En revisión</option>
            </select>
          </Field>
          <Field label="Visibilidad">
            <select name="visibility" defaultValue={proceeding?.visibility ?? "internal"} className="h-9 w-full rounded-md border px-3 text-sm">
              <option value="internal">Interna</option><option value="public">Pública</option><option value="reserved">Reservada</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <input type="checkbox" name="requires_signature" value="true" defaultChecked={proceeding?.requires_signature ?? true} />
            Requiere firma antes de publicar
          </label>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="font-semibold text-[#153553]">Formato institucional</h2>
        <p className="mt-1 text-xs text-muted-foreground">El estilo automático detectado para este expediente es: {TEMPLATE_STYLE_LABELS[resolvedStyle]}.</p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Field label={mode === "pdf" ? "Estilo de portada / hoja de firmas (opcional)" : "Estilo de impresión"}>
            <select name="template_style" value={templateStyle} onChange={(event) => setTemplateStyle(event.target.value as TemplateStyle)} className="h-9 w-full rounded-md border px-3 text-sm">
              {TEMPLATE_STYLES.map((style) => <option key={style} value={style}>{TEMPLATE_STYLE_LABELS[style]}</option>)}
            </select>
          </Field>
          {mode !== "pdf" && (
            <Field label="Plantilla de contenido *">
              <select name="template_key" value={templateKey} onChange={(event) => applyTemplate(event.target.value)} className="h-9 w-full rounded-md border px-3 text-sm" required>
                {DOCUMENT_TEMPLATES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
              {templateKey === "custom" && (
                <>
                  <Input name="custom_template_name" defaultValue={metadata.customTemplateName || ""} placeholder="Especifique otra plantilla…" required />
                  <p className="text-xs text-muted-foreground">La plantilla personalizada inicia con un cuerpo formal en blanco.</p>
                </>
              )}
            </Field>
          )}
          {mode === "pdf" && <input type="hidden" name="template_key" value="" />}
        </div>
        {resolvedStyle === "corte_suprema" && templateKey !== "corte_suprema_base" && mode !== "pdf" && (
          <p className="mt-4 text-xs text-muted-foreground">
            Para iniciar con VISTOS, CONSIDERANDO y RESUELVE, seleccione “Corte Suprema · Providencia base”.
          </p>
        )}
        <details className="mt-5 rounded-lg border p-4" open={resolvedStyle === "tribunal_superior" || resolvedStyle === "corte_suprema"}>
          <summary className="cursor-pointer text-sm font-semibold">Metadatos y marcadores del documento</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetaField label="Ciudad" name="city" value={metadata.city || selectedCase?.municipality || "Bogotá, D.C."} />
            <MetaField label="Sala" name="room_name" value={metadata.roomName || proceeding?.chamber || selectedCase?.chamber} />
            <MetaField label="Código de documento (AP/STC/Auto)" name="document_code" value={metadata.documentCode} />
            <MetaField label="Acta de aprobación" name="act_number" value={metadata.actNumber} />
            <MetaField label="Magistrado/a ponente" name="rapporteur_name" value={metadata.rapporteurName} />
            <MetaField label="Secretario/a" name="secretary_name" value={metadata.secretaryName} />
            <MetaField label="Accionante" name="claimant_name" value={metadata.claimantName || selectedCase?.claimant_name} />
            <MetaField label="Accionado" name="defendant_name" value={metadata.defendantName || selectedCase?.defendant_name} />
            <MetaField label="Presunta vinculada / tercero" name="linked_party_name" value={metadata.linkedPartyName} />
            <MetaField label="Asunto" name="subject" value={metadata.subject || title} />
            <div className="md:col-span-2 xl:col-span-3"><MetaField label="Notas al pie / referencias" name="footnotes" value={metadata.footnotes} /></div>
          </div>
        </details>
      </div>

      {mode !== "editor" && (
        <div className="rounded-lg border bg-white p-6">
          <Label htmlFor="pdf_file">Archivo PDF {proceeding?.pdf_original_name ? "(opcional para conservar el actual)" : "*"}</Label>
          {proceeding?.pdf_original_name && <p className="mt-1 text-xs text-muted-foreground">Actual: {proceeding.pdf_original_name}</p>}
          <Input id="pdf_file" name="pdf_file" type="file" accept="application/pdf,.pdf" required={!proceeding?.pdf_original_name} className="mt-3" onChange={(event) => previewPdf(event.target.files?.[0])} />
          <p className="mt-2 text-xs text-muted-foreground">PDF privado, máximo 50 MB. La plantilla de redacción no es obligatoria en este modo.</p>
          {pdfPreviewUrl && <iframe src={pdfPreviewUrl} title="Vista previa del PDF seleccionado" className="mt-4 h-[560px] w-full rounded border" />}
        </div>
      )}

      {(mode === "editor" || mode === "mixed") && (
        <div className="rounded-lg border bg-white p-6">
          <Label className="mb-3 block">{mode === "mixed" ? "Resumen o texto complementario (opcional)" : "Contenido *"}</Label>
          <MarkdownEditor initialValue={content} value={content} onValueChange={setContent} previewContext={previewContext} />
        </div>
      )}
      {mode === "pdf" && <input type="hidden" name="content_markdown" value="# Documento PDF adjunto" />}
      <div className="flex justify-end"><SubmitButton pendingLabel="Guardando…">{proceeding ? "Guardar cambios" : "Guardar providencia"}</SubmitButton></div>
      </fieldset>
    </DraftForm>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2 text-sm"><span className="font-medium">{label}</span>{children}</label>;
}

function MetaField({ label, name, value }: { label: string; name: string; value?: string | null }) {
  return <Field label={label}><Input name={name} defaultValue={value || ""} placeholder="Opcional" /></Field>;
}
