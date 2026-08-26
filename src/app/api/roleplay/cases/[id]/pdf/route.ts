import { NextResponse } from "next/server";
import { actions, cases, hearings, proceedings, ROLEPLAY_NOTICE, warrants } from "@/lib/demo-data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = cases.find((item) => item.id === id && item.publicVisibility);
  if (!record) return new NextResponse("Expediente público no encontrado.", { status: 404 });

  const lines = [
    "DEPARTMENT OF JUSTICE ROLEPLAY",
    "ROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.",
    ROLEPLAY_NOTICE,
    "",
    `Expediente: ${record.internalNumber}`,
    `Docket: ${record.judicialNumber}`,
    `Título: ${record.title}`,
    `Estado: ${record.status}`,
    `Nivel de acceso: ${record.confidentiality}`,
    `Tribunal/División: ${record.court}`,
    `Funcionario asignado: ${record.judge}`,
    `Fecha de apertura: ${record.filedAt}`,
    "",
    "Resumen",
    record.summary,
    "",
    "Partes",
    `Solicitante: ${record.claimant}`,
    `Parte relacionada: ${record.defendant}`,
    "",
    "Índice",
    "1. Resumen",
    "2. Línea de tiempo",
    "3. Actuaciones",
    "4. Providencias",
    "5. Audiencias",
    "6. Warrants",
    "",
    "Línea de tiempo y actuaciones",
    ...actions.filter((item) => item.caseId === id).flatMap((item) => [`- ${item.date} · ${item.type}: ${item.description}`]),
    "",
    "Providencias",
    ...proceedings.filter((item) => item.caseNumber === record.internalNumber).flatMap((item) => [`- ${item.number} · ${item.title} · ${item.status}`]),
    "",
    "Audiencias",
    ...hearings.filter((item) => item.caseNumber === record.internalNumber).flatMap((item) => [`- ${item.iso} · ${item.title} · ${item.status}`]),
    "",
    "Warrants",
    ...warrants.filter((item) => item.caseNumber === record.internalNumber).flatMap((item) => [`- ${item.number} · ${item.type} · ${item.status}`]),
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
      "Content-Disposition": `attachment; filename="${record.internalNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildPdf(lines: string[]) {
  const escaped = lines.map((line) => line.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)"));
  const content = [
    "BT",
    "/F1 11 Tf",
    "54 770 Td",
    "14 TL",
    ...escaped.flatMap((line, index) => (index === 0 ? [`(${line}) Tj`] : ["T*", `(${line.slice(0, 96)}) Tj`])),
    "ET",
  ].join("\n");
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
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "utf8");
}
