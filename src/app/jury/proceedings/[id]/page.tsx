import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, FileText, LockKeyhole, Scale } from "lucide-react";
import { submitGrandJuryBallotAction, submitTrialJuryBallotAction } from "@/app/actions/matter-workflow";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { safeText } from "@/lib/display";
import { ROLEPLAY_NOTICE } from "@/lib/identity";

type Search = { error?: string; voted?: string };

export default async function JuryProceedingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/jury/proceedings/${id}`)}`);

  const { data: profile } = await supabase.from("profiles").select("id,full_name,role,is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active || !["GRAND_JUROR", "TRIAL_JUROR"].includes(String(profile.role))) redirect("/no-autorizado");

  const { data: grandMember } = await supabase
    .from("grand_jury_members")
    .select("id,grand_jury_id,juror_participant_number,display_name,status,attendance_status,member_type,removed_at,grand_juries(id,grand_jury_number,panel_name,proceeding_number,status,district,jury_division,supervising_judge,foreperson_member_id,deputy_foreperson_member_id,jury_instructions,primary_matter_id,matters(matter_number,title),federal_courts(display_name,official_name,district))")
    .eq("grand_jury_id", id)
    .eq("juror_user_id", user.id)
    .maybeSingle();

  if (grandMember) return <GrandJuryPanel proceedingId={id} query={query} member={grandMember as GrandMember} />;

  const { data: trialMember } = await supabase
    .from("trial_jury_panels")
    .select("id,trial_jury_id,juror_participant_number,display_name,attendance_status,member_type,qualification_status,removed_at,trial_juries(id,trial_jury_number,panel_name,proceeding_number,status,district,judge,trial_start_date,courtroom,deliberation_status,foreperson_panel_id,final_jury_instructions,case_id,cases(case_number,case_caption,title),federal_courts(display_name,official_name,district))")
    .eq("trial_jury_id", id)
    .eq("juror_user_id", user.id)
    .maybeSingle();

  if (trialMember) return <TrialJuryPanel proceedingId={id} query={query} member={trialMember as TrialMember} />;
  redirect("/no-autorizado");
}

type GrandJuryData = {
  id: string;
  grand_jury_number: string;
  panel_name: string | null;
  proceeding_number: string | null;
  status: string;
  district: string | null;
  jury_division: string | null;
  supervising_judge: string | null;
  foreperson_member_id: string | null;
  deputy_foreperson_member_id: string | null;
  jury_instructions: string | null;
  primary_matter_id: string | null;
  matters: { matter_number: string; title: string } | { matter_number: string; title: string }[] | null;
  federal_courts: { display_name: string | null; official_name: string; district: string | null } | { display_name: string | null; official_name: string; district: string | null }[] | null;
};

type GrandMember = {
  id: string;
  grand_jury_id: string;
  juror_participant_number: string;
  display_name: string | null;
  status: string;
  attendance_status: string;
  member_type: string;
  removed_at: string | null;
  grand_juries: GrandJuryData | GrandJuryData[] | null;
};

type TrialJuryData = {
  id: string;
  trial_jury_number: string;
  panel_name: string | null;
  proceeding_number: string | null;
  status: string;
  district: string | null;
  judge: string | null;
  trial_start_date: string | null;
  courtroom: string | null;
  deliberation_status: string;
  foreperson_panel_id: string | null;
  final_jury_instructions: string | null;
  case_id: string;
  cases: { case_number: string | null; case_caption: string | null; title: string } | { case_number: string | null; case_caption: string | null; title: string }[] | null;
  federal_courts: { display_name: string | null; official_name: string; district: string | null } | { display_name: string | null; official_name: string; district: string | null }[] | null;
};

type TrialMember = {
  id: string;
  trial_jury_id: string;
  juror_participant_number: string;
  display_name: string | null;
  attendance_status: string;
  member_type: string;
  qualification_status: string | null;
  removed_at: string | null;
  trial_juries: TrialJuryData | TrialJuryData[] | null;
};

