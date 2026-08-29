import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Archive, ArrowRight, BriefcaseBusiness, Download, Edit3, FileDown, FileSearch, GitBranch, Gavel, LockKeyhole, Scale, Trash2, UserPlus } from "lucide-react";
import { addGrandJuryCountAction, addGrandJuryMemberAction, archiveEvidenceAction, closeGrandJuryVoteRoundAction, deleteEvidenceAction, designateGrandJuryForepersonAction, openGrandJuryVoteRoundAction, removeGrandJuryMemberAction } from "@/app/actions/matter-workflow";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
type ComplaintLinkRow = { id: string; relationship_type: string; reason: string | null; complaints: { id: string; tracking_number: string; category: string; status: string; anonymous: boolean; complainant_name: string | null } | { id: string; tracking_number: string; category: string; status: string; anonymous: boolean; complainant_name: string | null }[] | null };
type EvidenceRow = { id: string; evidence_number: string; ete_id: string | null; formal_title: string | null; title: string; evidence_type: string; exhibit_designation: string | null; evidence_status: string | null; access_classification: string; sealed: boolean; grand_jury_status: string; sha256_hash: string | null; original_filename: string | null; created_at: string };
type SubpoenaRow = { id: string; subpoena_number: string; subpoena_type: string; recipient: string; compliance_status: string; grand_jury_secret: boolean };
type InterviewRow = { id: string; interview_number: string; record_type: string; interviewee: string; access_classification: string; grand_jury_secret: boolean };
type TaskRow = { id: string; title: string; priority: string; status: string; due_at: string | null };
type GrandJuryRow = { id: string; grand_jury_number: string; panel_name: string | null; proceeding_number: string | null; status: string; active_grand_jurors: number; selected_panel_size: number; term_start: string | null; term_end: string | null; district: string | null; foreperson_member_id: string | null; deputy_foreperson_member_id: string | null; foreperson_selection_method: string | null };
type GrandJuryRoundRow = { id: string; grand_jury_id: string; status: string; title: string; closed_at: string | null };
type GrandJuryMemberRow = { id: string; grand_jury_id: string; juror_user_id: string | null; juror_participant_number: string; display_name: string | null; seat_sequence: number | null; member_type: string; status: string; attendance_status: string; is_foreperson: boolean; is_deputy_foreperson: boolean; removed_at: string | null };
type JurorProfileRow = { id: string; full_name: string; role: string; institutional_email: string | null };

