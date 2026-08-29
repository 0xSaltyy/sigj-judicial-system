import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { updateFederalCaseControlled } from "@/app/actions/matter-workflow";
import { AdminPageHeader } from "@/components/admin-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/display";

export default async function EditFederalCasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [caseResult, courtsResult] = await Promise.all([
    supabase.from("cases").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("active_federal_courts"),
  ]);
  if (!caseResult.data) notFound();
  const item = caseResult.data;
  const courts = courtsResult.data ?? [];
  return (
    <>
      <AdminPageHeader title="Editar Federal Case" description={`${item.case_number || item.internal_number} · ${item.case_caption || item.title}`} action={<Button asChild variant="outline"><Link href={`/admin/expedientes/${item.id}`}><ArrowLeft className="mr-2 size-4" /> Volver</Link></Button>} />
      {query.error ? <Alert variant="destructive" className="mb-5"><AlertTriangle className="size-4" /><AlertDescription>{query.error}</AlertDescription></Alert> : null}
      <form action={updateFederalCaseControlled} className="space-y-5">
        <input type="hidden" name="case_id" value={item.id} />
        <Card>
          <CardHeader><CardTitle>Identificadores protegidos</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <ReadOnly label="Case Number" value={item.case_number || item.internal_number} />
            <ReadOnly label="Judicial Number heredado" value={item.judicial_number} />
            <ReadOnly label="Creado" value={formatDateTime(item.created_at)} />
            <input type="hidden" name="case_number" value={item.case_number || ""} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Metadatos editables</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field name="title" label="Título interno" defaultValue={item.title} required />
            <Field name="case_caption" label="Case caption" defaultValue={item.case_caption || ""} />
            <div className="space-y-2">
              <Label htmlFor="court_id">Federal court</Label>
              <select id="court_id" name="court_id" defaultValue={item.court_id || ""} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                <option value="">Court pending</option>
                {courts.map((court: { id: string; display_name?: string; official_name: string; abbreviation: string }) => <option key={court.id} value={court.id}>{court.display_name || court.official_name} ({court.abbreviation})</option>)}
              </select>
            </div>
            <SelectField name="case_category" label="Case category" defaultValue={item.case_category} options={["Civil","Criminal","Miscellaneous","Magistrate Judge proceeding","Appeal","Petition for Review","Original proceeding"]} />
            <Field name="filing_type" label="Filing type" defaultValue={item.process_subtype} />
            <Field name="docket_number" label="Docket Number (Clerk)" defaultValue={item.docket_number || ""} />
            <Field name="filed_at" label="Filing date" type="datetime-local" defaultValue={item.filed_at ? item.filed_at.slice(0, 16) : ""} />
            <SelectField name="federal_access_level" label="Access" defaultValue={item.federal_access_level} options={["Public","Restricted","Internal DOJ only","Sealed","Grand-jury restricted"]} />
            <Field name="jury_demand" label="Jury demand / election" defaultValue={item.jury_demand || ""} />
            <Field name="trial_type" label="Trial type" defaultValue={item.trial_type || ""} />
            <label className="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" name="sealed" defaultChecked={Boolean(item.sealed)} /> Sealed</label>
            <label className="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" name="public_visibility" defaultChecked={Boolean(item.public_visibility)} /> Public-safe</label>
            <TextareaField name="summary" label="Summary" defaultValue={item.summary} />
            <TextareaField name="claims" label="Claims / relief" defaultValue={item.claims} />
            <TextareaField name="observations" label="Access notes / observations" defaultValue={item.observations || ""} />
            <TextareaField name="reason" label="Razón de auditoría para cambios sensibles" required />
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2 rounded border bg-white p-4">
          <Button asChild variant="outline"><Link href={`/admin/expedientes/${item.id}`}>Cancelar</Link></Button>
          <Button className="bg-[#153b5c]">Guardar Federal Case</Button>
        </div>
      </form>
    </>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div className="rounded border bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function Field({ name, label, defaultValue, type = "text", required }: { name: string; label: string; defaultValue?: string; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} /></div>;
}

function SelectField({ name, label, defaultValue, options }: { name: string; label: string; defaultValue: string; options: string[] }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><select id={name} name={name} defaultValue={defaultValue} className="h-10 w-full rounded-md border bg-white px-3 text-sm">{options.map((option) => <option key={option}>{option}</option>)}</select></div>;
}

function TextareaField({ name, label, defaultValue = "", required }: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return <div className="space-y-2 md:col-span-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} defaultValue={defaultValue} required={required} className="min-h-28" /></div>;
}
