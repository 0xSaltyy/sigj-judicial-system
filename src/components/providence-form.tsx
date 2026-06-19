"use client";
import { useState } from "react";
import { createProceeding } from "@/app/actions/proceedings";
import { templates } from "@/lib/demo-data";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CaseOption = { id: string; internal_number: string; chamber: string };
export function ProvidenceForm({ cases, initialCaseId }: { cases: CaseOption[]; initialCaseId?: string }) {
  const names = Object.keys(templates); const [selected, setSelected] = useState(names[0]);
  return <form action={createProceeding} className="space-y-5"><div className="rounded-lg border bg-white p-6"><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"><Field label="Expediente"><select name="case_id" defaultValue={initialCaseId} className="h-9 w-full rounded-md border px-3 text-sm" required><option value="">Seleccione…</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.internal_number}</option>)}</select></Field><Field label="Tipo / plantilla"><select name="type" value={selected} onChange={(e) => setSelected(e.target.value)} className="h-9 w-full rounded-md border px-3 text-sm">{names.map((name) => <option key={name}>{name}</option>)}</select></Field><Field label="Número"><Input disabled placeholder="Se genera al guardar" /></Field><Field label="Sala o despacho"><Input name="chamber" defaultValue={cases.find((c) => c.id === initialCaseId)?.chamber ?? "Despacho judicial"} required /></Field><Field label="Título"><Input name="title" defaultValue={selected} key={selected} required /></Field><Field label="Estado"><select name="status" className="h-9 w-full rounded-md border px-3 text-sm"><option>Borrador</option><option>En revisión</option><option>Firmado</option><option>Publicado</option></select></Field><Field label="Visibilidad"><select name="visibility" className="h-9 w-full rounded-md border px-3 text-sm"><option value="internal">Interna</option><option value="public">Pública</option><option value="reserved">Reservada</option></select></Field></div></div><div className="rounded-lg border bg-white p-6"><Label className="mb-3 block">Contenido de la providencia</Label><MarkdownEditor key={selected} initialValue={templates[selected]} /></div><div className="flex justify-end"><SubmitButton pendingLabel="Guardando…">Guardar providencia</SubmitButton></div></form>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
