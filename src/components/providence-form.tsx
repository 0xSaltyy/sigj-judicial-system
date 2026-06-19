"use client";

import { useState } from "react";
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
  const initialContent = proceeding?.content_markdown ?? templates[selected];
  return (
    <DraftForm
      action={createProceeding}
      storageKey={`sigj:proceeding:${proceeding?.id ?? "new"}`}
      className="space-y-5"
    >
      {proceeding && <input type="hidden" name="id" value={proceeding.id} />}
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
              onChange={(event) => setSelected(event.target.value)}
              className="h-9 w-full rounded-md border px-3 text-sm"
            >
              {names.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Número">
            <Input disabled placeholder="Se genera al guardar" />
          </Field>
          <Field label="Sala o despacho">
            <Input
              name="chamber"
              defaultValue={
                proceeding?.chamber ??
                cases.find((item) => item.id === initialCaseId)?.chamber ??
                "Despacho judicial"
              }
            />
          </Field>
          <Field label="Título">
            <Input
              key={proceeding?.id ?? selected}
              name="title"
              defaultValue={proceeding?.title ?? selected}
            />
          </Field>
          <Field label="Estado">
            <select
              name="status"
              defaultValue={proceeding?.status ?? "Borrador"}
              className="h-9 w-full rounded-md border px-3 text-sm"
            >
              <option>Borrador</option>
              <option>En revisión</option>
              <option>Firmado</option>
              <option>Publicado</option>
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
        </div>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <Label className="mb-3 block">Contenido</Label>
        <MarkdownEditor
          key={`${proceeding?.id ?? "new"}-${selected}`}
          initialValue={proceeding ? initialContent : templates[selected]}
        />
      </div>
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
