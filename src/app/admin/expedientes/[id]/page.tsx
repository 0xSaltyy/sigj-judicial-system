import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, CalendarPlus, FilePlus2, LockKeyhole, Plus, Printer, Upload, UserRoundPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin-page";
import { CaseStatusBadge, ConfidentialityBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDate, formatDateTime, safeText } from "@/lib/display";

type CaseRow = {
  id: string;
  case_number: string | null;
  docket_number: string | null;
  internal_number: string;
  judicial_number: string;
  filing_status: string | null;
  title: string;
  status: string;
  filed_at: string;
  confidentiality_level: string;
  summary: string;
  public_visibility: boolean;
  case_category: string;
  case_caption: string | null;
  federal_access_level: string;
  sealed: boolean;
  grand_jury_restricted: boolean;
  originating_court_or_agency: string | null;
  originating_case_number: string | null;
  originating_docket_number: string | null;
  appellate_docket_number: string | null;
  federal_courts: { official_name: string; abbreviation: string; court_system: string; district: string | null; state_or_territory: string | null } | { official_name: string; abbreviation: string; court_system: string; district: string | null; state_or_territory: string | null }[] | null;
  civil_case_details: Array<{ nature_of_suit_code: string | null; cause_of_action: string | null; basis_of_jurisdiction: string | null; origin_code: number | null; jury_demand: boolean; class_action: boolean; multidistrict_litigation_indicator: boolean }>;
  criminal_case_details: Array<{ charging_instrument: string | null; offense_statutes: string[] | null; offense_level: string | null; grand_jury_status: string | null; prosecuting_office: string | null; lead_ausa: string | null }>;
  appeal_details: Array<{ notice_of_appeal_date: string | null; appellate_basis: string | null; cross_appeal: boolean; agency_review: boolean; supreme_court_petition_status: string | null }>;
};

type ParticipantRow = {
  id: string;
  role_code: string;
  side: string | null;
  counsel: string | null;
  participants: { legal_name: string; display_name: string | null; sealed: boolean; minor: boolean; pseudonym: boolean } | { legal_name: string; display_name: string | null; sealed: boolean; minor: boolean; pseudonym: boolean }[] | null;
};
type ActionRow = { id: string; action_type: string; title: string; description: string; action_date: string; visibility: string };
type HearingRow = { id: string; title: string; hearing_type: string; scheduled_at: string; room: string; courtroom: string | null; status: string; result: string | null };
type ProceedingRow = { id: string; title: string; providence_number: string; type: string; status: string };
type DocketEntryRow = { id: string; docket_entry_number: number; title: string; filing_timestamp: string; document_type_code: string | null; visibility: string; service_status: string | null };
type FilingRow = { id: string; filing_type: string; title: string; filed_by: string | null; filing_timestamp: string; visibility: string };
type MotionRow = { id: string; motion_type: string; status: string; filed_at: string | null; disposition: string | null };
type OrderRow = { id: string; order_type: string; signed_at: string | null; entered_at: string | null; effect: string | null; visibility: string };
type WorkflowRow = { id: string; title: string; description: string | null; event_code: string; occurred_at: string; previous_status: string | null; new_status: string | null };

