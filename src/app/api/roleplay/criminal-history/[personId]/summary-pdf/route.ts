import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCriminalHistorySummaryPdf } from "@/lib/criminal-history-pdf";

export async function GET(_: Request, { params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const [{ data: person }, { data: arrests }, { data: charges }, { data: dispositions }] = await Promise.all([
    supabase.from("persons").select("person_record_number,legal_first_name,legal_middle_name,legal_last_name,suffix").eq("id", personId).maybeSingle(),
    supabase.from("arrest_events").select("arrest_event_number,arresting_agency,arrest_at,custody_outcome,verification_status").eq("person_id", personId).order("arrest_at", { ascending: false }),
    supabase.from("criminal_charges").select("count_number,statute_citation,offense_title,status,filing_date").eq("person_id", personId).order("filing_date", { ascending: false }),
    supabase.from("charge_dispositions").select("count_number,disposition_type,conviction_indicator,disposition_date,finality_status,case_number,docket_number").eq("person_id", personId).order("disposition_date", { ascending: false }),
  ]);
  if (!person) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const name = [person.legal_first_name, person.legal_middle_name, person.legal_last_name, person.suffix].filter(Boolean).join(" ");
  const events = [
    ...(arrests ?? []).map((item) => ({ title: `Arrest Event ${item.arrest_event_number}`, lines: [`${item.arresting_agency} · ${item.arrest_at} · ${item.custody_outcome || "Custody outcome pending"}`, `Completeness: ${item.verification_status}`] })),
    ...(charges ?? []).map((item) => ({ title: `Charge Count ${item.count_number ?? "N/A"}`, lines: [`${item.statute_citation} · ${item.offense_title}`, `Status: ${item.status} · Filed: ${item.filing_date || "not recorded"}`] })),
    ...(dispositions ?? []).map((item) => ({ title: `Disposition Count ${item.count_number ?? "N/A"}`, lines: [`${item.disposition_type} · ${item.disposition_date} · ${item.finality_status}`, `${item.conviction_indicator ? "Conviction indicator applies" : "Not counted as active conviction"} · ${item.case_number || "No Case Number"} · ${item.docket_number || "No Docket Number"}`] })),
  ];
  const pdf = buildCriminalHistorySummaryPdf({
    personRecordNumber: person.person_record_number,
    verifiedName: name,
    scope: "Internal authorized export of portal-maintained records only",
    events,
  });
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "CRIMINAL_HISTORY_SUMMARY_PDF_DOWNLOADED",
    table_name: "persons",
    record_id: personId,
    description: "Resumen de antecedentes del portal descargado por usuario autorizado",
  });
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${person.person_record_number}-criminal-history-summary.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