export default async function MatterDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; updated?: string; evidence?: string; grand_jury?: string; error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [matterResult, participantResult, casesResult, workflowResult, complaintsResult, evidenceResult, subpoenasResult, interviewsResult, tasksResult, grandJuryResult, grandJuryRoundsResult, grandJuryMembersResult, jurorProfilesResult] = await Promise.all([
    supabase.from("matters").select("id,matter_number,title,summary,matter_category,matter_type,lead_component,participating_components,investigating_agency,referring_agency,referral_date,statutes_under_review,jurisdiction,investigative_district,security_classification,access_restrictions,grand_jury_secret,status,opened_at").eq("id", id).maybeSingle(),
    supabase.from("matter_participants").select("id,role_code,side,participants(legal_name,display_name,sealed,minor,pseudonym)").eq("matter_id", id).order("created_at"),
    supabase.from("matter_case_relationships").select("id,relationship_type,cases(id,case_number,internal_number,case_caption,title)").eq("matter_id", id).order("created_at", { ascending: false }),
    supabase.from("workflow_events").select("id,title,description,event_code,occurred_at,new_status").eq("matter_id", id).order("occurred_at", { ascending: false }).limit(20),
    supabase.from("complaint_matter_links").select("id,relationship_type,reason,complaints(id,tracking_number,category,status,anonymous,complainant_name)").eq("matter_id", id).eq("active", true).order("created_at", { ascending: false }),
    supabase.from("evidence_items").select("id,evidence_number,ete_id,formal_title,title,evidence_type,exhibit_designation,evidence_status,access_classification,sealed,grand_jury_status,sha256_hash,original_filename,created_at").eq("matter_id", id).is("archived_at", null).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("subpoenas").select("id,subpoena_number,subpoena_type,recipient,compliance_status,grand_jury_secret").eq("matter_id", id).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("interview_records").select("id,interview_number,record_type,interviewee,access_classification,grand_jury_secret").eq("matter_id", id).order("created_at", { ascending: false }),
    supabase.from("matter_tasks").select("id,title,priority,status,due_at").eq("matter_id", id).order("due_at", { ascending: true }),
    supabase.from("grand_juries").select("id,grand_jury_number,panel_name,proceeding_number,status,active_grand_jurors,selected_panel_size,term_start,term_end,district,foreperson_member_id,deputy_foreperson_member_id,foreperson_selection_method").eq("primary_matter_id", id).order("created_at", { ascending: false }),
    supabase.from("grand_jury_voting_rounds").select("id,grand_jury_id,status,title,closed_at").order("opened_at", { ascending: false }).limit(20),
    supabase.from("grand_jury_members").select("id,grand_jury_id,juror_user_id,juror_participant_number,display_name,seat_sequence,member_type,status,attendance_status,is_foreperson,is_deputy_foreperson,removed_at").order("seat_sequence"),
    supabase.from("profiles").select("id,full_name,role,institutional_email").eq("is_active", true).eq("role", "GRAND_JUROR").order("full_name"),
  ]);
  if (!matterResult.data) notFound();
  const matter = matterResult.data as MatterRow;
  const participants = (participantResult.data ?? []) as ParticipantRow[];
  const relatedCases = (casesResult.data ?? []) as RelatedCaseRow[];
  const workflow = (workflowResult.data ?? []) as WorkflowRow[];
  const complaintLinks = (complaintsResult.data ?? []) as ComplaintLinkRow[];
  const evidence = (evidenceResult.data ?? []) as EvidenceRow[];
  const subpoenas = (subpoenasResult.data ?? []) as SubpoenaRow[];
  const interviews = (interviewsResult.data ?? []) as InterviewRow[];
  const tasks = (tasksResult.data ?? []) as TaskRow[];
  const grandJuries = (grandJuryResult.data ?? []) as GrandJuryRow[];
  const grandJuryRounds = (grandJuryRoundsResult.data ?? []) as GrandJuryRoundRow[];
  const grandJuryMembers = (grandJuryMembersResult.data ?? []) as GrandJuryMemberRow[];
  const grandJurorProfiles = (jurorProfilesResult.data ?? []) as JurorProfileRow[];

  return (
    <>
      <AdminPageHeader
        title={matter.matter_number}
        description={matter.title}
        action={<div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="gap-2"><Link href={`/api/roleplay/matters/${matter.id}/pdf`}><FileDown className="size-4" /> Descargar PDF</Link></Button><Button asChild variant="outline" className="gap-2"><Link href={`/admin/matters/${matter.id}/editar`}><Edit3 className="size-4" /> Editar Matter</Link></Button><Button asChild className="gap-2 bg-[#153b5c]"><Link href={`/admin/matters/${matter.id}/abrir-federal-case`}>Abrir Federal Case a partir de este Matter <ArrowRight className="size-4" /></Link></Button></div>}
      />
      {query.created && <Alert className="mb-5 border-emerald-200 bg-emerald-50"><AlertDescription>Matter creado correctamente. No se asignó Docket Number porque todavía no es un Case judicial.</AlertDescription></Alert>}
      {query.updated && <Alert className="mb-5 border-emerald-200 bg-emerald-50"><AlertDescription>Matter actualizado con auditoría.</AlertDescription></Alert>}
      {query.evidence && <Alert className="mb-5 border-emerald-200 bg-emerald-50"><AlertDescription>Evidence Item registrado con chain of custody inicial.</AlertDescription></Alert>}
      {query.grand_jury && <Alert className="mb-5 border-emerald-200 bg-emerald-50"><AlertDescription>Grand Jury creado y protegido dentro del Matter.</AlertDescription></Alert>}
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
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#153553]"><GitBranch className="size-4" /> Related Records</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="Originating Complaint" value={complaintLinks[0] ? (Array.isArray(complaintLinks[0].complaints) ? complaintLinks[0].complaints[0]?.tracking_number : complaintLinks[0].complaints?.tracking_number) || "Linked complaint" : "None"} />
            <InfoRow label="Related Federal Cases" value={String(relatedCases.length)} />
            <InfoRow label="Evidence Items" value={String(evidence.length)} />
            <InfoRow label="Warrants / subpoenas" value={`${subpoenas.length} subpoenas recorded`} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline" size="sm"><Link href={`/admin/matters/${matter.id}/evidence/nuevo`}>Add Evidence</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href={`/admin/matters/${matter.id}/grand-jury/nuevo`}>Create Grand Jury</Link></Button>
            </div>
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
          <CardHeader><CardTitle className="text-base text-[#153553]">Related Federal Cases</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {relatedCases.length === 0 ? <div className="p-5 text-sm text-muted-foreground">No court Cases have been opened from this Matter.</div> : relatedCases.map((item) => {
              const relatedCase = Array.isArray(item.cases) ? item.cases[0] : item.cases;
              return <Link key={item.id} href={`/admin/expedientes/${relatedCase?.id}`} className="block p-4 hover:bg-slate-50"><p className="mono-number text-xs font-semibold text-[#005ea8]">{relatedCase?.case_number || relatedCase?.internal_number}</p><p className="mt-1 text-sm text-[#153553]">{relatedCase?.case_caption || relatedCase?.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.relationship_type}</p></Link>;
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <SectionCard title="Public Complaints" icon={<FileSearch className="size-4" />} empty="No public complaints are linked to this Matter.">
          {complaintLinks.map((link) => {
            const complaint = Array.isArray(link.complaints) ? link.complaints[0] : link.complaints;
            return <Link key={link.id} href={`/admin/denuncias/${complaint?.id}`} className="block border-b p-4 last:border-b-0 hover:bg-slate-50"><p className="mono-number text-xs font-semibold text-[#005ea8]">{complaint?.tracking_number}</p><p className="mt-1 text-sm font-semibold text-[#153553]">{complaint?.category}</p><p className="text-xs text-muted-foreground">{link.relationship_type} · {complaint?.status}</p></Link>;
          })}
        </SectionCard>
        <SectionCard title="Evidence" icon={<Scale className="size-4" />} empty="No Evidence Items have been registered for this Matter.">
          {evidence.map((item) => <div key={item.id} className="border-b p-4 last:border-b-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="mono-number text-xs font-semibold text-[#005ea8]">{item.ete_id || item.evidence_number}</p>
                <p className="mt-1 text-sm font-semibold text-[#153553]">{item.formal_title || item.title}</p>
                <p className="text-xs text-muted-foreground">{item.exhibit_designation || item.evidence_type} · {item.evidence_status || "received"} · {item.access_classification} · hash {item.sha256_hash ? item.sha256_hash.slice(0, 12) : "pending"}{item.sealed ? " · sealed" : ""}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm"><Link href={`/api/evidence/${item.id}/download`}><Download className="mr-1 size-3" />Download</Link></Button>
                <form action={archiveEvidenceAction}><input type="hidden" name="evidence_id" value={item.id} /><input type="hidden" name="return_to" value={`/admin/matters/${matter.id}`} /><input type="hidden" name="reason" value="Archived from Matter Evidence Manager" /><Button variant="outline" size="sm"><Archive className="mr-1 size-3" />Archive</Button></form>
                <form action={deleteEvidenceAction}><input type="hidden" name="evidence_id" value={item.id} /><input type="hidden" name="return_to" value={`/admin/matters/${matter.id}`} /><input type="hidden" name="reason" value="Deleted from Matter Evidence Manager" /><Button variant="outline" size="sm" className="text-red-700"><Trash2 className="mr-1 size-3" />Delete</Button></form>
              </div>
            </div>
          </div>)}
        </SectionCard>
        <SectionCard title="Grand Jury" icon={<Gavel className="size-4" />} empty="No Grand Jury has been created for this Matter.">
          {grandJuries.map((jury) => {
            const openRound = grandJuryRounds.find((round) => round.grand_jury_id === jury.id && round.status === "Open");
            const latestCertifiedRound = grandJuryRounds.find((round) => round.grand_jury_id === jury.id && round.status === "Certified");
            const members = grandJuryMembers.filter((member) => member.grand_jury_id === jury.id);
            const activeMembers = members.filter((member) => member.member_type === "juror" && !member.removed_at && ["present", "active", "Present", "Active", "Impaneled", "impaneled"].includes(member.status) && ["present", "active", "Present", "Active", "Impaneled", "impaneled"].includes(member.attendance_status));
            const alternates = members.filter((member) => member.member_type === "alternate" && !member.removed_at);
            const canChangeMembers = !grandJuryRounds.some((round) => round.grand_jury_id === jury.id);
            return <div key={jury.id} className="border-b p-4 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mono-number text-xs font-semibold text-[#005ea8]">{jury.grand_jury_number}</p>
                  <p className="mt-1 text-sm font-semibold text-[#153553]">{jury.panel_name || "Grand Jury proceeding"}</p>
                  <p className="text-xs text-muted-foreground">{jury.proceeding_number || "No proceeding number"} · {jury.district || "District pending"} · {jury.status}</p>
                  <p className="mt-1 text-xs text-slate-600">Panel size {jury.selected_panel_size || jury.active_grand_jurors || 9} · present eligible {activeMembers.length} · threshold {Math.ceil(((jury.selected_panel_size || jury.active_grand_jurors || 9) * 2) / 3)} True Bill votes</p>
                  <p className="mt-1 text-xs text-slate-600">Foreperson: {members.find((member) => member.id === jury.foreperson_member_id)?.display_name || "Not designated"} · Deputy: {members.find((member) => member.id === jury.deputy_foreperson_member_id)?.display_name || "Not designated"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm"><Link href={`/jury/proceedings/${jury.id}`}>Juror panel URL</Link></Button>
                  {latestCertifiedRound ? <Button asChild variant="outline" size="sm"><Link href={`/api/roleplay/grand-jury/vote-record/${latestCertifiedRound.id}/pdf`}><FileDown className="mr-1 size-3" />Vote Record PDF</Link></Button> : null}
                </div>
              </div>
              <div className="mt-4 rounded border bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-600">Jury Members</p>
                {members.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No members assigned. Create juror accounts with role GRAND_JUROR, then assign them here.</p> : <div className="mt-2 grid gap-2">{members.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white p-2 text-xs">
                  <span><span className="font-semibold">{member.juror_participant_number}</span> · {member.display_name || "Unnamed juror"} · {member.member_type} · {member.status}/{member.attendance_status}{member.is_foreperson ? " · Foreperson" : ""}{member.is_deputy_foreperson ? " · Deputy" : ""}{member.removed_at ? " · removed" : ""}</span>
                  {!member.removed_at && canChangeMembers ? <form action={removeGrandJuryMemberAction} className="flex gap-1"><input type="hidden" name="member_id" value={member.id} /><input type="hidden" name="return_to" value={`/admin/matters/${matter.id}`} /><input type="hidden" name="status" value="discharged" /><input type="hidden" name="reason" value="Removed before impaneling/vote" /><Button variant="outline" size="sm">Remove</Button></form> : null}
                </div>)}</div>}
                {canChangeMembers ? <form action={addGrandJuryMemberAction} className="mt-3 grid gap-2 md:grid-cols-5">
                  <input type="hidden" name="grand_jury_id" value={jury.id} /><input type="hidden" name="return_to" value={`/admin/matters/${matter.id}`} />
                  <select name="juror_user_id" required className="h-9 rounded-md border bg-white px-2 text-xs"><option value="">Add GRAND_JUROR account…</option>{grandJurorProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select>
                  <Input name="juror_participant_number" placeholder="Juror number" className="h-9" />
                  <select name="member_type" className="h-9 rounded-md border bg-white px-2 text-xs"><option value="juror">Juror</option><option value="alternate">Alternate</option></select>
                  <Input name="seat_sequence" placeholder="Seat #" type="number" className="h-9" />
                  <Button size="sm" variant="outline"><UserPlus className="mr-1 size-3" />Add member</Button>
                </form> : <p className="mt-3 text-xs text-amber-800">Members are locked after the first voting round opens. Alternates require a formal replacement record.</p>}
                {activeMembers.length >= (jury.selected_panel_size || 9) ? <Badge className="mt-3 bg-emerald-50 text-emerald-800">Compact quorum complete</Badge> : <Badge className="mt-3 bg-amber-50 text-amber-900">Minimum/quorum incomplete</Badge>}
                <p className="mt-2 text-xs text-muted-foreground">Alternates assigned: {alternates.length}. Alternates do not vote until formally substituted as jurors.</p>
              </div>
              <form action={designateGrandJuryForepersonAction} className="mt-3 grid gap-2 md:grid-cols-4">
                <input type="hidden" name="grand_jury_id" value={jury.id} /><input type="hidden" name="return_to" value={`/admin/matters/${matter.id}`} />
                <select name="member_id" required className="h-9 rounded-md border bg-white px-2 text-xs"><option value="">Foreperson member…</option>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name || member.juror_participant_number}</option>)}</select>
                <select name="deputy_member_id" className="h-9 rounded-md border bg-white px-2 text-xs"><option value="">Deputy optional…</option>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name || member.juror_participant_number}</option>)}</select>
                <Input name="order_reference" placeholder="Court order/reference" className="h-9" />
                <Button size="sm" variant="outline">Designate foreperson</Button>
              </form>
              <form action={addGrandJuryCountAction} className="mt-3 grid gap-2 md:grid-cols-4">
                <input type="hidden" name="grand_jury_id" value={jury.id} /><input type="hidden" name="matter_id" value={matter.id} />
                <Input name="person_or_entity" placeholder="Person/entity" className="h-9" />
                <Input name="statute" placeholder="Statute" className="h-9" />
                <Input name="offense_title" placeholder="Offense title" className="h-9" />
                <Button size="sm" variant="outline">Add count</Button>
              </form>
              <div className="mt-2 flex flex-wrap gap-2">
                <form action={openGrandJuryVoteRoundAction}><input type="hidden" name="grand_jury_id" value={jury.id} /><input type="hidden" name="return_to" value={`/admin/matters/${matter.id}`} /><Button size="sm" variant="outline">Open secret vote</Button></form>
                {openRound ? <form action={closeGrandJuryVoteRoundAction} className="flex gap-2"><input type="hidden" name="round_id" value={openRound.id} /><input type="hidden" name="return_to" value={`/admin/matters/${matter.id}`} /><Input name="certification" placeholder="Foreperson certification" className="h-9 max-w-xs" /><Button size="sm" variant="outline">Close / certify</Button></form> : null}
              </div>
            </div>;
          })}
        </SectionCard>
        <SectionCard title="Subpoenas, interviews, tasks and deadlines" icon={<BriefcaseBusiness className="size-4" />} empty="No subpoenas, interviews or tasks recorded.">
          {subpoenas.map((item) => <div key={item.id} className="border-b p-4 last:border-b-0"><p className="mono-number text-xs font-semibold text-[#005ea8]">{item.subpoena_number}</p><p className="text-sm font-semibold">{item.recipient}</p><p className="text-xs text-muted-foreground">{item.subpoena_type} · {item.compliance_status}{item.grand_jury_secret ? " · grand-jury restricted" : ""}</p></div>)}
          {interviews.map((item) => <div key={item.id} className="border-b p-4 last:border-b-0"><p className="mono-number text-xs font-semibold text-[#005ea8]">{item.interview_number}</p><p className="text-sm font-semibold">{item.interviewee}</p><p className="text-xs text-muted-foreground">{item.record_type} · {item.access_classification}</p></div>)}
          {tasks.map((item) => <div key={item.id} className="border-b p-4 last:border-b-0"><p className="text-sm font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.priority} · {item.status} · due {formatDate(item.due_at)}</p></div>)}
        </SectionCard>
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

function SectionCard({ title, icon, empty, children }: { title: string; icon: React.ReactNode; empty: string; children: React.ReactNode }) {
  const list = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(list) ? list.length === 0 : !list;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#153553]">{icon}{title}</CardTitle></CardHeader><CardContent className="p-0">{isEmpty ? <div className="p-5 text-sm text-muted-foreground">{empty}</div> : children}</CardContent></Card>;
}