async function GrandJuryPanel({ proceedingId, query, member }: { proceedingId: string; query: Search; member: GrandMember }) {
  const supabase = await createClient();
  if (!supabase) notFound();
  const jury = Array.isArray(member.grand_juries) ? member.grand_juries[0] : member.grand_juries;
  if (!jury) notFound();
  const matter = Array.isArray(jury.matters) ? jury.matters[0] : jury.matters;
  const court = Array.isArray(jury.federal_courts) ? jury.federal_courts[0] : jury.federal_courts;
  const [{ data: counts }, { data: rounds }, { data: evidence }] = await Promise.all([
    supabase.from("grand_jury_counts").select("id,count_number,person_or_entity,statute,offense_title,allegation_summary,status").eq("grand_jury_id", jury.id).order("count_number"),
    supabase.from("grand_jury_voting_rounds").select("id,title,status,opened_at,closed_at").eq("grand_jury_id", jury.id).order("opened_at", { ascending: false }).limit(3),
    supabase.from("evidence_items").select("id,ete_id,formal_title,title,evidence_type,access_classification").eq("matter_id", jury.primary_matter_id).is("deleted_at", null).is("archived_at", null).limit(25),
  ]);
  const openRound = (rounds ?? []).find((round) => round.status === "Open");
  const inactive = Boolean(member.removed_at) || member.member_type !== "juror" || !["present", "active", "Present", "Active", "Impaneled", "impaneled"].includes(member.attendance_status);
  return <ProceedingShell title={jury.panel_name || jury.grand_jury_number} subtitle="Grand Jury private panel" query={query}>
    <SummaryGrid items={[
      ["Proceeding", jury.proceeding_number || jury.grand_jury_number],
      ["Court", court?.display_name || court?.official_name || "Federal Court"],
      ["District", jury.district || court?.district || "District pending"],
      ["Matter", matter ? `${matter.matter_number} · ${matter.title}` : "Matter restricted"],
      ["Supervisor", jury.supervising_judge || "Judge/Magistrate Judge pending"],
      ["Your status", `${member.juror_participant_number} · ${member.attendance_status}`],
    ]} />
    <InstructionBlock text={jury.jury_instructions || "Grand Jury material is sealed. Do not disclose proceedings, exhibits, questions, or deliberations outside the authorized roleplay proceeding."} />
    <EvidenceList evidence={evidence ?? []} />
    <Card><CardHeader><CardTitle className="text-base">Proposed counts and private ballot</CardTitle></CardHeader><CardContent className="space-y-3">
      {!openRound ? <p className="text-sm text-muted-foreground">No open voting round. Results and partial trends are never shown here.</p> : null}
      {inactive ? <Alert className="border-amber-200 bg-amber-50"><AlertTriangle className="size-4" /><AlertDescription>You are not eligible to vote in the current status.</AlertDescription></Alert> : null}
      {(counts ?? []).map((count) => <div key={count.id} className="rounded border p-4">
        <p className="mono-number text-xs font-semibold text-[#005ea8]">Count {count.count_number}</p>
        <h3 className="mt-1 text-sm font-semibold text-[#153553]">{count.person_or_entity}</h3>
        <p className="text-xs text-muted-foreground">{count.statute || "No statute"} · {count.offense_title || "No title"}</p>
        <p className="mt-2 text-sm text-slate-700">{count.allegation_summary || "No allegation summary recorded."}</p>
        {openRound && !inactive ? <form action={submitGrandJuryBallotAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="proceeding_id" value={proceedingId} /><input type="hidden" name="round_id" value={openRound.id} /><input type="hidden" name="count_id" value={count.id} /><input type="hidden" name="member_id" value={member.id} />
          <Button name="ballot_value" value="True Bill" size="sm" className="bg-[#153b5c]">True Bill</Button>
          <Button name="ballot_value" value="No Bill" size="sm" variant="outline">No Bill</Button>
          <Button name="ballot_value" value="Recused" size="sm" variant="outline">Recused</Button>
        </form> : null}
      </div>)}
    </CardContent></Card>
  </ProceedingShell>;
}

async function TrialJuryPanel({ proceedingId, query, member }: { proceedingId: string; query: Search; member: TrialMember }) {
  const supabase = await createClient();
  if (!supabase) notFound();
  const jury = Array.isArray(member.trial_juries) ? member.trial_juries[0] : member.trial_juries;
  if (!jury) notFound();
  const caseItem = Array.isArray(jury.cases) ? jury.cases[0] : jury.cases;
  const court = Array.isArray(jury.federal_courts) ? jury.federal_courts[0] : jury.federal_courts;
  const [{ data: questions }, { data: rounds }, { data: evidence }] = await Promise.all([
    supabase.from("trial_verdict_questions").select("id,question_number,defendant_or_party,count_or_claim,question_text,status").eq("trial_jury_id", jury.id).order("question_number"),
    supabase.from("trial_jury_voting_rounds").select("id,title,status,opened_at,closed_at").eq("trial_jury_id", jury.id).order("opened_at", { ascending: false }).limit(3),
    supabase.from("evidence_items").select("id,ete_id,formal_title,title,evidence_type,access_classification").eq("case_id", jury.case_id).is("deleted_at", null).is("archived_at", null).limit(25),
  ]);
  const openRound = (rounds ?? []).find((round) => round.status === "Open");
  const inactive = Boolean(member.removed_at) || member.member_type !== "juror" || !["present", "active", "Present", "Active", "Impaneled", "impaneled"].includes(member.attendance_status);
  return <ProceedingShell title={jury.panel_name || jury.trial_jury_number} subtitle="Trial Jury private panel" query={query}>
    <SummaryGrid items={[
      ["Proceeding", jury.proceeding_number || jury.trial_jury_number],
      ["Court", court?.display_name || court?.official_name || "Federal Court"],
      ["District", jury.district || court?.district || "District pending"],
      ["Case", caseItem ? `${caseItem.case_number || "No case number"} · ${caseItem.case_caption || caseItem.title}` : "Case restricted"],
      ["Judge", jury.judge || "Judge pending"],
      ["Your status", `${member.juror_participant_number} · ${member.attendance_status}`],
    ]} />
    <InstructionBlock text={jury.final_jury_instructions || "Trial Jury deliberations are private. Do not disclose individual ballots. A criminal verdict must be unanimous among all eligible deliberating jurors."} />
    <EvidenceList evidence={evidence ?? []} />
    <Card><CardHeader><CardTitle className="text-base">Verdict questions and private ballot</CardTitle></CardHeader><CardContent className="space-y-3">
      {!openRound ? <p className="text-sm text-muted-foreground">No open voting round. Partial trends and dissents are never shown here.</p> : null}
      {inactive ? <Alert className="border-amber-200 bg-amber-50"><AlertTriangle className="size-4" /><AlertDescription>You are not eligible to vote in the current status.</AlertDescription></Alert> : null}
      {(questions ?? []).map((question) => <div key={question.id} className="rounded border p-4">
        <p className="mono-number text-xs font-semibold text-[#005ea8]">Question {question.question_number}</p>
        <h3 className="mt-1 text-sm font-semibold text-[#153553]">{question.defendant_or_party}</h3>
        <p className="text-xs text-muted-foreground">{question.count_or_claim}</p>
        <p className="mt-2 text-sm text-slate-700">{question.question_text || "Guilty or Not Guilty."}</p>
        {openRound && !inactive ? <form action={submitTrialJuryBallotAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="proceeding_id" value={proceedingId} /><input type="hidden" name="round_id" value={openRound.id} /><input type="hidden" name="question_id" value={question.id} /><input type="hidden" name="panel_id" value={member.id} />
          <Button name="ballot_value" value="Guilty" size="sm" className="bg-[#153b5c]">Guilty</Button>
          <Button name="ballot_value" value="Not Guilty" size="sm" variant="outline">Not Guilty</Button>
        </form> : null}
      </div>)}
    </CardContent></Card>
  </ProceedingShell>;
}

function ProceedingShell({ title, subtitle, query, children }: { title: string; subtitle: string; query: Search; children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#f5f7f9] px-4 py-6 sm:px-8">
    <div className="mx-auto max-w-5xl">
      <div className="border-b-4 border-[#b38a3c] bg-[#102d49] p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#d7bf83]">{subtitle}</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold">{title}</h1>
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-200"><LockKeyhole className="size-4" /> Authenticated juror-only access. URL does not grant access without assignment.</p>
      </div>
      {query.error ? <Alert variant="destructive" className="mt-5"><AlertTriangle className="size-4" /><AlertDescription>{query.error}</AlertDescription></Alert> : null}
      {query.voted ? <Alert className="mt-5 border-emerald-200 bg-emerald-50"><AlertDescription>Your sealed ballot was recorded. No partial results are displayed.</AlertDescription></Alert> : null}
      <div className="mt-5 grid gap-5">{children}</div>
      <footer className="mt-8 border-t py-5 text-xs text-muted-foreground"><p>{ROLEPLAY_NOTICE}</p><p className="mt-1">Developed by: kcobainn</p><p className="mt-1"><Link href="/" className="font-semibold text-[#005ea8]">Return to public portal</Link></p></footer>
    </div>
  </main>;
}

function SummaryGrid({ items }: { items: [string, string][] }) {
  return <Card><CardContent className="grid gap-px bg-border p-0 sm:grid-cols-2 lg:grid-cols-3">{items.map(([label, value]) => <div key={label} className="bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-sm font-medium text-[#153553]">{safeText(value)}</p></div>)}</CardContent></Card>;
}

function InstructionBlock({ text }: { text: string }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="size-4" /> Confidentiality and instructions</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-slate-700">{text}</p></CardContent></Card>;
}

function EvidenceList({ evidence }: { evidence: Array<{ id: string; ete_id: string | null; formal_title: string | null; title: string; evidence_type: string; access_classification: string }> }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Scale className="size-4" /> Authorized Electronic Trial Exhibits</CardTitle></CardHeader><CardContent className="divide-y p-0">{evidence.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No authorized exhibits are available for this proceeding.</p> : evidence.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-4"><div><p className="mono-number text-xs font-semibold text-[#005ea8]">{item.ete_id || "ETE pending"}</p><p className="text-sm font-semibold text-[#153553]">{item.formal_title || item.title}</p><p className="text-xs text-muted-foreground">{item.evidence_type} · {item.access_classification}</p></div><Button asChild variant="outline" size="sm"><Link href={`/api/evidence/${item.id}/download`}><FileText className="mr-1 size-3" />Open</Link></Button></div>)}</CardContent></Card>;
}
