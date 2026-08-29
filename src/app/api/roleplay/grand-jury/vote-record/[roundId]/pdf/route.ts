import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { buildDojRecordPdf } from "@/lib/doj-record-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Snapshot = {
  voting_round_id?: string;
  vote_record_number?: string;
  panel_name?: string;
  grand_jury_number?: string;
  proceeding_number?: string;
  matter_number?: string;
  matter_title?: string;
  court?: string;
  district?: string;
  session_title?: string;
  opened_at?: string;
  certified_at?: string;
  supervising_judge?: string;
  foreperson?: string;
  deputy_foreperson?: string;
  clerk?: string;
  selected_panel_size?: number;
  present_members?: number;
  threshold?: number;
  classification?: string;
  counts?: Array<{
    count_number?: number;
    person_or_entity?: string;
    statute?: string;
    offense_title?: string;
    allegation_summary?: string;
    true_bill_votes?: number;
    no_bill_votes?: number;
    recused_votes?: number;
    threshold?: number;
    result?: string;
  }>;
};

export async function GET(_request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("ensure_grand_jury_vote_record", { p_round_id: roundId });
  if (error || !data || typeof data !== "object") {
    return NextResponse.json({ error: error?.message ?? "Vote record not available" }, { status: 403 });
  }

  const payload = data as { record_id?: string; vote_record_number?: string; snapshot?: Snapshot };
  const snapshot = payload.snapshot ?? {};
  const recordNumber = payload.vote_record_number || snapshot.vote_record_number || "Grand Jury Vote Record";
  const counts = snapshot.counts ?? [];
  const pdf = buildDojRecordPdf({
    title: "Grand Jury Vote Record",
    subtitle: `${recordNumber} · ${snapshot.panel_name || snapshot.grand_jury_number || "Grand Jury"}`,
    classification: "SEALED - GRAND JURY MATERIAL",
    generatedBy: "Protected server route",
    sections: [
      {
        title: "Proceeding",
        rows: [
          `Vote Record: ${recordNumber}`,
          `Grand Jury: ${snapshot.panel_name || snapshot.grand_jury_number || "Not recorded"}`,
          `Proceeding Number: ${snapshot.proceeding_number || "Not recorded"}`,
          `Matter: ${snapshot.matter_number || "Not recorded"} - ${snapshot.matter_title || "Restricted"}`,
          `Court: ${snapshot.court || "Not recorded"}`,
          `District: ${snapshot.district || "Not recorded"}`,
          `Session: ${snapshot.session_title || "Certified voting round"}`,
          `Opened: ${snapshot.opened_at || "Not recorded"}`,
          `Certified: ${snapshot.certified_at || "Not recorded"}`,
        ],
      },
      {
        title: "Court officers and certification",
        rows: [
          `Judge or Magistrate Judge supervisor: ${snapshot.supervising_judge || "Not recorded"}`,
          `Foreperson: ${snapshot.foreperson || "Not recorded"}`,
          `Deputy foreperson: ${snapshot.deputy_foreperson || "Not recorded"}`,
          `Clerk: ${snapshot.clerk || "Not recorded"}`,
          `Classification: ${snapshot.classification || "SEALED - GRAND JURY MATERIAL"}`,
        ],
      },
      {
        title: "Compact quorum",
        rows: [
          `Assigned panel size: ${snapshot.selected_panel_size ?? "Not recorded"}`,
          `Present eligible members: ${snapshot.present_members ?? "Not recorded"}`,
          `Required True Bill threshold: ${snapshot.threshold ?? "Not recorded"}`,
          "Threshold rule: two thirds of the compact panel, rounded up, calculated server-side.",
        ],
      },
      {
        title: "Certified counts",
        rows: counts.length ? counts.map((count) => [
          `Count ${count.count_number ?? ""}: ${count.person_or_entity || "Person/entity pending"}`,
          `Statute: ${count.statute || "Not recorded"}`,
          `Offense: ${count.offense_title || "Not recorded"}`,
          `Summary: ${count.allegation_summary || "Not recorded"}`,
          `True Bill votes: ${count.true_bill_votes ?? 0}; No Bill votes: ${count.no_bill_votes ?? 0}; Recused: ${count.recused_votes ?? 0}; Threshold: ${count.threshold ?? snapshot.threshold ?? "Not recorded"}; Result: ${count.result || "Not recorded"}`,
        ].join(" | ")) : ["No proposed counts were included in this certified vote record."],
      },
      {
        title: "Sealed ballot protection",
        rows: [
          "This record contains only aggregate certified totals.",
          "It does not include individual juror ballots, individual identities linked to ballots, deliberations, or partial trends.",
          "ROLEPLAY DOCUMENT - NOT A REAL GOVERNMENT OR COURT RECORD.",
        ],
      },
    ],
  });
  const hash = createHash("sha256").update(pdf).digest("hex");
  if (payload.record_id) {
    await supabase.from("grand_jury_vote_records").update({ pdf_sha256: hash, download_count: 1, last_downloaded_at: new Date().toISOString() }).eq("id", payload.record_id).is("pdf_sha256", null);
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "grand_jury_vote_record_pdf_downloaded",
      table_name: "grand_jury_vote_records",
      record_id: payload.record_id,
      description: "Protected Grand Jury Vote Record PDF downloaded. Individual ballots were not included.",
      metadata: { round_id: roundId, pdf_sha256: hash },
    });
  }
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${recordNumber.replace(/[^a-zA-Z0-9_.-]/g, "_")}.pdf\"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
