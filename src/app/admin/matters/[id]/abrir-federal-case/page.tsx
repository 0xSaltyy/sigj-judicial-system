import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { openFederalCaseFromMatter } from "@/app/actions/matter-workflow";
import { AdminPageHeader } from "@/components/admin-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import { safeText } from "@/lib/display";

type CourtRow = {
  id: string;
  official_name: string;
  display_name: string | null;
  abbreviation: string;
  court_level: string;
  circuit: string | null;
  state_or_territory: string | null;
  jurisdiction_description: string | null;
  appellate_court_id: string | null;
  accepted_case_categories: string[] | null;
};

export default async function OpenFederalCaseFromMatterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [matterResult, courtsResult, casesResult, complaintsResult, evidenceResult, warrantsResult] = await Promise.all([
    supabase.from("matters").select("id,matter_number,title,summary,matter_type,lead_component,investigating_agency,statutes_under_review,status,access_level,security_classification,grand_jury_secret,opened_at").eq("id", id).maybeSingle(),
    supabase.rpc("active_federal_courts"),
    supabase.from("cases").select("id,case_number,internal_number,case_caption,title,court_id,case_category,docket_number").is("archived_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("complaint_matter_links").select("id,complaints(tracking_number,category,status)").eq("matter_id", id).eq("active", true),
    supabase.from("evidence_items").select("id,evidence_number,title,evidence_type,access_classification,sealed,grand_jury_status").eq("matter_id", id).is("archived_at", null),
    supabase.from("roleplay_warrants").select("id,warrant_number,title,status,confidentiality").eq("matter_id", id).is("archived_at", null),
  ]);
  if (!matterResult.data) notFound();
  const matter = matterResult.data;
  const courts = (courtsResult.data ?? []) as CourtRow[];
  const cases = casesResult.data ?? [];
  const complaints = complaintsResult.data ?? [];
  const evidence = evidenceResult.data ?? [];
  const warrants = warrantsResult.data ?? [];

  return (
    <>
      <AdminPageHeader
        title="Abrir Federal Case a partir de este Matter"
        description={`${matter.matter_number} · ${matter.title}`}
        action={<Button asChild variant="outline"><Link href={`/admin/matters/${matter.id}`}><ArrowLeft className="mr-2 size-4" /> Volver al Matter</Link></Button>}
      />
      {query.error ? <Alert variant="destructive" className="mb-5"><AlertTriangle className="size-4" /><AlertDescription>{query.error}</AlertDescription></Alert> : null}
      <form action={openFederalCaseFromMatter} className="space-y-5">
        <input type="hidden" name="matter_id" value={matter.id} />
        <Card>
          <CardHeader><CardTitle>1. Matter de origen</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Matter Number" value={matter.matter_number} />
            <Info label="Tipo" value={matter.matter_type} />
            <Info label="Componente DOJ" value={safeText(matter.lead_component)} />
            <Info label="Investigating Agency" value={safeText(matter.investigating_agency)} />
            <Info label="Statutes under review" value={(matter.statutes_under_review ?? []).join(", ") || "None recorded"} />
            <Info label="Estado / acceso" value={`${matter.status} · ${matter.security_classification}`} />
            <Info label="Denuncias relacionadas" value={String(complaints.length)} />
            <Info label="Evidencias / warrants / documentos" value={`${evidence.length} / ${warrants.length} / vinculados por relaciones`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>2. Tipo de Federal Case</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="case_category">Case category</Label>
              <select id="case_category" name="case_category" className="h-10 w-full rounded-md border bg-white px-3 text-sm" required>
                <option>Criminal</option>
                <option>Civil</option>
                <option>Miscellaneous</option>
                <option>Magistrate Judge proceeding</option>
                <option>Appeal</option>
              </select>
              <p className="text-xs text-muted-foreground">Appeal requiere Case de origen; el servidor selecciona automáticamente D.C. Circuit o Ninth Circuit según el District Court.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="originating_case_id">Originating Case for Appeal</Label>
              <select id="originating_case_id" name="originating_case_id" className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                <option value="">No aplica</option>
                {cases.map((item) => <option key={item.id} value={item.id}>{item.case_number || item.internal_number} · {item.case_caption || item.title}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>3. Tribunal autorizado</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <select name="court_id" required className="h-11 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">Seleccione tribunal activo…</option>
              {courts.map((court) => <option key={court.id} value={court.id}>{court.display_name || court.official_name} ({court.abbreviation}) · {court.court_level}</option>)}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              {courts.map((court) => <div key={court.id} className="rounded border bg-slate-50 p-3 text-xs"><p className="font-semibold text-[#153553]">{court.official_name}</p><p className="mt-1 text-muted-foreground">{court.abbreviation} · {court.court_level} · {(court.accepted_case_categories ?? []).join(", ")}</p><p className="mt-1 text-slate-600">{court.jurisdiction_description}</p></div>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>4. Información judicial</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field name="case_caption" label="Case caption" defaultValue={matter.title} required />
            <Field name="filing_type" label="Filing type" defaultValue="Initial filing" />
            <Field name="plaintiff" label="Plaintiff / United States" defaultValue="United States" />
            <Field name="defendant" label="Defendant / Respondent" defaultValue="To be added" />
            <Field name="filed_at" label="Filing date" type="datetime-local" />
            <Field name="docket_number" label="Docket Number (solo si Clerk ya lo asignó)" />
            <Field name="federal_access_level" label="Access" asSelect options={["Public","Restricted","Internal DOJ only","Sealed","Grand-jury restricted"]} defaultValue={matter.security_classification || "Internal DOJ only"} />
            <Field name="relief" label="Relief / judicial note" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>5. Transferencia controlada</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {[
              ["participants","Participantes"],
              ["statutes","Statutes"],
              ["charges","Charges"],
              ["evidence","Evidencias"],
              ["warrants","Warrants"],
              ["public_complaints","Public complaints"],
              ["criminal_complaint","Criminal Complaint"],
              ["documents","Documentos"],
              ["timeline_events","Timeline events"],
              ["assigned_attorneys","Assigned attorneys"],
              ["investigating_agency","Investigating agency"],
            ].map(([key, label]) => <label key={key} className="flex items-start gap-2 rounded border p-3 text-sm"><input type="checkbox" name={`transfer_${key}`} className="mt-1" /> <span>{label}</span></label>)}
            <label className="md:col-span-2 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" name="confidentiality_reviewed" className="mt-1" required /> Confirmo revisión de material sellado, privilegiado, work product, testigos protegidos y Grand Jury. No se copiará automáticamente material restringido.</label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>6. Revisión y disposición del Matter</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field name="matter_next_status" label="Después de abrir el Case" asSelect options={["Mantener estado actual","Permanecer abierto","Cambiar a Litigation Support","Cambiar a Charges Filed","Cambiar a Referred for Litigation","Cerrar con Case Filed"]} defaultValue="Mantener estado actual" />
            <Field name="closing_date" label="Closing date (si se cierra)" type="date" />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="closing_reason">Closing reason / memo</Label>
              <Textarea id="closing_reason" name="closing_reason" className="min-h-20" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="review_reason">Razón autorizante / nota de auditoría</Label>
              <Textarea id="review_reason" name="review_reason" className="min-h-20" required />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between rounded border bg-white p-4">
          <p className="text-sm text-muted-foreground"><CheckCircle2 className="mr-2 inline size-4 text-emerald-700" />El Case Number se generará en servidor y el Matter se conservará.</p>
          <Button type="submit" className="bg-[#153b5c]">Abrir Federal Case <ArrowRight className="ml-2 size-4" /></Button>
        </div>
      </form>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded border bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium text-[#153553]">{value}</p></div>;
}

function Field({ name, label, defaultValue, type = "text", required, asSelect, options }: { name: string; label: string; defaultValue?: string; type?: string; required?: boolean; asSelect?: boolean; options?: string[] }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label>{asSelect ? <select id={name} name={name} defaultValue={defaultValue} required={required} className="h-10 w-full rounded-md border bg-white px-3 text-sm">{options?.map((option) => <option key={option}>{option}</option>)}</select> : <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} />}</div>;
}
