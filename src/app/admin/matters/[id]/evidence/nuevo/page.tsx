import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { createEvidenceItemAction } from "@/app/actions/matter-workflow";
import { AdminPageHeader } from "@/components/admin-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";

const evidenceTypes = ["Document","Photograph","Video","Audio","Digital file","Device","Physical item","Email","Message or communication","Financial record","Business record","Government record","Witness statement","Affidavit","Expert material","Surveillance material","Search-warrant return","Seized property","Other"];

export default async function NewEvidenceForMatterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: matter } = await supabase.from("matters").select("id,matter_number,title").eq("id", id).maybeSingle();
  if (!matter) notFound();
  return (
    <>
      <AdminPageHeader title="Add Evidence Item" description={`${matter.matter_number} · ${matter.title}`} action={<Button asChild variant="outline"><Link href={`/admin/matters/${matter.id}`}><ArrowLeft className="mr-2 size-4" /> Volver</Link></Button>} />
      {query.error ? <Alert variant="destructive" className="mb-5"><AlertTriangle className="size-4" /><AlertDescription>{query.error}</AlertDescription></Alert> : null}
      <form action={createEvidenceItemAction}>
        <input type="hidden" name="matter_id" value={matter.id} />
        <Card>
          <CardHeader><CardTitle>Evidence metadata and custody</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-slate-50 p-6 text-center transition hover:bg-slate-100 md:col-span-2">
              <span className="text-sm font-semibold text-[#153553]">Cargar archivo probatorio</span>
              <span className="mt-1 text-xs text-muted-foreground">Arrastre y suelte aquí o seleccione un archivo. PDF, imagen, audio, video, texto o binario seguro · máximo 100 MB.</span>
              <Input name="evidence_file" type="file" required accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt,.mp4,.mov,.webm,.mp3,.wav,.m4a,.aac,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp,text/plain,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/wave,audio/x-wav,audio/mp4,audio/aac,application/octet-stream" className="mt-4 max-w-md bg-white" />
            </label>
            <Field name="title" label="Title" required />
            <div className="space-y-2"><Label htmlFor="evidence_type">Evidence type</Label><select id="evidence_type" name="evidence_type" className="h-10 w-full rounded-md border bg-white px-3 text-sm">{evidenceTypes.map((type) => <option key={type}>{type}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="exhibit_designation">Exhibit designation</Label><select id="exhibit_designation" name="exhibit_designation" className="h-10 w-full rounded-md border bg-white px-3 text-sm">{["Government Exhibit","Defense Exhibit","Joint Exhibit","Court Exhibit","Grand Jury Exhibit","Investigative Exhibit"].map((type) => <option key={type}>{type}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="evidence_status">Estado</Label><select id="evidence_status" name="evidence_status" className="h-10 w-full rounded-md border bg-white px-3 text-sm">{["received","pending review","verified","admitted","excluded","sealed","returned","archived"].map((type) => <option key={type}>{type}</option>)}</select></div>
            <Field name="source" label="Source" />
            <Field name="obtained_from" label="Persona que lo entregó / obtained from" />
            <Field name="collection_method" label="Método de obtención" />
            <Field name="collection_at" label="Collection date/time" type="datetime-local" />
            <Field name="collection_location" label="Collection location" />
            <Field name="custodian" label="Current custodian" />
            <Field name="access_classification" label="Access classification" defaultValue="Internal DOJ only" />
            <Field name="privilege_status" label="Privilege status" defaultValue="Not privileged" />
            <Field name="grand_jury_status" label="Grand-jury status" defaultValue="Not grand-jury material" />
            <Field name="authenticity_status" label="Authenticity status" defaultValue="Unverified" />
            <Field name="admissibility_status" label="Admissibility status" defaultValue="Internal evidence item" />
            <Field name="tags" label="Tags (comma separated)" />
            <label className="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" name="sealed" /> Sealed</label>
            <label className="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" name="contains_sensitive_information" /> Contiene información sensible</label>
            <TextareaField name="description" label="Description" />
            <TextareaField name="relevance" label="Relevance" />
            <TextareaField name="condition" label="Condition at collection" />
            <TextareaField name="notes" label="Internal notes" />
            <TextareaField name="reason" label="Razón de carga/vinculación" />
          </CardContent>
        </Card>
        <div className="mt-5 flex justify-end gap-2 rounded border bg-white p-4">
          <Button asChild variant="outline"><Link href={`/admin/matters/${matter.id}`}>Cancelar</Link></Button>
          <Button className="bg-[#153b5c]">Register Evidence Item</Button>
        </div>
      </form>
    </>
  );
}

function Field({ name, label, defaultValue, type = "text", required }: { name: string; label: string; defaultValue?: string; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} /></div>;
}

function TextareaField({ name, label }: { name: string; label: string }) {
  return <div className="space-y-2 md:col-span-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} className="min-h-24" /></div>;
}
