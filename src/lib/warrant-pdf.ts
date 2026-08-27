import { buildExecutionText, buildWarrantSections, getWarrantTemplate, getWarrantTitle, normalizeWarrantData, ROLEPLAY_DOCUMENT_NOTICE, ROLEPLAY_WATERMARK, type WarrantFormData } from "@/lib/warrants";

type PdfPage = string[];

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const LINE_HEIGHT = 13;
const BODY_SIZE = 10.5;

export function buildWarrantPdf(input: Partial<WarrantFormData> & Record<string, unknown>) {
  const data = normalizeWarrantData(input);
  const template = getWarrantTemplate(data.warrant_type);
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
  const line = (x1: number, y1: number, x2: number, y2: number, width = 0.8) => {
    page.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
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
    ensure(28);
    y -= 8;
    text(value.toUpperCase(), MARGIN, 11, "F2");
    line(MARGIN, y - 4, PAGE_WIDTH - MARGIN, y - 4);
    y -= 18;
  };
  const checkbox = (checked: boolean, label: string) => {
    ensure(22);
    page.push(`0.8 w ${MARGIN} ${y - 3} 10 10 re S`);
    if (checked) text("X", MARGIN + 2, 9, "F2");
    paragraph(label, MARGIN + 18, PAGE_WIDTH - MARGIN * 2 - 18, 10);
    y -= 2;
  };

  addWatermark(page);
  text(`RP-AO93 — ${template.label}`, MARGIN, 9, "F2");
  y -= 14;
  line(MARGIN, y, PAGE_WIDTH - MARGIN, y, 1.4);
  y -= 5;
  line(MARGIN, y, PAGE_WIDTH - MARGIN, y, 0.8);
  y -= 24;
  centered("UNITED STATES DISTRICT COURT", 13, "F2");
  y -= 16;
  centered(data.district || "District selected by the Court", 11, "F1");
  if (data.division) {
    y -= 14;
    centered(data.division, 9.5, "F1");
  }
  y -= 22;
  line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y -= 18;

  text(template.subjectLabel, MARGIN, 10.5, "F3");
  text("Case No.", PAGE_WIDTH - 190, 10.5, "F1");
  y -= 15;
  paragraph(data.target_description || data.person_name || data.account_identifier || data.precise_location || "Target pending completion", MARGIN, PAGE_WIDTH - 270, 10.5);
  const caseLineY = y + 15;
  page.push(`BT /F4 9 Tf ${PAGE_WIDTH - 190} ${caseLineY} Td ${pdfString(data.case_number || data.warrant_number || "Pending")} Tj ET`);
  line(PAGE_WIDTH - 190, caseLineY - 4, PAGE_WIDTH - MARGIN, caseLineY - 4);
  y -= 14;

  centered(getWarrantTitle(data), 15, "F2");
  y -= 28;
  paragraph("To: Any authorized law enforcement officer", MARGIN, PAGE_WIDTH - MARGIN * 2, 10.5);
  paragraph(`An application by ${data.applicant_name || "the applicant"}${data.applicant_title ? `, ${data.applicant_title}` : ""}${data.applicant_agency ? `, ${data.applicant_agency}` : ""}, and the supporting statement or affidavit having been presented, the Court issues this warrant.`, MARGIN, PAGE_WIDTH - MARGIN * 2, 10.5);
  paragraph(template.orderText, MARGIN, PAGE_WIDTH - MARGIN * 2, 10.5);

  for (const section of buildWarrantSections(data).slice(0, 4)) {
    heading(section.title);
    paragraph(section.body, MARGIN, PAGE_WIDTH - MARGIN * 2, 10.2);
  }

  heading("Execution Authority");
  checkbox(data.execution_window !== "anytime", "Execution is authorized during daytime hours.");
  checkbox(data.execution_window === "anytime", `Execution at any time is authorized for good cause. ${data.night_execution_reason || ""}`.trim());
  paragraph(buildExecutionText(data), MARGIN, PAGE_WIDTH - MARGIN * 2, 10.2);

  heading("Issuance");
  const fields = [
    ["Issued date and time", formatDateTime(data.issued_at)],
    ["Execution deadline", formatDateTime(data.expires_at)],
    ["City and state", data.city_state || ""],
    ["Attorney for the government", data.attorney_name || ""],
  ];
  for (const [label, value] of fields) {
    ensure(24);
    text(label, MARGIN, 8.5, "F2");
    text(value, MARGIN + 150, 10, "F1");
    line(MARGIN + 150, y - 3, PAGE_WIDTH - MARGIN, y - 3);
    y -= 22;
  }

  ensure(80);
  y -= 24;
  line(MARGIN, y, MARGIN + 250, y);
  text("Judge's signature", MARGIN + 80, 9, "F1");
  text(data.judge_name || "Judge or Magistrate Judge", PAGE_WIDTH - 260, 10.5, "F2");
  y -= 14;
  text(data.judge_title || "United States Magistrate Judge", PAGE_WIDTH - 260, 10, "F1");

  for (const attachment of template.attachments) {
    nextPage();
    centered(attachment, 14, "F2");
    y -= 18;
    paragraph(`Case No. ${data.case_number || data.warrant_number || "Pending"} · Warrant No. ${data.warrant_number || "Pending"}`, MARGIN, PAGE_WIDTH - MARGIN * 2, 10);
    heading(attachment.includes("Return") ? "Return and Inventory" : attachment);
    const attachmentText = attachment.includes("Inventory") || attachment.includes("Return")
      ? (data.return_inventory || "The executing officer must record date, time, place, officer, person receiving copy, inventory, return to court, signature, judicial review and observations.")
      : [data.target_description, data.precise_location, data.items_to_search, data.items_to_seize, data.limitations, data.special_instructions].filter(Boolean).join("\n\n") || "Attachment content pending completion.";
    paragraph(attachmentText, MARGIN, PAGE_WIDTH - MARGIN * 2, 10.5);
  }

  addFooter(page, pages.length);
  return assemblePdf(pages);
}

function addWatermark(page: PdfPage) {
  page.push("q 0.85 0.85 0.85 rg 0.35 0.35 0.35 RG");
  page.push(`BT /F2 46 Tf 0.707 0.707 -0.707 0.707 135 260 Tm ${pdfString(ROLEPLAY_WATERMARK)} Tj ET`);
  page.push("0 0 0 rg 0 0 0 RG Q");
}

function addFooter(page: PdfPage, pageNumber: number) {
  page.push(`0.8 w ${MARGIN} 38 m ${PAGE_WIDTH - MARGIN} 38 l S`);
  page.push(`BT /F2 8 Tf ${MARGIN} 25 Td ${pdfString(ROLEPLAY_DOCUMENT_NOTICE)} Tj ET`);
  page.push(`BT /F1 8 Tf ${PAGE_WIDTH - 150} 25 Td ${pdfString(`Page ${pageNumber} · Developed by: kcobainn`)} Tj ET`);
}

function assemblePdf(pages: PdfPage[]) {
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  pages.forEach((content, index) => {
    const pageObj = 3 + index * 2;
    const contentObj = pageObj + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >> /F3 << /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >> /F4 << /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >> >> >> /Contents ${contentObj} 0 R >>`);
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
    } else {
      current = next;
    }
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
  const mapped: Record<string, number> = {
    "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87,
    "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e,
    "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
    "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
  };
  return mapped[char] ?? 0x3f;
}

function formatDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
}