export default async function CaseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [caseResult, participantResult, actionsResult, hearingsResult, proceedingsResult, docketResult, filingsResult, motionsResult, ordersResult, workflowResult] = await Promise.all([
    supabase.from("cases").select("id,case_number,docket_number,internal_number,judicial_number,filing_status,title,status,filed_at,confidentiality_level,summary,public_visibility,case_category,case_caption,federal_access_level,sealed,grand_jury_restricted,originating_court_or_agency,originating_case_number,originating_docket_number,appellate_docket_number,federal_courts(official_name,abbreviation,court_system,district,state_or_territory),civil_case_details(nature_of_suit_code,cause_of_action,basis_of_jurisdiction,origin_code,jury_demand,class_action,multidistrict_litigation_indicator),criminal_case_details(charging_instrument,offense_statutes,offense_level,grand_jury_status,prosecuting_office,lead_ausa),appeal_details(notice_of_appeal_date,appellate_basis,cross_appeal,agency_review,supreme_court_petition_status)").eq("id", id).maybeSingle(),
    supabase.from("case_participants").select("id,role_code,side,counsel,participants(legal_name,display_name,sealed,minor,pseudonym)").eq("case_id", id).order("created_at"),
    supabase.from("case_actions").select("id,action_type,title,description,action_date,visibility").eq("case_id", id).is("archived_at", null).order("action_date", { ascending: false }),
    supabase.from("hearings").select("id,title,hearing_type,scheduled_at,room,courtroom,status,result").eq("case_id", id).is("archived_at", null).order("scheduled_at", { ascending: true }),
    supabase.from("proceedings").select("id,title,providence_number,type,status").eq("case_id", id).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("docket_entries").select("id,docket_entry_number,title,filing_timestamp,document_type_code,visibility,service_status").eq("case_id", id).is("archived_at", null).order("docket_entry_number", { ascending: true }),
    supabase.from("filings").select("id,filing_type,title,filed_by,filing_timestamp,visibility").eq("case_id", id).is("archived_at", null).order("filing_timestamp", { ascending: false }),
    supabase.from("motions").select("id,motion_type,status,filed_at,disposition").eq("case_id", id).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("orders").select("id,order_type,signed_at,entered_at,effect,visibility").eq("case_id", id).is("archived_at", null).order("entered_at", { ascending: false }),
    supabase.from("workflow_events").select("id,title,description,event_code,occurred_at,previous_status,new_status").eq("case_id", id).order("occurred_at", { ascending: false }).limit(20),
  ]);
  if (!caseResult.data) notFound();

  const caseItem = caseResult.data as CaseRow;
  const court = Array.isArray(caseItem.federal_courts) ? caseItem.federal_courts[0] : caseItem.federal_courts;
  const participants = (participantResult.data ?? []) as ParticipantRow[];
  const actions = (actionsResult.data ?? []) as ActionRow[];
  const hearings = (hearingsResult.data ?? []) as HearingRow[];
  const proceedings = (proceedingsResult.data ?? []) as ProceedingRow[];
  const docketEntries = (docketResult.data ?? []) as DocketEntryRow[];
  const filings = (filingsResult.data ?? []) as FilingRow[];
  const motions = (motionsResult.data ?? []) as MotionRow[];
  const orders = (ordersResult.data ?? []) as OrderRow[];
  const workflow = (workflowResult.data ?? []) as WorkflowRow[];
  const civilDetails = caseItem.civil_case_details?.[0];
  const criminalDetails = caseItem.criminal_case_details?.[0];
  const appealDetails = caseItem.appeal_details?.[0];
  const displayCaseNumber = caseItem.case_number || caseItem.internal_number;
  const displayDocketNumber = caseItem.docket_number || "No Docket Number assigned by Clerk’s Office.";

  return (
    <>
      <AdminPageHeader
        title={displayCaseNumber}
        description={caseItem.case_caption || caseItem.title}
        action={<div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="gap-2"><Link href={`/admin/expedientes/${caseItem.id}/constancia`}><Printer className="size-4" /> Opening certificate</Link></Button><Button className="gap-2 bg-[#153b5c]"><Plus className="size-4" /> Add docket/event</Button></div>}
      />
      {query.created && <Alert className="mb-5 border-emerald-200 bg-emerald-50"><AlertDescription>Federal Case created. Case Number was generated server-side; Docket Number remains separate.</AlertDescription></Alert>}
      {(caseItem.sealed || caseItem.grand_jury_restricted || caseItem.federal_access_level !== "Public") && (
        <Alert className="mb-5 border-red-200 bg-red-50">
          <LockKeyhole className="size-4 text-red-700" />
          <AlertDescription className="text-red-900">Access level: {caseItem.federal_access_level}. Public exposure is blocked unless the record is explicitly public-safe.</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden py-0">
        <div className="border-b-4 border-[#b38a3c] bg-[#102d49] p-6 text-white">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div>
              <p className="text-xs uppercase tracking-[.16em] text-[#d7bf83]">Case Number</p>
              <h2 className="mono-number mt-2 text-xl font-semibold">{displayCaseNumber}</h2>
              <p className="mono-number mt-1 text-xs text-slate-300">{displayDocketNumber}</p>
            </div>
            <div className="flex items-start gap-2"><CaseStatusBadge status={caseItem.status} /><ConfidentialityBadge level={caseItem.federal_access_level} /></div>
          </div>
        </div>
        <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Federal court" value={court?.official_name || "Court pending"} />
          <Info label="Case Category" value={caseItem.case_category} />
          <Info label="Court system" value={court?.court_system || "Not assigned"} />
          <Info label="Opened" value={formatDate(caseItem.filed_at)} />
          <Info label="Filing status" value={caseItem.filing_status || "Awaiting Clerk docketing"} />
          <Info label="Public status" value={caseItem.public_visibility ? "Public-safe" : "Internal/restricted"} />
          <Info label="Originating record" value={caseItem.originating_docket_number || caseItem.originating_case_number || caseItem.originating_court_or_agency || "None recorded"} />
          <Info label="Appellate docket" value={caseItem.appellate_docket_number || "Not applicable"} />
        </CardContent>
      </Card>

      <div className="mt-5 flex flex-wrap gap-2">
        <ActionButton icon={<Upload />} label="Upload document" />
        <ActionButton icon={<CalendarPlus />} label="Schedule hearing" />
        <ActionButton icon={<FilePlus2 />} label="Create order" href="/admin/providencias/nueva" />
        <ActionButton icon={<UserRoundPlus />} label="Assign attorney or judge" />
        <ActionButton icon={<Archive />} label="Archive" />
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <div className="overflow-x-auto">
          <TabsList className="h-auto min-w-max justify-start bg-white p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="docket">Docket</TabsTrigger>
            <TabsTrigger value="filings">Filings</TabsTrigger>
            <TabsTrigger value="motions">Motions</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="hearings">Hearings</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="grid gap-5 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base text-[#153553]">Summary</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{caseItem.summary}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base text-[#153553]">Conditional classification</CardTitle></CardHeader><CardContent className="space-y-4">
            {caseItem.case_category === "Civil" && civilDetails && <><InfoRow label="Nature of Suit" value={civilDetails.nature_of_suit_code || "Not recorded"} /><InfoRow label="Basis of Jurisdiction" value={civilDetails.basis_of_jurisdiction || "Not recorded"} /><InfoRow label="Cause of Action" value={civilDetails.cause_of_action || "Not recorded"} /><InfoRow label="Origin" value={civilDetails.origin_code ? String(civilDetails.origin_code) : "Not recorded"} /><InfoRow label="Jury / class / MDL" value={`${civilDetails.jury_demand ? "Jury demanded" : "No jury demand"} · ${civilDetails.class_action ? "Class action" : "No class action"} · ${civilDetails.multidistrict_litigation_indicator ? "MDL" : "No MDL"}`} /></>}
            {caseItem.case_category === "Criminal" && criminalDetails && <><InfoRow label="Charging instrument" value={criminalDetails.charging_instrument || "Not recorded"} /><InfoRow label="Offense statutes" value={(criminalDetails.offense_statutes ?? []).join(", ") || "Not recorded"} /><InfoRow label="Offense level" value={criminalDetails.offense_level || "Not recorded"} /><InfoRow label="Grand-jury status" value={criminalDetails.grand_jury_status || "Not recorded"} /><InfoRow label="Prosecuting office" value={criminalDetails.prosecuting_office || "Not recorded"} /><InfoRow label="Lead AUSA" value={criminalDetails.lead_ausa || "Not recorded"} /></>}
            {caseItem.case_category === "Appeal" && appealDetails && <><InfoRow label="Notice of Appeal date" value={formatDate(appealDetails.notice_of_appeal_date)} /><InfoRow label="Appellate basis" value={appealDetails.appellate_basis || "Not recorded"} /><InfoRow label="Cross-appeal" value={appealDetails.cross_appeal ? "Yes" : "No"} /><InfoRow label="Agency review" value={appealDetails.agency_review ? "Yes" : "No"} /><InfoRow label="Supreme Court petition" value={appealDetails.supreme_court_petition_status || "Not recorded"} /></>}
            {!civilDetails && !criminalDetails && !appealDetails && <p className="text-sm text-muted-foreground">This category uses court-specific configurable workflow metadata.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="participants">
          <Card><CardHeader><CardTitle className="text-base text-[#153553]">Structured participants</CardTitle></CardHeader><CardContent className="divide-y p-0">{participants.length === 0 ? <EmptyInline text="No structured participants recorded." /> : participants.map((item) => {
            const participant = Array.isArray(item.participants) ? item.participants[0] : item.participants;
            return <div key={item.id} className="grid gap-2 p-4 md:grid-cols-[1fr_auto]"><div><p className="text-sm font-semibold text-[#153553]">{participant?.display_name || participant?.legal_name}</p><p className="mt-1 text-xs text-muted-foreground">{item.role_code} · {item.side || "No side"} · {item.counsel || "No counsel recorded"}</p></div>{participant?.sealed || participant?.minor || participant?.pseudonym ? <ConfidentialityBadge level="Restricted" /> : null}</div>;
          })}</CardContent></Card>
        </TabsContent>

        <TabsContent value="docket">
          <Card><CardHeader><CardTitle className="text-base text-[#153553]">Court docket entries</CardTitle></CardHeader><CardContent className="divide-y p-0">{docketEntries.length === 0 ? <EmptyInline text="No docket entries recorded. Internal DOJ activity is tracked separately." /> : docketEntries.map((item) => <div key={item.id} className="p-4"><p className="mono-number text-xs font-semibold text-[#005ea8]">Entry {item.docket_entry_number}</p><p className="mt-1 text-sm font-semibold text-[#153553]">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.document_type_code || "Document"} · {formatDateTime(item.filing_timestamp)} · {item.visibility} · {item.service_status || "service not recorded"}</p></div>)}</CardContent></Card>
        </TabsContent>

        <TabsContent value="filings">
          <Card><CardHeader><CardTitle className="text-base text-[#153553]">Filings and internal documents</CardTitle></CardHeader><CardContent className="divide-y p-0">{filings.length === 0 ? <EmptyInline text="No filings or internal document records." /> : filings.map((item) => <div key={item.id} className="p-4"><p className="text-sm font-semibold text-[#153553]">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.filing_type} · {item.filed_by || "No filer"} · {formatDateTime(item.filing_timestamp)} · {item.visibility}</p></div>)}</CardContent></Card>
        </TabsContent>

        <TabsContent value="motions">
          <Card><CardHeader><CardTitle className="text-base text-[#153553]">Motions</CardTitle></CardHeader><CardContent className="divide-y p-0">{motions.length === 0 ? <EmptyInline text="No motions recorded." /> : motions.map((item) => <div key={item.id} className="p-4"><p className="text-sm font-semibold text-[#153553]">{item.motion_type}</p><p className="mt-1 text-xs text-muted-foreground">{item.status} · {formatDate(item.filed_at)} · {item.disposition || "No disposition"}</p></div>)}</CardContent></Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card><CardHeader><CardTitle className="text-base text-[#153553]">Orders and decisions</CardTitle></CardHeader><CardContent className="grid gap-3">{orders.length === 0 && proceedings.length === 0 ? <EmptyInline text="No orders recorded." /> : <>{orders.map((item) => <div key={item.id} className="rounded border p-4"><p className="text-sm font-semibold">{item.order_type}</p><p className="mt-1 text-xs text-muted-foreground">Signed {formatDateTime(item.signed_at)} · Entered {formatDateTime(item.entered_at)} · {item.visibility}</p>{item.effect && <p className="mt-2 text-sm text-slate-700">{item.effect}</p>}</div>)}{proceedings.map((p) => <div key={p.id} className="rounded border p-4"><p className="text-sm font-semibold">{p.title}</p><p className="mono-number mt-1 text-xs text-muted-foreground">{p.providence_number} · {p.type}</p><CaseStatusBadge status={p.status} /></div>)}</>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="hearings">
          <Card><CardHeader><CardTitle className="text-base text-[#153553]">Hearings</CardTitle></CardHeader><CardContent className="grid gap-3">{hearings.length === 0 ? <EmptyInline text="No hearings scheduled." /> : hearings.map((h) => <div key={h.id} className="rounded border p-4"><p className="text-sm font-semibold">{h.title}</p><p className="mt-1 text-xs text-muted-foreground">{h.hearing_type} · {formatDateTime(h.scheduled_at)} · {h.courtroom || h.room} · {h.status}</p>{h.result && <p className="mt-2 text-sm text-slate-700">{h.result}</p>}</div>)}</CardContent></Card>
        </TabsContent>

        <TabsContent value="workflow">
          <Card><CardHeader><CardTitle className="text-base text-[#153553]">Workflow and audit-facing events</CardTitle></CardHeader><CardContent className="divide-y p-0">{workflow.length === 0 && actions.length === 0 ? <EmptyInline text="No workflow events recorded." /> : <>{workflow.map((item) => <div key={item.id} className="p-4"><p className="text-sm font-semibold text-[#153553]">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.event_code} · {formatDateTime(item.occurred_at)} · {item.previous_status || "None"} → {item.new_status || "No status change"}</p>{item.description && <p className="mt-2 text-sm text-slate-700">{item.description}</p>}</div>)}{actions.map((item) => <div key={item.id} className="p-4"><p className="text-sm font-semibold text-[#153553]">{item.title}</p><p className="mt-1 text-xs text-slate-600">{item.action_type} · {formatDateTime(item.action_date)} · {item.visibility}</p><p className="mt-2 text-sm text-slate-700">{item.description}</p></div>)}</>}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-sm font-medium text-[#153553]">{value}</p></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1.5 text-sm font-medium">{safeText(value)}</p></div>;
}

function ActionButton({ icon, label, href }: { icon: React.ReactNode; label: string; href?: string }) {
  const content = <>{<span className="[&>svg]:size-4">{icon}</span>}{label}</>;
  return href ? <Button asChild variant="outline" size="sm"><Link href={href}>{content}</Link></Button> : <Button variant="outline" size="sm">{content}</Button>;
}

function EmptyInline({ text }: { text: string }) {
  return <div className="p-5 text-sm text-slate-600">{text}</div>;
}
