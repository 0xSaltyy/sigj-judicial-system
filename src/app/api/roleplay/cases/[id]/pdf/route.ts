import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDojRecordPdf } from "@/lib/doj-record-pdf";
import { ROLEPLAY_NOTICE } from "@/lib/identity";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return new NextResponse("Supabase no está configurado.", { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminClient();
    const [{ data: record }, participants, matterLinks, evidence, docketEntries, actions, hearings, warrants, profile] = await Promise.all([
      supabase.from("cases").select("*,federal_courts(official_name,abbreviation)").eq("id", id).maybeSingle(),
      supabase.from("case_participants").select("role_code,side,counsel,participants(display_name,legal_name,sealed)").eq("case_id", id),
      supabase.from("matter_case_relationships").select("relationship_type,matters(matter_number,title,status)").eq("case_id", id),
      supabase.from("evidence_items").select("ete_id,formal_title,title,description,sha256_hash,evidence_status,access_classification,grand_jury_status,sealed,created_at").eq("case_id", id).is("archived_at", null).is("deleted_at", null).neq("grand_jury_status", "Grand-jury material").eq("sealed", false).order("created_at"),
      supabase.from("docket_entries").select("docket_entry_number,filing_timestamp,document_type_code,title,visibility").eq("case_id", id).is("archived_at", null).order("docket_entry_number"),
      supabase.from("case_actions").select("action_date,action_type,description,visibility").eq("case_id", id).is("archived_at", null).order("action_date"),
      supabase.from("hearings").select("scheduled_at,title,status").eq("case_id", id).is("archived_at", null).order("scheduled_at"),
      supabase.from("roleplay_warrants").select("warrant_number,warrant_type,status,confidentiality").eq("case_id", id).is("archived_at", null).order("created_at"),
      supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle(),
    ]);
    if (!record) return new NextResponse("Federal Case no encontrado.", { status: 404 });
    await admin?.from("pdf_export_audit").insert({ record_type: "case", record_id: id, export_kind: "Federal Case PDF", actor_id: user.id, included_sections: ["overview","matters","participants","docket","evidence","hearings","warrants"], excluded_restricted: true });
    const court = Array.isArray(record.federal_courts) ? record.federal_courts[0] : record.federal_courts;
    const pdf = buildDojRecordPdf({
      title: `Federal Case ${record.case_number || record.internal_number}`,
      subtitle: record.case_caption || record.title,
      classification: record.federal_access_level || record.confidentiality_level || "Internal DOJ only",
      generatedBy: profile.data?.full_name || user.email || "Authorized user",
      sections: [
        { title: "Executive summary", rows: [`Case Number: ${record.case_number || record.internal_number}`, `Docket Number: ${record.docket_number || "No Docket Number"}`, `Caption: ${record.case_caption || record.title}`, `Court: ${court?.official_name || "Court pending"}`, `Status: ${record.status}`, `Summary: ${record.summary}`] },
        { title: "Originating DOJ Matters", rows: (matterLinks.data ?? []).map((row) => {
          const m = Array.isArray(row.matters) ? row.matters[0] : row.matters;
          return `${m?.matter_number} - ${m?.title} - ${m?.status} - ${row.relationship_type}`;
        }) },
        { title: "Participants", rows: (participants.data ?? []).map((row) => {
          const p = Array.isArray(row.participants) ? row.participants[0] : row.participants;
          return `${row.role_code} - ${p?.display_name || p?.legal_name || "Participant"}${row.side ? ` - ${row.side}` : ""}${p?.sealed ? " - sealed" : ""}`;
        }) },
        { title: "Docket", rows: (docketEntries.data ?? []).map((item) => `${item.docket_entry_number} - ${item.filing_timestamp} - ${item.document_type_code || "Document"} - ${item.title} - ${item.visibility}`) },
        { title: "Evidence Index", rows: (evidence.data ?? []).map((item) => `${item.ete_id || "No ETE"} - ${item.formal_title || item.title} - ${item.evidence_status} - hash ${(item.sha256_hash || "").slice(0, 12)} - ${item.access_classification}`) },
        { title: "Hearings", rows: (hearings.data ?? []).map((item) => `${item.scheduled_at} - ${item.title} - ${item.status}`) },
        { title: "Warrants", rows: (warrants.data ?? []).map((item) => `${item.warrant_number} - ${item.warrant_type} - ${item.status} - ${item.confidentiality}`) },
        { title: "Activity", rows: (actions.data ?? []).map((item) => `${item.action_date} - ${item.action_type} - ${item.description} - ${item.visibility}`) },
      ],
    });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${record.case_number || record.internal_number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const [{ data: record }, participants, docketEntries, actions, proceedings, hearings, warrants] = await Promise.all([
    supabase.from("public_case_lookup").select("*").eq("id", id).maybeSingle(),
    supabase.from("public_case_participants").select("role_label,display_name,side").eq("case_id", id),
    supabase.from("docket_entries").select("docket_entry_number,filing_timestamp,document_type_code,title,visibility").eq("case_id", id).eq("visibility", "public").is("archived_at", null).order("docket_entry_number", { ascending: true }),
    supabase.from("case_actions").select("action_date,action_type,description").eq("case_id", id).eq("visibility", "public").is("archived_at", null).order("action_date", { ascending: true }),
    supabase.from("proceedings").select("providence_number,title,status").eq("case_id", id).eq("visibility", "public").eq("status", "Publicado").is("archived_at", null).order("created_at", { ascending: true }),
    supabase.from("hearings").select("scheduled_at,title,status").eq("case_id", id).eq("is_public", true).is("archived_at", null).order("scheduled_at", { ascending: true }),
    supabase.from("roleplay_warrants").select("warrant_number,warrant_type,status").eq("case_id", id).eq("confidentiality", "public").is("archived_at", null).order("created_at", { ascending: true }),
  ]);
  if (!record) return new NextResponse("Federal Case público no encontrado.", { status: 404 });

  const lines = [
    "U.S. Department of Justice",
    "ROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.",
    ROLEPLAY_NOTICE,
    "",
    `Case Number: ${record.case_number || record.internal_number}`,
    `Docket Number: ${record.docket_number || "No Docket Number publicly recorded."}`,
    `Caption: ${record.case_caption || record.title}`,
    `Case Category: ${record.case_category}`,
    `Federal Court: ${record.court_name || record.court_abbreviation || "Federal court"}`,
    `Status: ${record.status}`,
    `Access Level: ${record.federal_access_level}`,
    `Opened: ${record.filed_at}`,
    "",
    "Resumen",
    record.summary || record.title,
    "",
    "Public participants",
    ...((participants.data ?? []).length ? (participants.data ?? []).flatMap((item) => [`- ${item.role_label}: ${item.display_name}${item.side ? ` (${item.side})` : ""}`]) : ["No public participants listed."]),
    "",
    "Public docket entries",
    ...((docketEntries.data ?? []).length ? (docketEntries.data ?? []).flatMap((item) => [`- ${item.docket_entry_number} · ${item.filing_timestamp} · ${item.document_type_code || "Document"}: ${item.title}`]) : ["No public docket entries."]),
    "",
    "Public events",
    ...((actions.data ?? []).length ? (actions.data ?? []).flatMap((item) => [`- ${item.action_date} · ${item.action_type}: ${item.description}`]) : ["No public events."]),
    "",
    "Public orders",
    ...((proceedings.data ?? []).length ? (proceedings.data ?? []).flatMap((item) => [`- ${item.providence_number} · ${item.title} · ${item.status}`]) : ["No public orders."]),
    "",
    "Public hearings",
    ...((hearings.data ?? []).length ? (hearings.data ?? []).flatMap((item) => [`- ${item.scheduled_at} · ${item.title} · ${item.status}`]) : ["No public hearings."]),
    "",
    "Public warrants",
    ...((warrants.data ?? []).length ? (warrants.data ?? []).flatMap((item) => [`- ${item.warrant_number} · ${item.warrant_type} · ${item.status}`]) : ["No public warrants."]),
    "",
    `Generado: ${new Date().toISOString()}`,
    "Usuario generador: visitante público",
    "Página 1",
    "Developed by: kcobainn",
  ];

  const pdf = buildPdf(lines);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${record.case_number || record.internal_number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildPdf(lines: string[]) {
  const escaped = lines.map((line) => line.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)"));
  const content = ["BT", "/F1 11 Tf", "54 770 Td", "14 TL", ...escaped.flatMap((line, index) => (index === 0 ? [`(${line}) Tj`] : ["T*", `(${line.slice(0, 96)}) Tj`])), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { body += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "utf8");
}
