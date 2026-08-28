import { notFound } from "next/navigation";
import { ArrowLeft, FileSearch } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime, safeText } from "@/lib/display";

type Person = {
  id: string;
  person_record_number: string;
  legal_first_name: string;
  legal_middle_name: string | null;
  legal_last_name: string;
  suffix: string | null;
  aliases: string[] | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  verification_status: string;
  duplicate_review_status: string;
  person_status: string;
  access_classification: string;
  created_at: string;
};

export default async function PersonRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [personResult, summaryResult, arrestResult, chargeResult, dispositionResult, restrictionResult, correctionResult] = await Promise.all([
    supabase.from("persons").select("id,person_record_number,legal_first_name,legal_middle_name,legal_last_name,suffix,aliases,date_of_birth,place_of_birth,verification_status,duplicate_review_status,person_status,access_classification,created_at").eq("id", id).maybeSingle(),
    supabase.from("person_criminal_history_summary").select("*").eq("person_id", id).maybeSingle(),
    supabase.from("arrest_events").select("id,arrest_event_number,arresting_agency,arrest_at,arrest_location,custody_outcome,verification_status,access_classification").eq("person_id", id).order("arrest_at", { ascending: false }),
    supabase.from("criminal_charges").select("id,count_number,statute_citation,offense_title,offense_level,charging_instrument,status,filing_date,case_id").eq("person_id", id).order("filing_date", { ascending: false }),
    supabase.from("charge_dispositions").select("id,count_number,disposition_type,conviction_indicator,disposition_date,judgment_date,appeal_status,finality_status,sealed,expunged,case_number,docket_number").eq("person_id", id).order("disposition_date", { ascending: false }),
    supabase.from("record_restrictions").select("id,action_type,order_date,effective_date,scope").eq("person_id", id).order("effective_date", { ascending: false }),
    supabase.from("record_corrections").select("id,challenged_event_type,correction_status,effective_date,created_at").eq("person_id", id).order("created_at", { ascending: false }),
  ]);
  if (!personResult.data) notFound();
  const person = personResult.data as Person;
  const fullName = [person.legal_first_name, person.legal_middle_name, person.legal_last_name, person.suffix].filter(Boolean).join(" ");
  const summary = summaryResult.data as Record<string, number | string | null> | null;

  return (
    <>
      <AdminPageHeader
        title={fullName}
        description={`${person.person_record_number} · ${person.access_classification} · ${person.verification_status}`}
        action={<Button asChild variant="outline"><Link href="/admin/antecedentes"><ArrowLeft className="mr-2 size-4" /> Regresar</Link></Button>}
      />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Identity summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="Person Record Number" value={person.person_record_number} />
              <Info label="Nombre legal" value={fullName} />
              <Info label="Aliases" value={person.aliases?.join(", ") || "None recorded"} />
              <Info label="Fecha de nacimiento" value={formatDate(person.date_of_birth)} />
              <Info label="Lugar de nacimiento" value={safeText(person.place_of_birth)} />
              <div className="flex flex-wrap gap-2">
                <Badge>{person.person_status}</Badge>
                <Badge variant="outline">{person.duplicate_review_status}</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Acciones controladas</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" disabled>Link Matter / Case</Button>
              <Button variant="outline" disabled>Add documented arrest</Button>
              <Button variant="outline" disabled>Correct record</Button>
              <Button variant="outline" disabled>Seal / expunge / vacate</Button>
              <Button asChild variant="outline"><Link href={`/api/roleplay/criminal-history/${person.id}/summary-pdf`}>Generate authorized summary PDF</Link></Button>
              <p className="text-xs leading-5 text-muted-foreground">Las acciones sensibles se ejecutan mediante flujos auditados y no por edición silenciosa.</p>
            </CardContent>
          </Card>
        </aside>
        <section className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Current derived summary</CardTitle></CardHeader>
            <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-3">
              <Metric label="Arrest events" value={summary?.total_arrest_events ?? 0} />
              <Metric label="Pending charges" value={summary?.pending_charges ?? 0} />
              <Metric label="Conviction counts" value={summary?.conviction_counts ?? 0} />
              <Metric label="Dismissed counts" value={summary?.dismissed_counts ?? 0} />
              <Metric label="Acquitted counts" value={summary?.acquitted_counts ?? 0} />
              <Metric label="Incomplete dispositions" value={summary?.incomplete_dispositions ?? 0} />
            </CardContent>
          </Card>
          <Timeline title="Arrest events" empty="No arrest events recorded." rows={(arrestResult.data ?? []).map((item) => ({ id: item.id, title: item.arrest_event_number, meta: `${item.arresting_agency} · ${formatDateTime(item.arrest_at)} · ${item.custody_outcome || "Custody outcome pending"}`, detail: `${item.arrest_location || "Location not recorded"} · ${item.verification_status} · ${item.access_classification}` }))} />
          <Timeline title="Charges" empty="No charges recorded." rows={(chargeResult.data ?? []).map((item) => ({ id: item.id, title: `Count ${item.count_number ?? "N/A"} · ${item.statute_citation}`, meta: `${item.offense_title} · ${item.offense_level || "Level pending"} · ${item.status}`, detail: `${item.charging_instrument || "Instrument pending"} · filed ${formatDate(item.filing_date)}` }))} />
          <Timeline title="Dispositions" empty="No dispositions recorded." rows={(dispositionResult.data ?? []).map((item) => ({ id: item.id, title: `Count ${item.count_number ?? "N/A"} · ${item.disposition_type}`, meta: `${item.conviction_indicator ? "Conviction indicator" : "Non-conviction / pending outcome"} · ${item.finality_status} · ${formatDate(item.disposition_date)}`, detail: `${item.case_number || "No Case Number"} · ${item.docket_number || "No Docket Number"} · ${item.appeal_status}` }))} />
          <Timeline title="Restrictions, corrections and challenges" empty="No restrictions or corrections recorded." rows={[...(restrictionResult.data ?? []).map((item) => ({ id: item.id, title: item.action_type, meta: `${formatDate(item.effective_date)} · order ${formatDate(item.order_date)}`, detail: item.scope })), ...(correctionResult.data ?? []).map((item) => ({ id: item.id, title: item.challenged_event_type, meta: `${item.correction_status} · ${formatDateTime(item.created_at)}`, detail: `Effective: ${formatDate(item.effective_date)}` }))]} />
        </section>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-medium text-[#153553]">{value}</p></div>;
}
function Metric({ label, value }: { label: string; value: unknown }) {
  return <div className="bg-white p-5"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mono-number mt-2 text-2xl font-semibold text-[#102d49]">{String(value ?? 0)}</p></div>;
}
function Timeline({ title, empty, rows }: { title: string; empty: string; rows: Array<{ id: string; title: string; meta: string; detail: string }> }) {
  return <Card><CardHeader><CardTitle className="text-base text-[#153553]">{title}</CardTitle></CardHeader><CardContent className="divide-y p-0">{rows.length === 0 ? <div className="grid min-h-32 place-items-center p-5 text-center text-sm text-muted-foreground"><FileSearch className="mb-2 size-6 text-slate-400" />{empty}</div> : rows.map((row) => <div key={row.id} className="p-4"><p className="text-sm font-semibold text-[#102d49]">{row.title}</p><p className="mt-1 text-xs text-muted-foreground">{row.meta}</p><p className="mt-2 text-sm text-slate-700">{row.detail}</p></div>)}</CardContent></Card>;
}
