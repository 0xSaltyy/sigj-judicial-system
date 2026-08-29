import { NextResponse } from "next/server";
import { buildDojRecordPdf } from "@/lib/doj-record-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Nested<T> = T | T[] | null | undefined;

function first<T>(value: Nested<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function text(value: unknown, fallback = "Not recorded") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export async function GET(_request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: round, error: roundError } = await supabase
    .from("trial_jury_voting_rounds")
    .select(`
      id,title,status,opened_at,closed_at,foreperson_certification,polling_status,metadata,
      trial_juries(
        id,trial_jury_number,panel_name,proceeding_number,district,courtroom,jury_type,selected_panel_size,
        deliberation_status,status,foreperson_panel_id,foreperson_selection_method,
        cases(id,case_number,internal_number,case_caption,title,status,federal_access_level,federal_courts(official_name,display_name,abbreviation))
      )
    `)
    .eq("id", roundId)
    .maybeSingle();

  if (roundError || !round) return NextResponse.json({ error: roundError?.message ?? "Trial Jury voting round not found" }, { status: 404 });

  const jury = first((round as { trial_juries?: unknown }).trial_juries) as Record<string, unknown> | null;
  const caseItem = first(jury?.cases as Nested<Record<string, unknown>>) as Record<string, unknown> | null;
  const court = first(caseItem?.federal_courts as Nested<Record<string, unknown>>) as Record<string, unknown> | null;

  const [{ data: results }, { data: panel }, { data: polls }, { data: profile }] = await Promise.all([
    supabase
      .from("trial_jury_vote_results")
      .select("guilty_votes,not_guilty_votes,required_unanimity,result,certified_at,trial_verdict_questions(question_number,defendant_or_party,count_or_claim,question_text)")
      .eq("voting_round_id", roundId)
      .order("certified_at", { ascending: true }),
    supabase
      .from("trial_jury_panels")
      .select("id,juror_participant_number,panel_sequence,member_type,display_name,attendance_status,qualification_status,voir_dire_status,final_seat,removed_at")
      .eq("trial_jury_id", String(jury?.id ?? ""))
      .order("panel_sequence", { ascending: true }),
    supabase
      .from("jury_polling_records")
      .select("poll_requested_by,poll_completed,unanimity_confirmed,judge_action,notes,created_at")
      .eq("voting_round_id", roundId)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle(),
  ]);

  const activePanel = (panel ?? []).filter((member) => !member.removed_at);
  const foreperson = activePanel.find((member) => member.id === jury?.foreperson_panel_id);
  const verdictRows = (results ?? []).map((item) => {
    const question = first(item.trial_verdict_questions as Nested<Record<string, unknown>>);
    return [
      `Question ${question?.question_number ?? "?"}: ${text(question?.defendant_or_party)} — ${text(question?.count_or_claim)}`,
      `Question text: ${text(question?.question_text)}`,
      `Certified result: ${text(item.result)}`,
      `Guilty votes: ${item.guilty_votes ?? 0}; Not guilty votes: ${item.not_guilty_votes ?? 0}; Unanimity required: ${item.required_unanimity ? "Yes" : "No"}`,
      `Certified at: ${text(item.certified_at)}`,
    ].join(" | ");
  });

  const pdf = buildDojRecordPdf({
    title: "Trial Jury Verdict Form",
    subtitle: `${text(jury?.panel_name, text(jury?.trial_jury_number, "Trial Jury"))} · ${text(caseItem?.case_number, text(caseItem?.internal_number, "Federal Case"))}`,
    classification: text(caseItem?.federal_access_level, "Internal DOJ only"),
    generatedBy: profile?.full_name || user.email || "Authorized user",
    sections: [
      {
        title: "Proceeding",
        rows: [
          `Trial Jury: ${text(jury?.panel_name, text(jury?.trial_jury_number, "Trial Jury"))}`,
          `Proceeding Number: ${text(jury?.proceeding_number)}`,
          `Case: ${text(caseItem?.case_number, text(caseItem?.internal_number, "No case number"))} — ${text(caseItem?.case_caption, text(caseItem?.title))}`,
          `Court: ${text(court?.display_name, text(court?.official_name))}`,
          `District: ${text(jury?.district)}`,
          `Courtroom: ${text(jury?.courtroom)}`,
          `Jury type: ${text(jury?.jury_type)}`,
          `Voting round: ${text(round.title)} — ${text(round.status)}`,
          `Opened: ${text(round.opened_at)}`,
          `Closed: ${text(round.closed_at)}`,
        ],
      },
      {
        title: "Foreperson and panel",
        rows: [
          `Foreperson: ${text(foreperson?.display_name, text(foreperson?.juror_participant_number))}`,
          `Foreperson selection: ${text(jury?.foreperson_selection_method, "Selected by the jury")}`,
          `Selected panel size: ${jury?.selected_panel_size ?? activePanel.length}`,
          `Active members recorded: ${activePanel.length}`,
          ...activePanel.map((member) => `${member.juror_participant_number} — ${text(member.display_name)} — ${text(member.member_type, "juror")} — ${text(member.attendance_status, "present")}`),
        ],
      },
      {
        title: "Certified verdict",
        rows: verdictRows.length ? verdictRows : ["No certified verdict results were recorded for this voting round."],
      },
      {
        title: "Jury poll record",
        rows: (polls ?? []).length
          ? (polls ?? []).map((poll) => `Requested by: ${text(poll.poll_requested_by)} | Completed: ${poll.poll_completed ? "Yes" : "No"} | Unanimity confirmed: ${poll.unanimity_confirmed === null ? "Not recorded" : poll.unanimity_confirmed ? "Yes" : "No"} | Judge action: ${text(poll.judge_action)} | Notes: ${text(poll.notes)} | Created: ${text(poll.created_at)}`)
          : ["No jury polling record was recorded for this voting round."],
      },
      {
        title: "Ballot privacy",
        rows: [
          "This PDF contains only certified aggregate results and panel attendance information.",
          "Individual juror ballots, deliberation details, and partial voting trends are not included.",
          "ROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT RECORD.",
        ],
      },
    ],
  });

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "trial_jury_verdict_pdf_downloaded",
    table_name: "trial_jury_voting_rounds",
    record_id: roundId,
    description: "Protected Trial Jury Verdict Form PDF downloaded. Individual ballots were not included.",
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"trial-jury-verdict-${roundId}.pdf\"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
