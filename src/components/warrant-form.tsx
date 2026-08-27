"use client";

import { useMemo, useState, useTransition } from "react";
import { Save, Send, FileText } from "lucide-react";
import { createRoleplayWarrant } from "@/app/actions/roleplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WarrantDocument } from "@/components/warrant-document";
import { getWarrantTemplate, normalizeWarrantData, warrantTemplates, type WarrantFormData } from "@/lib/warrants";

const baseData: WarrantFormData = {
  warrant_type: "search_seizure",
  court: "UNITED STATES DISTRICT COURT",
  district: "District of Columbia",
  division: "División Criminal",
  city_state: "Washington, D.C.",
  execution_window: "daytime",
  max_execution_days: "14",
  confidentiality: "internal",
  judge_title: "United States Magistrate Judge",
};

export function WarrantForm() {
  const [data, setData] = useState<WarrantFormData>(baseData);
  const [isPending, startTransition] = useTransition();
  const template = useMemo(() => getWarrantTemplate(data.warrant_type), [data.warrant_type]);

  function update(name: keyof WarrantFormData, value: string) {
    setData((current) => ({ ...current, [name]: value }));
  }

  function changeType(nextType: string) {
    if (JSON.stringify(data) !== JSON.stringify(baseData)) {
      const confirmed = window.confirm("Cambiar el tipo de warrant actualizará la plantilla y algunos campos específicos podrían dejar de mostrarse. Se conservarán los datos generales. ¿Desea continuar?");
      if (!confirmed) return;
    }
    const nextTemplate = getWarrantTemplate(nextType);
    setData((current) => ({ ...current, warrant_type: nextTemplate.key, warrant_title: nextTemplate.title }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(460px,.9fr)]">
      <form action={(formData) => startTransition(() => createRoleplayWarrant(formData))} className="space-y-5">
        <Section title="1. Identificación">
          <SelectField label="Tipo de warrant" name="warrant_type" value={data.warrant_type} onChange={changeType} options={warrantTemplates.map((item) => [item.key, item.label])} />
          {data.warrant_type === "custom" ? <TextField label="Título formal personalizado" name="warrant_title" value={data.warrant_title || ""} onChange={update} required /> : <input type="hidden" name="warrant_title" value={template.title} />}
          <TextField label="Número de caso relacionado" name="case_number" value={data.case_number || ""} onChange={update} />
          <TextField label="Tribunal" name="court" value={data.court || ""} onChange={update} required />
          <TextField label="Distrito" name="district" value={data.district || ""} onChange={update} required />
          <TextField label="División" name="division" value={data.division || ""} onChange={update} />
          <TextField label="Ciudad y estado" name="city_state" value={data.city_state || ""} onChange={update} required />
          <TextField label="Fecha y hora de emisión" name="issued_at" type="datetime-local" value={data.issued_at || ""} onChange={update} />
          <TextField label="Fecha y hora límite de ejecución" name="expires_at" type="datetime-local" value={data.expires_at || ""} onChange={update} />
        </Section>

        <Section title="2. Solicitante">
          <TextField label="Nombre del agente solicitante" name="applicant_name" value={data.applicant_name || ""} onChange={update} required />
          <TextField label="Cargo" name="applicant_title" value={data.applicant_title || ""} onChange={update} />
          <TextField label="Agencia o dependencia" name="applicant_agency" value={data.applicant_agency || ""} onChange={update} />
          <TextField label="Attorney for the government" name="attorney_name" value={data.attorney_name || ""} onChange={update} />
          <TextField label="Identificador interno" name="internal_reference" value={data.internal_reference || ""} onChange={update} />
        </Section>

        <Section title="3. Objeto del warrant">
          <TextAreaField label={template.targetLabel} name="target_description" value={data.target_description || ""} onChange={update} required />
          {template.conditionalFields.map((field) => field.name === "target_description" || field.name === "warrant_title" ? null : (
            field.type === "textarea"
              ? <TextAreaField key={field.name} label={field.label} name={field.name} value={String(data[field.name] || "")} onChange={update} />
              : <TextField key={field.name} label={field.label} name={field.name} type={field.type || "text"} value={String(data[field.name] || "")} onChange={update} />
          ))}
        </Section>

        <Section title="4. Fundamento">
          <TextAreaField label={template.probableCauseLabel} name="probable_cause" value={data.probable_cause || ""} onChange={update} required />
          <TextAreaField label="Hechos que sustentan la solicitud" name="legal_basis" value={data.legal_basis || ""} onChange={update} required />
          <TextAreaField label="Delitos o disposiciones aplicables" name="offenses" value={data.offenses || ""} onChange={update} />
        </Section>

        <Section title="5. Alcance y ejecución">
          <TextAreaField label={template.scopeLabel} name="items_to_search" value={data.items_to_search || ""} onChange={update} />
          <TextAreaField label="Elementos que pueden decomisarse, información o medidas autorizadas" name="items_to_seize" value={data.items_to_seize || ""} onChange={update} />
          <TextAreaField label="Limitaciones específicas" name="limitations" value={data.limitations || ""} onChange={update} />
          <SelectField label="Horario de ejecución" name="execution_window" value={data.execution_window || "daytime"} onChange={(value) => update("execution_window", value)} options={[["daytime", "Horario diurno"], ["anytime", "En cualquier momento por causa justificada"]]} />
          {data.execution_window === "anytime" ? <TextAreaField label="Justificación para ejecución nocturna o en cualquier momento" name="night_execution_reason" value={data.night_execution_reason || ""} onChange={update} required /> : null}
          <TextField label="Cantidad máxima de días" name="max_execution_days" value={data.max_execution_days || ""} onChange={update} />
          <TextAreaField label="Instrucciones especiales" name="special_instructions" value={data.special_instructions || ""} onChange={update} />
          <TextField label="Oficial responsable" name="responsible_officer" value={data.responsible_officer || ""} onChange={update} />
        </Section>

        <Section title="6. Autorización judicial">
          <TextField label="Juez o magistrado" name="judge_name" value={data.judge_name || ""} onChange={update} />
          <TextField label="Cargo judicial" name="judge_title" value={data.judge_title || ""} onChange={update} />
          <TextField label="Ciudad y estado de aprobación" name="approval_city_state" value={data.approval_city_state || ""} onChange={update} />
          <TextField label="Fecha y hora de aprobación" name="approved_at" type="datetime-local" value={data.approved_at || ""} onChange={update} />
          <SelectField label="Confidencialidad" name="confidentiality" value={data.confidentiality || "internal"} onChange={(value) => update("confidentiality", value)} options={[["public", "Público"], ["internal", "Interno"], ["reserved", "Reservado"], ["confidential", "Confidencial"]]} />
          <TextAreaField label="Return and Inventory" name="return_inventory" value={data.return_inventory || ""} onChange={update} />
          <TextAreaField label="Observaciones internas" name="observations" value={data.observations || ""} onChange={update} />
        </Section>

        <div className="sticky bottom-0 z-20 flex flex-wrap justify-end gap-3 border bg-white p-4">
          <Button type="submit" name="intent" value="draft" variant="outline" disabled={isPending} className="gap-2 rounded-none"><Save className="size-4" /> Guardar borrador</Button>
          <Button type="submit" name="intent" value="submit" disabled={isPending} className="gap-2 rounded-none bg-[#005ea8] hover:bg-[#1a4480]"><Send className="size-4" /> Presentar para revisión</Button>
        </div>
      </form>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#112f4e]"><FileText className="size-4" /> Vista previa del documento</div>
        <div className="max-h-[calc(100vh-8rem)] overflow-auto border bg-slate-100 p-4">
          <div className="origin-top scale-[.62] sm:scale-[.7] xl:scale-[.55] 2xl:scale-[.62]">
            <WarrantDocument data={normalizeWarrantData(data)} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border bg-white"><h2 className="border-b bg-slate-50 px-5 py-3 font-serif text-base font-semibold text-[#112f4e]">{title}</h2><div className="grid gap-4 p-5 md:grid-cols-2">{children}</div></section>;
}

function TextField({ label, name, value, onChange, type = "text", required = false }: { label: string; name: keyof WarrantFormData; value: string; onChange: (name: keyof WarrantFormData, value: string) => void; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}{required ? " *" : ""}</Label><Input id={name} name={name} type={type} value={value} required={required} onChange={(event) => onChange(name, event.target.value)} className="rounded-none" /></div>;
}

function TextAreaField({ label, name, value, onChange, required = false }: { label: string; name: keyof WarrantFormData; value: string; onChange: (name: keyof WarrantFormData, value: string) => void; required?: boolean }) {
  return <div className="space-y-2 md:col-span-2"><Label htmlFor={name}>{label}{required ? " *" : ""}</Label><Textarea id={name} name={name} value={value} required={required} onChange={(event) => onChange(name, event.target.value)} className="min-h-28 rounded-none" /></div>;
}

function SelectField({ label, name, value, onChange, options }: { label: string; name: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><select id={name} name={name} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-none border bg-white px-3 text-sm outline-none focus:border-[#005ea8]">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>;
}
