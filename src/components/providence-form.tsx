"use client";

import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import { createProceeding } from "@/app/actions/proceedings";
import { DraftForm } from "@/components/draft-form";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { templates } from "@/lib/demo-data";

type CaseOption = { id: string; internal_number: string; chamber: string };
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
};

export function ProvidenceForm({
  cases,
  initialCaseId,
  proceeding,
}: {
  cases: CaseOption[];
  initialCaseId?: string;
  proceeding?: Proceeding;
}) {
  const names = Object.keys(templates);
  const [selected, setSelected] = useState(proceeding?.type ?? names[0]);
  const [mode, setMode] = useState(proceeding?.creation_mode ?? "editor");
  const initialContent = proceeding?.content_markdown ?? templates[selected];
  return (
    <DraftForm
      action={createProceeding}
      storageKey={`sigj:proceeding:${proceeding?.id ?? "new"}`}
      className="space-y-5"
    >
      {proceeding && <input type="hidden" name="id" value={proceeding.id} />}
      <div className="rounded-lg border bg-white p-6">
        <Label className="mb-3 block">Modo de creación</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["editor", "Redactar en el sistema", FileText],
              ["pdf", "Subir PDF existente", Upload],
              ["mixed", "Metadata + PDF + resumen", FileText],
            ] as const
          ).map(([value, label, Icon]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border p-4 ${mode === value ? "border-[#8a6a2c] bg-amber-50" : ""}`}
            >
              <input
                type="radio"
                name="creation_mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                className="sr-only"
              />
              <Icon className="mb-2 size-5" />
              <span className="text-sm font-semibold">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Expediente *">
            <select
              name="case_id"
              defaultValue={proceeding?.case_id ?? initialCaseId}
              className="h-9 w-full rounded-md border px-3 text-sm"
              required
            >
              <option value="">Seleccione…</option>
              {cases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.internal_number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo / plantilla *">
            <select
              name="type"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="h-9 w-full rounded-md border px-3 text-sm"
            >
              {names.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Fecha de providencia *">
            <Input
              type="date"
              name="providence_date"
              defaultValue={
                proceeding?.providence_date ??
                new Date().toISOString().slice(0, 10)
              }
              required
            />
          </Field>
          <Field label="Sala o despacho *">
            <Input
              name="chamber"
              defaultValue={
                proceeding?.chamber ??
                cases.find((item) => item.id === initialCaseId)?.chamber ??
                "Despacho judicial"
              }
              required
            />
          </Field>
          <Field label="Título *">
            <Input
              key={proceeding?.id ?? selected}
              name="title"
              defaultValue={proceeding?.title ?? selected}
              required
            />
          </Field>
          <Field label="Estado">
            <select
              name="status"
              defaultValue={
                proceeding?.status === "En revisión"
                  ? "En revisión"
                  : "Borrador"
              }
              className="h-9 w-full rounded-md border px-3 text-sm"
            >
              <option>Borrador</option>
              <option>En revisión</option>
            </select>
          </Field>
          <Field label="Visibilidad">
            <select
              name="visibility"
              defaultValue={proceeding?.visibility ?? "internal"}
              className="h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="internal">Interna</option>
              <option value="public">Pública</option>
              <option value="reserved">Reservada</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              name="requires_signature"
              value="true"
              defaultChecked={proceeding?.requires_signature ?? true}
            />
            Requiere firma antes de publicar
          </label>
        </div>
      </div>
      {mode !== "editor" && (
        <div className="rounded-lg border bg-white p-6">
          <Label htmlFor="pdf_file">
            Archivo PDF{" "}
            {proceeding?.pdf_original_name
              ? "(opcional para conservar el actual)"
              : "*"}
          </Label>
          {proceeding?.pdf_original_name && (
            <p className="mt-1 text-xs text-muted-foreground">
              Actual: {proceeding.pdf_original_name}
            </p>
          )}
          <Input
            id="pdf_file"
            name="pdf_file"
            type="file"
            accept="application/pdf,.pdf"
            required={!proceeding?.pdf_original_name}
            className="mt-3"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            PDF privado, máximo 50 MB. Si el guardado falla, deberá volver a
            seleccionarlo.
          </p>
        </div>
      )}{" "}
      {(mode === "editor" || mode === "mixed") && (
        <div className="rounded-lg border bg-white p-6">
          <Label className="mb-3 block">
            {mode === "mixed"
              ? "Resumen o texto complementario (opcional)"
              : "Contenido *"}
          </Label>
          <MarkdownEditor
            key={`${proceeding?.id ?? "new"}-${selected}`}
            initialValue={proceeding ? initialContent : templates[selected]}
          />
        </div>
      )}{" "}
      {mode === "pdf" && (
        <input
          type="hidden"
          name="content_markdown"
          value="# Documento PDF adjunto"
        />
      )}
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Guardando…">
          {proceeding ? "Guardar cambios" : "Guardar providencia"}
        </SubmitButton>
      </div>
    </DraftForm>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
