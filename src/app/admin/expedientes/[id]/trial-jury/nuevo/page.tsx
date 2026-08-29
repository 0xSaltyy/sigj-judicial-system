import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { createTrialJuryAction } from "@/app/actions/matter-workflow";
import { AdminPageHeader } from "@/components/admin-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";

export default async function NewTrialJuryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: item } = await supabase.from("cases").select("id,case_number,internal_number,case_caption,title,case_category,court_id").eq("id", id).maybeSingle();
  if (!item) notFound();
  return (
    <>
      <AdminPageHeader title="Create Trial Jury" description={`${item.case_number || item.internal_number} · ${item.case_caption || item.title}`} action={<Button asChild variant="outline"><Link href={`/admin/expedientes/${item.id}`}><ArrowLeft className="mr-2 size-4" /> Volver</Link></Button>} />
      {query.error ? <Alert variant="destructive" className="mb-5"><AlertTriangle className="size-4" /><AlertDescription>{query.error}</AlertDescription></Alert> : null}
      <form action={createTrialJuryAction}>
        <input type="hidden" name="case_id" value={item.id} />
        <Card>
          <CardHeader><CardTitle>Trial Jury protected setup</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field name="panel_name" label="Editable jury name" defaultValue={`Trial Jury — ${item.case_caption || item.title}`} />
            <Field name="proceeding_number" label="Internal proceeding number" defaultValue={item.case_number || item.internal_number || ""} />
            <Field name="district" label="District" />
            <Field name="judge" label="Judge" />
            <Field name="constitution_date" label="Constitution / jury-selection date" type="date" />
            <Field name="expiration_date" label="Expiration / discharge date" type="date" />
            <Field name="trial_start_date" label="Trial start date" type="date" />
            <Field name="courtroom" label="Courtroom" />
            <div className="space-y-2"><Label htmlFor="jury_type">Jury type</Label><select id="jury_type" name="jury_type" defaultValue={item.case_category === "Civil" ? "Civil Petit Jury" : "Criminal Petit Jury"} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option>Criminal Petit Jury</option><option>Civil Petit Jury</option><option>Advisory Jury</option></select></div>
            <Field name="selected_panel_size" label="Selected compact panel size" type="number" defaultValue="9" />
            <p className="rounded border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900 md:col-span-2">Compact server limit: minimum 5, default 9, maximum 15. A criminal Trial Jury verdict must be unanimous among all eligible deliberating jurors.</p>
            <Field name="alternates_count" label="Number of alternates" type="number" defaultValue="0" />
            <Field name="prospective_panel_size" label="Prospective panel size" type="number" />
            <div className="space-y-2"><Label htmlFor="status">Status</Label><select id="status" name="status" className="h-10 w-full rounded-md border bg-white px-3 text-sm">{["Draft","Impaneled","Active","Deliberating","Voting","Returned","Discharged","Sealed"].map((status) => <option key={status}>{status}</option>)}</select></div>
            <label className="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" name="anonymous_jury" /> Anonymous jury protections</label>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="final_jury_instructions">Final jury instructions</Label><Textarea id="final_jury_instructions" name="final_jury_instructions" className="min-h-24" /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="internal_description">Internal description</Label><Textarea id="internal_description" name="internal_description" className="min-h-24" /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="special_protections">Special protections</Label><Textarea id="special_protections" name="special_protections" className="min-h-24" /></div>
          </CardContent>
        </Card>
        <div className="mt-5 flex justify-end gap-2 rounded border bg-white p-4">
          <Button asChild variant="outline"><Link href={`/admin/expedientes/${item.id}`}>Cancelar</Link></Button>
          <Button className="bg-[#153b5c]">Create Trial Jury</Button>
        </div>
      </form>
    </>
  );
}

function Field({ name, label, defaultValue, type = "text" }: { name: string; label: string; defaultValue?: string; type?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} defaultValue={defaultValue} /></div>;
}
