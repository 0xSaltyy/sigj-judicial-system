import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { createGrandJuryAction } from "@/app/actions/matter-workflow";
import { AdminPageHeader } from "@/components/admin-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";

export default async function NewGrandJuryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [matterResult, courtsResult] = await Promise.all([
    supabase.from("matters").select("id,matter_number,title").eq("id", id).maybeSingle(),
    supabase.rpc("active_federal_courts"),
  ]);
  if (!matterResult.data) notFound();
  const matter = matterResult.data;
  const courts = (courtsResult.data ?? []).filter((court: { court_level: string }) => court.court_level === "District Court");
  return (
    <>
      <AdminPageHeader title="Create Grand Jury" description={`${matter.matter_number} · ${matter.title}`} action={<Button asChild variant="outline"><Link href={`/admin/matters/${matter.id}`}><ArrowLeft className="mr-2 size-4" /> Volver</Link></Button>} />
      {query.error ? <Alert variant="destructive" className="mb-5"><AlertTriangle className="size-4" /><AlertDescription>{query.error}</AlertDescription></Alert> : null}
      <form action={createGrandJuryAction}>
        <input type="hidden" name="matter_id" value={matter.id} />
        <Card>
          <CardHeader><CardTitle>Grand Jury protected setup</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label htmlFor="court_id">District Court</Label><select id="court_id" name="court_id" required className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="">Seleccione District Court…</option>{courts.map((court: { id: string; display_name?: string; official_name: string; abbreviation: string }) => <option key={court.id} value={court.id}>{court.display_name || court.official_name} ({court.abbreviation})</option>)}</select><p className="text-xs text-muted-foreground">Grand Jury no puede crearse en D.C. Circuit ni Ninth Circuit.</p></div>
            <Field name="jury_division" label="Jury division" />
            <Field name="supervising_judge" label="Supervising / impaneling Judge" />
            <Field name="foreperson" label="Foreperson" />
            <Field name="deputy_foreperson" label="Deputy Foreperson" />
            <Field name="active_grand_jurors" label="Number of active grand jurors" type="number" defaultValue="16" />
            <Field name="term_start" label="Term start" type="date" />
            <Field name="term_end" label="Term end" type="date" />
            <Field name="expected_schedule" label="Expected schedule" />
            <div className="space-y-2"><Label htmlFor="status">Status</Label><select id="status" name="status" className="h-10 w-full rounded-md border bg-white px-3 text-sm">{["Draft","Requested","Summoned","Impaneled","Active","Extended","Indictment returned","No bill","Discharged","Expired"].map((status) => <option key={status}>{status}</option>)}</select></div>
            <TextareaField name="notes" label="Protected notes" />
          </CardContent>
        </Card>
        <div className="mt-5 flex justify-end gap-2 rounded border bg-white p-4">
          <Button asChild variant="outline"><Link href={`/admin/matters/${matter.id}`}>Cancelar</Link></Button>
          <Button className="bg-[#153b5c]">Create Grand Jury</Button>
        </div>
      </form>
    </>
  );
}

function Field({ name, label, defaultValue, type = "text" }: { name: string; label: string; defaultValue?: string; type?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} defaultValue={defaultValue} /></div>;
}

function TextareaField({ name, label }: { name: string; label: string }) {
  return <div className="space-y-2 md:col-span-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} className="min-h-24" /></div>;
}
