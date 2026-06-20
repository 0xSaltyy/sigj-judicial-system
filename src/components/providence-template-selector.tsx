import { DOCUMENT_TEMPLATES } from "@/lib/document-templates";

export function ProvidenceTemplateSelector({ name = "template_key", defaultValue }: { name?: string; defaultValue?: string }) {
  return (
    <select name={name} defaultValue={defaultValue ?? DOCUMENT_TEMPLATES[0].key} className="h-9 w-full rounded-md border px-3 text-sm">
      {DOCUMENT_TEMPLATES.map((template) => <option key={template.key} value={template.key}>{template.label}</option>)}
    </select>
  );
}
