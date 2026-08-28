import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ROLEPLAY_NOTICE } from "@/lib/identity";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return new NextResponse("Supabase no está configurado.", { status: 503 });
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
