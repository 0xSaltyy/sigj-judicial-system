import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { hashSecret } from "@/lib/secure-tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Servicio de documentos no configurado" }, { status: 503 });
  const { data: proceeding } = await admin
    .from("proceedings")
    .select("id,case_id,providence_number,title,type,chamber,providence_date,pdf_path,pdf_original_name,status,visibility,case:cases(internal_number,judicial_number,public_visibility,confidentiality_level,archived_at)")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (!proceeding?.pdf_path) return NextResponse.json({ error: "PDF no disponible" }, { status: 404 });
  const caseRecord = Array.isArray(proceeding.case) ? proceeding.case[0] : proceeding.case;
  const allowed = await canReadPdf(request, proceeding.case_id, id, {
    status: proceeding.status,
    visibility: proceeding.visibility,
    publicVisibility: Boolean(caseRecord?.public_visibility),
    confidentiality: caseRecord?.confidentiality_level,
    archived: Boolean(caseRecord?.archived_at),
  });
  if (!allowed) return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });

  const [{ data: source }, { data: signatures }] = await Promise.all([
    admin.storage.from("providence-files").download(proceeding.pdf_path),
    admin.from("signatures").select("id,signer_name,signer_title,signature_image_path,purpose,signed_at,verification_code,signature_order").eq("target_type", "proceeding").eq("target_id", id).eq("status", "signed").order("signature_order"),
  ]);
  if (!source) return NextResponse.json({ error: "No fue posible leer el PDF" }, { status: 502 });

  try {
    const pdf = await PDFDocument.load(await source.arrayBuffer(), { ignoreEncryption: true });
    if (signatures?.length) {
      const [regular, bold, emblem] = await Promise.all([
        pdf.embedFont(StandardFonts.TimesRoman),
        pdf.embedFont(StandardFonts.TimesRomanBold),
        loadEmblem(pdf),
      ]);
      const signatureAssets = await Promise.all(signatures.map(async (signature) => {
        const { data } = await admin.storage.from("signatures").download(signature.signature_image_path);
        return { ...signature, image: data ? await pdf.embedPng(await data.arrayBuffer()) : null };
      }));
      appendSignatureSheets(pdf, signatureAssets, {
        regular,
        bold,
        emblem,
        title: proceeding.title,
        number: proceeding.providence_number,
        radicado: caseRecord?.judicial_number || caseRecord?.internal_number || "—",
        date: proceeding.providence_date || "—",
        originalName: proceeding.pdf_original_name || "Documento PDF",
      });
    }
    const bytes = await pdf.save();
    const filename = `${safeFilename(proceeding.providence_number)}-firmado.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "El PDF no pudo combinarse con la hoja de firmas" }, { status: 422 });
  }
}

async function canReadPdf(
  request: NextRequest,
  caseId: string,
  proceedingId: string,
  record: { status: string; visibility: string; publicVisibility: boolean; confidentiality?: string | null; archived: boolean },
) {
  if (!record.archived && record.status === "Publicado" && record.visibility === "public" && record.publicVisibility && record.confidentiality === "Público") return true;
  const share = request.nextUrl.searchParams.get("share");
  const admin = createAdminClient();
  if (share && admin) {
    const { data } = await admin.from("share_links").select("id,case_id,include_proceedings,expires_at,revoked_at").eq("token_hash", hashSecret(share)).eq("case_id", caseId).maybeSingle();
    if (data?.include_proceedings && !data.revoked_at && new Date(data.expires_at) > new Date()) return true;
  }
  const supabase = await createClient();
  if (!supabase) return false;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return false;
  const { data } = await supabase.from("proceedings").select("id").eq("id", proceedingId).eq("case_id", caseId).maybeSingle();
  return Boolean(data);
}

async function loadEmblem(pdf: PDFDocument) {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "escudo-institucional.png"));
    return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

function appendSignatureSheets(
  pdf: PDFDocument,
  signatures: Array<{
    id: string;
    signer_name: string;
    signer_title: string;
    purpose: string;
    signed_at: string;
    verification_code: string;
    image: Awaited<ReturnType<PDFDocument["embedPng"]>> | null;
  }>,
  context: {
    regular: PDFFont;
    bold: PDFFont;
    emblem: Awaited<ReturnType<PDFDocument["embedPng"]>> | null;
    title: string;
    number: string;
    radicado: string;
    date: string;
    originalName: string;
  },
) {
  const chunks = Array.from({ length: Math.ceil(signatures.length / 4) }, (_, index) => signatures.slice(index * 4, index * 4 + 4));
  chunks.forEach((chunk, pageIndex) => {
    const page = pdf.addPage([595.28, 841.89]);
    drawSheetHeader(page, context, pageIndex + 1, chunks.length);
    chunk.forEach((signature, index) => drawSignature(page, signature, index, context));
    page.drawText("Sistema ficticio de demostración académica. No produce efectos jurídicos.", {
      x: 128, y: 28, size: 7, font: context.regular, color: rgb(0.42, 0.42, 0.42),
    });
  });
}

function drawSheetHeader(
  page: PDFPage,
  context: Parameters<typeof appendSignatureSheets>[2],
  pageNumber: number,
  totalPages: number,
) {
  if (context.emblem) {
    const scaled = context.emblem.scaleToFit(58, 58);
    page.drawImage(context.emblem, { x: (595.28 - scaled.width) / 2, y: 755, width: scaled.width, height: scaled.height });
  }
  centered(page, "REPÚBLICA DE COLOMBIA", 742, 10, context.bold);
  centered(page, "RAMA JUDICIAL DEL PODER PÚBLICO", 728, 10, context.bold);
  centered(page, "HOJA DE FIRMAS DEL DOCUMENTO ADJUNTO", 692, 13, context.bold);
  drawLabel(page, "Documento", context.originalName, 660, context);
  drawLabel(page, "Providencia", context.number, 642, context);
  drawLabel(page, "Radicado", context.radicado, 624, context);
  drawLabel(page, "Fecha", context.date, 606, context);
  const titleLines = wrapText(context.title, context.bold, 10, 445);
  titleLines.slice(0, 2).forEach((line, index) => centered(page, line, 579 - index * 13, 10, context.bold));
  page.drawLine({ start: { x: 64, y: 550 }, end: { x: 531, y: 550 }, thickness: 0.7, color: rgb(0.25, 0.25, 0.25) });
  page.drawText(`Hoja ${pageNumber} de ${totalPages}`, { x: 478, y: 32, size: 7, font: context.regular, color: rgb(0.42, 0.42, 0.42) });
}

function drawSignature(
  page: PDFPage,
  signature: Parameters<typeof appendSignatureSheets>[1][number],
  index: number,
  context: Parameters<typeof appendSignatureSheets>[2],
) {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const x = 72 + column * 244;
  const y = 402 - row * 220;
  if (signature.image) {
    const scaled = signature.image.scaleToFit(170, 80);
    page.drawImage(signature.image, { x: x + (190 - scaled.width) / 2, y: y + 56, width: scaled.width, height: scaled.height });
  }
  page.drawLine({ start: { x, y: y + 50 }, end: { x: x + 190, y: y + 50 }, thickness: 0.7 });
  centeredIn(page, signature.signer_name.toUpperCase(), x, 190, y + 34, 9.5, context.bold);
  centeredIn(page, signature.signer_title, x, 190, y + 20, 9, context.regular);
  centeredIn(page, formatTimestamp(signature.signed_at), x, 190, y + 6, 7.5, context.regular);
  centeredIn(page, `Código: ${signature.verification_code}`, x, 190, y - 7, 7, context.regular);
}

function drawLabel(page: PDFPage, label: string, value: string, y: number, context: Parameters<typeof appendSignatureSheets>[2]) {
  page.drawText(`${label}:`, { x: 72, y, size: 9, font: context.bold });
  page.drawText(value.slice(0, 95), { x: 145, y, size: 9, font: context.regular });
}

function centered(page: PDFPage, text: string, y: number, size: number, font: PDFFont) {
  page.drawText(text, { x: (595.28 - font.widthOfTextAtSize(text, size)) / 2, y, size, font });
}

function centeredIn(page: PDFPage, text: string, x: number, width: number, y: number, size: number, font: PDFFont) {
  const safe = text.slice(0, 65);
  page.drawText(safe, { x: x + Math.max(0, (width - font.widthOfTextAtSize(safe, size)) / 2), y, size, font });
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(value));
}

function safeFilename(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "providencia";
}
