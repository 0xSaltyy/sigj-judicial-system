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
            <Field name="title" label="Title" required />
            <div className="space-y-2"><Label htmlFor="evidence_type">Evidence type</Label><select id="evidence_type" name="evidence_type" className="h-10 w-full rounded-md border bg-white px-3 text-sm">{evidenceTypes.map((type) => <option key={type}>{type}</option>)}</select></div>
            <Field name="source" label="Source" />
            <Field name="collection_at" label="Collection date/time" type="datetime-local" />
            <Field name="collection_location" label="Collection location" />
            <Field name="custodian" label="Current custodian" />
            <Field name="sha256_hash" label="SHA-256 hash (digital files)" />
            <Field name="access_classification" label="Access classification" defaultValue="Internal DOJ only" />
            <Field name="privilege_status" label="Privilege status" defaultValue="Not privileged" />
            <Field name="grand_jury_status" label="Grand-jury status" defaultValue="Not grand-jury material" />
            <Field name="authenticity_status" label="Authenticity status" defaultValue="Unverified" />
            <Field name="admissibility_status" label="Admissibility status" defaultValue="Internal evidence item" />
            <Field name="tags" label="Tags (comma separated)" />
            <label className="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" name="sealed" /> Sealed</label>
            <TextareaField name="description" label="Description" />
            <TextareaField name="relevance" label="Relevance" />
            <TextareaField name="condition" label="Condition at collection" />
            <TextareaField name="notes" label="Internal notes" />
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
