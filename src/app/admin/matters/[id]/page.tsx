import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, BriefcaseBusiness, GitBranch, LockKeyhole } from "lucide-react";
import { createCaseFromMatter } from "@/app/actions/cases";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, safeText } from "@/lib/display";

type MatterRow = {
  id: string;
  matter_number: string;
  title: string;
  summary: string | null;
  matter_category: string | null;
  matter_type: string;
  lead_component: string | null;
  participating_components: string[] | null;
  investigating_agency: string | null;
  referring_agency: string | null;
  referral_date: string | null;
  statutes_under_review: string[] | null;
  jurisdiction: string | null;
  investigative_district: string | null;
  security_classification: string;
  access_restrictions: string | null;
  grand_jury_secret: boolean;
  status: string;
  opened_at: string;
};

type ParticipantRow = {
  id: string;
  role_code: string;
  side: string | null;
  participants: { legal_name: string; display_name: string | null; sealed: boolean; minor: boolean; pseudonym: boolean } | { legal_name: string; display_name: string | null; sealed: boolean; minor: boolean; pseudonym: boolean }[] | null;
};

type RelatedCaseRow = {
  id: string;
  relationship_type: string;
  cases: { id: string; case_number: string | null; internal_number: string; case_caption: string | null; title: string } | { id: string; case_number: string | null; internal_number: string; case_caption: string | null; title: string }[] | null;
};

type WorkflowRow = { id: string; title: string; description: string | null; event_code: string; occurred_at: string; new_status: string | null };
type CourtRow = { id: string; official_name: string; abbreviation: string; accepted_case_categories: string[] | null };

