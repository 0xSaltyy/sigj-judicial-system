type PdfPage = string[];

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const LINE_HEIGHT = 13;
const BODY_SIZE = 10.5;
const ROLEPLAY_RECORD_NOTICE = "ROLEPLAY RECORD — NOT AN FBI, CJIS OR GOVERNMENT BACKGROUND CHECK";
const WATERMARK = "ROLEPLAY — LIMITED PORTAL RECORDS";

type SummaryInput = {
  requestNumber?: string;
  personRecordNumber: string;
  verifiedName: string;
  scope?: string;
  verificationCode?: string;
  expirationDate?: string;
  events: Array<{ title: string; lines: string[] }>;
};

export function buildCriminalHistorySummaryPdf(input: SummaryInput) {
  const pages: PdfPage[] = [[]];
  let page = pages[0];
  let y = PAGE_HEIGHT - MARGIN;
  const nextPage = () => {
    addFooter(page, pages.length);
    page = [];
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
    addWatermark(page);
  };
  const ensure = (height: number) => {
    if (y - height < MARGIN + 40) nextPage();
  };
  const text = (value: string, x: number, size = BODY_SIZE, font = "F1") => {
    page.push(`BT /${font} ${size} Tf ${x} ${y} Td ${pdfString(value)} Tj ET`);
  };
  const centered = (value: string, size = BODY_SIZE, font = "F1") => {
    const width = value.length * size * 0.43;
    text(value, Math.max(MARGIN, (PAGE_WIDTH - width) / 2), size, font);
  };
  const paragraph = (value: string, x = MARGIN, width = PAGE_WIDTH - MARGIN * 2, size = BODY_SIZE) => {
    const lines = wrap(value, Math.floor(width / (size * 0.48)));
    ensure(lines.length * LINE_HEIGHT + 8);
    for (const row of lines) {
      text(row, x, size);
      y -= LINE_HEIGHT;
    }
  };
  const heading = (value: string) => {
    ensure(30);
    y -= 8;
    text(value.toUpperCase(), MARGIN, 11, "F2");
    page.push(`0.7 w ${MARGIN} ${y - 4} m ${PAGE_WIDTH - MARGIN} ${y - 4} l S`);
    y -= 18;
  };

  addWatermark(page);
  centered("PORTAL CRIMINAL HISTORY SUMMARY", 14, "F2");
  y -= 17;
  centered("Resumen de antecedentes del portal", 12, "F2");
  y -= 20;
  paragraph(ROLEPLAY_RECORD_NOTICE, MARGIN, PAGE_WIDTH - MARGIN * 2, 9);
  y -= 12;
  heading("Subject and request");
  const meta = [
    ["Request Number", input.requestNumber || "Administrative/internal generation"],
    ["Person Record Number", input.personRecordNumber],
    ["Verified subject name", input.verifiedName],
    ["Date generated", new Date().toISOString()],
    ["Scope", input.scope || "Portal-maintained records only"],
    ["Verification code", input.verificationCode || "Not issued"],
    ["Expiration date", input.expirationDate || "Not issued"],
  ];
  for (const [label, value] of meta) {
    ensure(24);
    text(label, MARGIN, 8.5, "F2");
    text(value, MARGIN + 155, 10, "F1");
    page.push(`0.4 w ${MARGIN + 155} ${y - 3} m ${PAGE_WIDTH - MARGIN} ${y - 3} l S`);
    y -= 22;
  }

  heading("Required limitation");
  paragraph("This search covers only records entered into this roleplay portal. It is not a nationwide FBI, state, local or commercial background check.");
  paragraph("Este resultado no certifica que la persona carezca de antecedentes fuera de los registros disponibles en este portal.");

  heading("Events, charges and dispositions");
  if (input.events.length === 0) {
    paragraph("No se encontraron registros de antecedentes en esta base de datos del portal.");
  }
  for (const event of input.events) {
    ensure(40);
    text(event.title, MARGIN, 10.5, "F2");
    y -= 15;
    event.lines.forEach((line) => paragraph(line, MARGIN + 16, PAGE_WIDTH - MARGIN * 2 - 16, 10));
    y -= 6;
  }

  addFooter(page, pages.length);
  return assemblePdf(pages);
}

function addWatermark(page: PdfPage) {
  page.push("q 0.88 0.88 0.88 rg 0.45 0.45 0.45 RG");
  page.push(`BT /F2 38 Tf 0.707 0.707 -0.707 0.707 125 270 Tm ${pdfString(WATERMARK)} Tj ET`);
  page.push("0 0 0 rg 0 0 0 RG Q");
}

function addFooter(page: PdfPage, pageNumber: number) {
  page.push(`0.8 w ${MARGIN} 38 m ${PAGE_WIDTH - MARGIN} 38 l S`);
  page.push(`BT /F2 7.5 Tf ${MARGIN} 25 Td ${pdfString(ROLEPLAY_RECORD_NOTICE)} Tj ET`);
  page.push(`BT /F1 8 Tf ${PAGE_WIDTH - 150} 25 Td ${pdfString(`Page ${pageNumber} · Developed by: kcobainn`)} Tj ET`);
}

function assemblePdf(pages: PdfPage[]) {
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  pages.forEach((content, index) => {
    const pageObj = 3 + index * 2;
    const contentObj = pageObj + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >> >> >> /Contents ${contentObj} 0 R >>`);
    const stream = content.join("\n");
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function wrap(value: string, max: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function pdfString(value: string) {
  let output = "(";
  for (const char of value) {
    const code = winAnsiCode(char);
    if (code === 0x28 || code === 0x29 || code === 0x5c) output += `\\${String.fromCharCode(code)}`;
    else if (code >= 0x20 && code <= 0x7e) output += String.fromCharCode(code);
    else output += `\\${code.toString(8).padStart(3, "0")}`;
  }
  return `${output})`;
}

function winAnsiCode(char: string) {
  const code = char.charCodeAt(0);
  if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) return code;
  return ({ "’": 0x92, "“": 0x93, "”": 0x94, "–": 0x96, "—": 0x97 } as Record<string, number>)[char] ?? 0x3f;
}
