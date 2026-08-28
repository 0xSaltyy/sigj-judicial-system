import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { recordFinalCaseDisposition } from "@/app/actions/criminal-history";
import { formatDate, safeText } from "@/lib/display";
import { chargingInstrumentOptions, offenseLevelOptions } from "@/lib/federal-model";

const dispositionTypes = [
  "Convicted after trial","Guilty plea","Nolo contendere plea","Acquitted","Dismissed","Dismissed without prejudice",
  "Dismissed with prejudice","Charge declined","No bill","Deferred disposition","Diversion","Mistrial",
  "Conviction vacated","Judgment reversed","Remanded","Sentence modified","Pardoned","Sealed","Expunged","Pending","Unknown or incomplete disposition",
];
const accessLevels = ["Public","Restricted","Sealed","Expunged","Juvenile/restricted","Internal only"];

type CaseRow = {
  id: string;
  case_number: string | null;
  internal_number: string;
  docket_number: string | null;
  case_caption: string | null;
  title: string;
  filed_at: string;
  status: string;
  case_category: string;
  court_id: string | null;
  federal_courts: { official_name: string } | { official_name: string }[] | null;
  criminal_case_details: Array<{ charging_instrument: string | null; offense_level: string | null; prosecuting_office: string | null; offense_statutes: string[] | null }>;
};
type Defendant = { id: string; role_code: string; participants: { id: string; person_id: string | null; legal_name: string; display_name: string | null } | { id: string; person_id: string | null; legal_name: string; display_name: string | null }[] | null };

export default async function FinalDispositionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [caseResult, defendantsResult] = await Promise.all([
    supabase.from("cases").select("id,case_number,internal_number,docket_number,case_caption,title,filed_at,status,case_category,court_id,federal_courts(official_name),criminal_case_details(charging_instrument,offense_level,prosecuting_office,offense_statutes)").eq("id", id).maybeSingle(),
    supabase.from("case_participants").select("id,role_code,participants(id,person_id,legal_name,display_name)").eq("case_id", id).in("role_code", ["criminal_defendant","subject","target"]),
  ]);
  if (!caseResult.data) notFound();
  const item = caseResult.data as CaseRow;
  const court = Array.isArray(item.federal_courts) ? item.federal_courts[0] : item.federal_courts;
  const defendants = (defendantsResult.data ?? []) as Defendant[];
  const criminal = item.criminal_case_details?.[0];
  const isCriminal = item.case_category === "Criminal" || item.case_category === "Magistrate Judge proceeding";

  return (
    <>
      <AdminPageHeader
        title="Registrar disposición final"
        description={`${item.case_number || item.internal_number} · ${item.case_caption || item.title}`}
        action={<Button asChild variant="outline"><Link href={`/admin/expedientes/${item.id}`}><ArrowLeft className="mr-2 size-4" /> Volver al Case</Link></Button>}
      />
      {query.error ? <Alert className="mb-5 border-red-200 bg-red-50"><AlertDescription>{query.error}</AlertDescription></Alert> : null}
      {!isCriminal ? (
        <Alert className="mb-5 border-amber-200 bg-amber-50"><AlertDescription>Este flujo solo aplica a Criminal Cases o Magistrate Judge proceedings.</AlertDescription></Alert>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Case review</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="Case Number" value={item.case_number || item.internal_number} />
            <Info label="Docket Number" value={item.docket_number || "No Docket Number"} />
            <Info label="Court" value={court?.official_name || "Court pending"} />
            <Info label="Filed" value={formatDate(item.filed_at)} />
            <Info label="Status" value={item.status} />
            <Info label="Prosecuting office" value={criminal?.prosecuting_office || "Not recorded"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-[#153553]"><ShieldCheck className="size-4" /> Guided count disposition</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={recordFinalCaseDisposition} className="grid gap-5">
              <input type="hidden" name="case_id" value={item.id} />
              <div className="grid gap-2">
                <Label htmlFor="person_id">Persona / defendant vinculado</Label>
                <Select name="person_id">
                  <SelectTrigger id="person_id"><SelectValue placeholder="Crear o seleccionar Person Record" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Crear nuevo Person Record con los datos abajo</SelectItem>
                    {defendants.map((row) => {
                      const participant = Array.isArray(row.participants) ? row.participants[0] : row.participants;
                      return participant?.person_id ? <SelectItem key={row.id} value={participant.person_id}>{participant.display_name || participant.legal_name}</SelectItem> : null;
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">No se fusionan identidades automáticamente por nombre. Si hay duda, cree o revise el Person Record antes de certificar.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Legal first name" name="legal_first_name" />
                <Field label="Middle name" name="legal_middle_name" />
                <Field label="Legal last name" name="legal_last_name" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Date of birth" name="date_of_birth" type="date" />
                <Field label="Count number" name="count_number" type="number" />
                <Field label="Statute" name="statute_citation" placeholder={criminal?.offense_statutes?.[0] || "18 U.S.C. § ..."} required />
              </div>
              <Field label="Offense title" name="offense_title" required />
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField label="Offense level" name="offense_level" options={offenseLevelOptions} defaultValue={criminal?.offense_level || undefined} />
                <SelectField label="Charging instrument" name="charging_instrument" options={chargingInstrumentOptions} defaultValue={criminal?.charging_instrument || undefined} />
                <SelectField label="Disposition" name="disposition_type" options={dispositionTypes} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Disposition date" name="disposition_date" type="date" required />
                <Field label="Judgment date" name="judgment_date" type="date" />
                <SelectField label="Access classification" name="access_classification" options={accessLevels} defaultValue="Restricted" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Imprisonment" name="imprisonment" />
                <Field label="Probation" name="probation" />
                <Field label="Supervised release" name="supervised_release" />
                <Field label="Fine amount" name="fine_amount" />
                <Field label="Restitution amount" name="restitution_amount" />
                <Field label="Special assessment" name="special_assessment" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Concurrent/consecutive" name="concurrent_or_consecutive" options={["Concurrent","Consecutive","Mixed","Not applicable"]} />
                <Field label="Community service" name="community_service" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="other_conditions">Other conditions / notes</Label>
                <Textarea id="other_conditions" name="other_conditions" />
              </div>
              <label className="flex gap-3 text-sm text-slate-700"><input type="checkbox" name="active_supervision" className="mt-1" /> Sentence or supervision is currently active.</label>
              <div className="grid gap-2">
                <Label htmlFor="certification">Certification</Label>
                <Textarea id="certification" name="certification" required placeholder="Certifico que revisé Judgment/Verdict/Plea/Dismissal order o documento fuente correspondiente…" />
              </div>
              <Button disabled={!isCriminal} className="w-fit rounded-none bg-[#153b5c]">Registrar disposición final</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-medium text-[#153553]">{safeText(value)}</p></div>;
}
function Field({ label, name, type = "text", placeholder, required = false }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return <div className="grid gap-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} placeholder={placeholder} required={required} /></div>;
}
function SelectField({ label, name, options, defaultValue, required = false }: { label: string; name: string; options: string[] | readonly string[]; defaultValue?: string; required?: boolean }) {
  return <div className="grid gap-2"><Label htmlFor={name}>{label}</Label><Select name={name} defaultValue={defaultValue} required={required}><SelectTrigger id={name}><SelectValue placeholder="Seleccione" /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>;
}