export default async function MatterDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [matterResult, participantResult, casesResult, workflowResult, courtsResult] = await Promise.all([
    supabase.from("matters").select("id,matter_number,title,summary,matter_category,matter_type,lead_component,participating_components,investigating_agency,referring_agency,referral_date,statutes_under_review,jurisdiction,investigative_district,security_classification,access_restrictions,grand_jury_secret,status,opened_at").eq("id", id).maybeSingle(),
    supabase.from("matter_participants").select("id,role_code,side,participants(legal_name,display_name,sealed,minor,pseudonym)").eq("matter_id", id).order("created_at"),
    supabase.from("matter_case_relationships").select("id,relationship_type,cases(id,case_number,internal_number,case_caption,title)").eq("matter_id", id).order("created_at", { ascending: false }),
    supabase.from("workflow_events").select("id,title,description,event_code,occurred_at,new_status").eq("matter_id", id).order("occurred_at", { ascending: false }).limit(20),
    supabase.from("federal_courts").select("id,official_name,abbreviation,accepted_case_categories").eq("active", true).order("official_name"),
  ]);
  if (!matterResult.data) notFound();
  const matter = matterResult.data as MatterRow;
  const participants = (participantResult.data ?? []) as ParticipantRow[];
  const relatedCases = (casesResult.data ?? []) as RelatedCaseRow[];
  const workflow = (workflowResult.data ?? []) as WorkflowRow[];
  const courts = (courtsResult.data ?? []) as CourtRow[];

  return (
    <>
      <AdminPageHeader
        title={matter.matter_number}
        description={matter.title}
        action={<Button asChild variant="outline" className="gap-2"><Link href="/admin/expedientes/nuevo">Abrir otro registro <ArrowRight className="size-4" /></Link></Button>}
      />
      {query.created && <Alert className="mb-5 border-emerald-200 bg-emerald-50"><AlertDescription>Matter creado correctamente. No se asignó Docket Number porque todavía no es un Case judicial.</AlertDescription></Alert>}
      {query.error && <Alert variant="destructive" className="mb-5"><AlertTriangle className="size-4" /><AlertDescription>{query.error}</AlertDescription></Alert>}
      <Card className="overflow-hidden py-0">
        <div className="border-b-4 border-[#b38a3c] bg-[#102d49] p-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[.16em] text-[#d7bf83]">DOJ Matter Number</p>
              <h2 className="mono-number mt-2 text-xl font-semibold">{matter.matter_number}</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-200">Internal DOJ work product. Related Cases must be opened deliberately and reviewed for sealed or grand-jury material.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-white/20 bg-white/10 text-white">{matter.status}</Badge>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900"><LockKeyhole className="mr-1 size-3" /> {matter.security_classification}</Badge>
            </div>
          </div>
        </div>
        <CardContent className="grid gap-px bg-border p-0 md:grid-cols-2 xl:grid-cols-4">
          <Info label="Matter type" value={matter.matter_type} />
          <Info label="Lead component" value={safeText(matter.lead_component)} />
          <Info label="Investigating agency" value={safeText(matter.investigating_agency)} />
          <Info label="Opened" value={formatDate(matter.opened_at)} />
          <Info label="Jurisdiction" value={safeText(matter.jurisdiction)} />
          <Info label="Investigative district" value={safeText(matter.investigative_district)} />
          <Info label="Grand-jury restriction" value={matter.grand_jury_secret ? "Yes" : "No"} />
          <Info label="Referral date" value={formatDate(matter.referral_date)} />
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_.85fr]">
        <Card>
          <CardHeader><CardTitle className="text-base text-[#153553]">Matter summary</CardTitle></CardHeader>
          <CardContent className="space-y-5 text-sm leading-7">
            <p>{safeText(matter.summary, "No summary recorded.")}</p>
            <InfoRow label="Participating components" value={(matter.participating_components ?? []).join(", ") || "None recorded"} />
            <InfoRow label="Statutes under review" value={(matter.statutes_under_review ?? []).join(", ") || "None recorded"} />
            <InfoRow label="Access restrictions" value={safeText(matter.access_restrictions, "Standard internal access rules apply.")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#153553]"><GitBranch className="size-4" /> Abrir Case desde este Matter</CardTitle></CardHeader>
          <CardContent>
            <form action={createCaseFromMatter} className="space-y-4">
              <input type="hidden" name="matter_id" value={matter.id} />
              <div className="space-y-2">
                <Label htmlFor="court_id">Federal court</Label>
                <select id="court_id" name="court_id" required className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                  <option value="">Select court…</option>
                  {courts.map((court) => <option key={court.id} value={court.id}>{court.official_name} ({court.abbreviation})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="case_category">Case Category</Label>
                <select id="case_category" name="case_category" className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                  <option>Criminal</option>
                  <option>Civil</option>
                  <option>Magistrate Judge proceeding</option>
                  <option>Miscellaneous</option>
                  <option>Appeal</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="case_caption">Case caption</Label>
                <Input id="case_caption" name="case_caption" placeholder="United States v. Doe" />
              </div>
              <label className="flex items-start gap-2 rounded border bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                <input type="checkbox" name="confidentiality_reviewed" className="mt-1" />
                I reviewed sealed, grand-jury and internal Matter material. Only public-safe selected information should be copied to the court Case.
              </label>
              <Button type="submit" className="w-full gap-2 bg-[#153b5c]">Abrir Case judicial <ArrowRight className="size-4" /></Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base text-[#153553]">Participants</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {participants.length === 0 ? <EmptyState title="No participants recorded" description="Participants can be added from the federal intake form or later through the Matter workflow." icon={<BriefcaseBusiness className="size-6" />} /> : participants.map((item) => {
              const participant = Array.isArray(item.participants) ? item.participants[0] : item.participants;
              return <div key={item.id} className="p-4"><p className="text-sm font-semibold text-[#153553]">{participant?.display_name || participant?.legal_name}</p><p className="mt-1 text-xs text-muted-foreground">{item.role_code} · {item.side || "No side"}{participant?.sealed ? " · sealed" : ""}</p></div>;
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base text-[#153553]">Related Cases</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {relatedCases.length === 0 ? <div className="p-5 text-sm text-muted-foreground">No court Cases have been opened from this Matter.</div> : relatedCases.map((item) => {
              const relatedCase = Array.isArray(item.cases) ? item.cases[0] : item.cases;
              return <Link key={item.id} href={`/admin/expedientes/${relatedCase?.id}`} className="block p-4 hover:bg-slate-50"><p className="mono-number text-xs font-semibold text-[#005ea8]">{relatedCase?.case_number || relatedCase?.internal_number}</p><p className="mt-1 text-sm text-[#153553]">{relatedCase?.case_caption || relatedCase?.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.relationship_type}</p></Link>;
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader><CardTitle className="text-base text-[#153553]">Internal timeline</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {workflow.length === 0 ? <div className="p-5 text-sm text-muted-foreground">No workflow events recorded.</div> : workflow.map((item) => <div key={item.id} className="p-4"><p className="text-sm font-semibold text-[#153553]">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.event_code} · {formatDateTime(item.occurred_at)} · {item.new_status || "No status change"}</p>{item.description && <p className="mt-2 text-sm text-slate-700">{item.description}</p>}</div>)}
        </CardContent>
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-sm font-medium text-[#153553]">{value}</p></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1.5 text-sm font-medium">{value}</p></div>;
}
