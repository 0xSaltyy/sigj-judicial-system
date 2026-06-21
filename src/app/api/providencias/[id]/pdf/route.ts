import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  type DocumentMetadata,
  resolveTemplateStyle,
  type TemplateStyle,
  writtenDate,
} from "@/lib/document-templates";
import { appUrl, hashSecret } from "@/lib/secure-tokens";
import { formalSignerName, formalSignerTitle } from "@/lib/signature-display";
import type { AuthenticatedProfile } from "@/lib/auth/authorization";
import { can } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PDF has no CSS font stack. Bookman is not one of its standard fonts, so the
// generated signature sheet uses the built-in serif fallback instead of
// embedding or distributing a proprietary font file.
const PDF_SERIF_REGULAR = StandardFonts.TimesRoman;
const PDF_SERIF_BOLD = StandardFonts.TimesRomanBold;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Servicio de documentos no configurado" }, { status: 503 });
  const { data: proceeding } = await admin
    .from("proceedings")
    .select("id,case_id,providence_number,title,type,chamber,providence_date,pdf_path,pdf_original_name,status,visibility,template_style,document_metadata,case:cases(internal_number,judicial_number,authority_type,chamber,municipality,public_visibility,confidentiality_level,archived_at,dependency:dependencies(name))")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (!proceeding?.pdf_path) return NextResponse.json({ error: "PDF no disponible" }, { status: 404 });
  const caseRecord = Array.isArray(proceeding.case) ? proceeding.case[0] : proceeding.case;
  const dependency = Array.isArray(caseRecord?.dependency) ? caseRecord.dependency[0] : caseRecord?.dependency;
  const { data: sala } = await admin.from("sala_sessions").select("act_number,session_date,chamber,vote_result,rapporteur:profiles!sala_sessions_rapporteur_id_fkey(full_name)").eq("proceeding_id", id).maybeSingle();
  const rapporteur = Array.isArray(sala?.rapporteur) ? sala.rapporteur[0] : sala?.rapporteur;
  const metadata = {
    ...((proceeding.document_metadata || {}) as DocumentMetadata),
    ...(sala ? { actNumber: sala.act_number || undefined, sessionDate: sala.session_date || undefined, roomName: sala.chamber || undefined, rapporteurName: rapporteur?.full_name || undefined, voteResult: sala.vote_result || undefined } : {}),
  };
  const templateStyle = resolveTemplateStyle(proceeding.template_style, [
    dependency?.name,
    caseRecord?.authority_type,
    caseRecord?.chamber,
    proceeding.chamber,
  ]);
  const allowed = await canReadPdf(request, proceeding.case_id, id, {
    status: proceeding.status,
    visibility: proceeding.visibility,
    publicVisibility: Boolean(caseRecord?.public_visibility),
    confidentiality: caseRecord?.confidentiality_level,
    archived: Boolean(caseRecord?.archived_at),
  });
  if (!allowed) return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });

  const { data: source } = await admin.storage
    .from("providence-files")
    .download(proceeding.pdf_path);
  if (!source) return NextResponse.json({ error: "No fue posible leer el PDF" }, { status: 502 });
  const sourceBytes = Buffer.from(await source.arrayBuffer());
  if (sourceBytes.subarray(0, 5).toString("ascii") !== "%PDF-")
    return NextResponse.json({ error: "El archivo almacenado no es un PDF válido" }, { status: 422 });
  const originalName = safeFilename(proceeding.pdf_original_name || proceeding.providence_number) || "providencia.pdf";
  if (request.nextUrl.searchParams.get("variant") === "original") {
    const download = request.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(sourceBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${originalName.endsWith(".pdf") ? originalName : `${originalName}.pdf`}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const { data: signatures } = await admin
    .from("signatures")
    .select("id,signer_name,signer_title,signature_image_path,purpose,signed_at,verification_code,signature_order")
    .eq("target_type", "proceeding")
    .eq("target_id", id)
    .eq("status", "signed")
    .order("signature_order");

  try {
    const pdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    const printableSignatures = (signatures ?? [])
      .map((signature) => ({
        ...signature,
        signer_name: formalSignerName(signature.signer_name),
        signer_title: formalSignerTitle(signature.signer_title),
      }))
      .filter((signature) => signature.signer_name && signature.signer_title);
    if (printableSignatures.length) {
      const [regular, bold, logo] = await Promise.all([
        pdf.embedFont(PDF_SERIF_REGULAR),
        pdf.embedFont(PDF_SERIF_BOLD),
        loadPngAsset(
          pdf,
          templateStyle === "corte_suprema" ? "corte-suprema.png" : "escudo-institucional.png",
        ),
      ]);
      if (templateStyle === "corte_suprema" && !logo) {
        throw new Error("El logotipo de la Corte Suprema no está disponible");
      }
      const signatureAssets = await Promise.all(printableSignatures.map(async (signature) => {
        const { data } = await admin.storage.from("signatures").download(signature.signature_image_path);
        if (!data) throw new Error("La imagen de una firma completada no está disponible");
        return { ...signature, image: await pdf.embedPng(await data.arrayBuffer()) };
      }));
      appendSignatureSheets(pdf, signatureAssets, {
        regular,
        bold,
        logo,
        title: proceeding.title,
        number: proceeding.providence_number,
        radicado: caseRecord?.judicial_number || caseRecord?.internal_number || "—",
        date: proceeding.providence_date || "—",
        originalName: proceeding.pdf_original_name || "Documento PDF",
        verificationUrl: appUrl(`/providencias/${id}`),
        style: templateStyle,
        dependency: dependency?.name || proceeding.chamber || "Despacho judicial",
        room: metadata.roomName || proceeding.chamber || caseRecord?.chamber || "Sala judicial",
        rapporteurName: metadata.rapporteurName || null,
        documentCode: metadata.documentCode || proceeding.providence_number,
        actNumber: metadata.actNumber || null,
        city: metadata.city || caseRecord?.municipality || "Bogotá, D.C.",
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

type SignatureSheetContext = {
  regular: PDFFont;
  bold: PDFFont;
  logo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null;
  title: string;
  number: string;
  radicado: string;
  date: string;
  originalName: string;
  verificationUrl: string;
  style: Exclude<TemplateStyle, "auto">;
  dependency: string;
  room: string;
  rapporteurName: string | null;
  documentCode: string;
  actNumber: string | null;
  city: string;
};

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
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,dependency_id,position_title,is_active,is_owner")
    .eq("id", user.user.id)
    .maybeSingle();
  if (
    !profile?.is_active ||
    !(await can(profile as AuthenticatedProfile, "view", "providencias", { supabase })) ||
    !(await can(profile as AuthenticatedProfile, "print", "providencias", { supabase }))
  ) return false;
  const { data } = await supabase.from("proceedings").select("id").eq("id", proceedingId).eq("case_id", caseId).maybeSingle();
  return Boolean(data);
}

async function loadPngAsset(pdf: PDFDocument, filename: string) {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", filename));
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
  context: SignatureSheetContext,
) {
  const chunks = Array.from({ length: Math.ceil(signatures.length / 4) }, (_, index) => signatures.slice(index * 4, index * 4 + 4));
  chunks.forEach((chunk, pageIndex) => {
    const page = pdf.addPage([595.28, 841.89]);
    drawSheetHeader(page, context, pageIndex + 1, chunks.length);
    chunk.forEach((signature, index) => drawSignature(page, signature, index, context));
    page.drawText("Sistema ficticio de demostración académica. No produce efectos jurídicos.", {
      x: 128, y: 28, size: 7, font: context.regular, color: rgb(0.42, 0.42, 0.42),
    });
    page.drawText(`Verificación: ${context.verificationUrl}`, {
      x: 72, y: 42, size: 7, font: context.regular, color: rgb(0.3, 0.3, 0.3),
    });
  });
}

function drawSheetHeader(
  page: PDFPage,
  context: SignatureSheetContext,
  pageNumber: number,
  totalPages: number,
) {
  if (context.style === "corte_suprema") {
    if (context.logo) {
      const scaled = context.logo.scaleToFit(92, 98);
      page.drawImage(context.logo, { x: (595.28 - scaled.width) / 2, y: 714, width: scaled.width, height: scaled.height });
    }
    centered(page, context.room.toUpperCase(), 692, 11, context.bold);
    if (context.rapporteurName) {
      centered(page, context.rapporteurName.toUpperCase(), 658, 10.5, context.bold);
      centered(page, "MAGISTRADO/A PONENTE", 642, 9.5, context.bold);
    }
    centered(page, "HOJA DE FIRMAS", 610, 13, context.bold);
    drawLabel(page, "Documento", context.documentCode, 580, context);
    drawLabel(page, "Radicación n.°", context.radicado, 562, context);
    if (context.actNumber) drawLabel(page, "Acta", context.actNumber, 544, context);
    drawLabel(page, "Fecha", `${context.city}, ${writtenDate(context.date)}`, context.actNumber ? 526 : 544, context);
    drawLabel(page, "Archivo", context.originalName, context.actNumber ? 508 : 526, context);
    const titleLines = wrapText(context.title, context.bold, 10, 445);
    titleLines.slice(0, 2).forEach((line, index) => centered(page, line, (context.actNumber ? 483 : 501) - index * 13, 10, context.bold));
    page.drawLine({ start: { x: 64, y: 455 }, end: { x: 531, y: 455 }, thickness: 0.7, color: rgb(0.25, 0.25, 0.25) });
    page.drawText(`Hoja ${pageNumber} de ${totalPages}`, { x: 478, y: 32, size: 7, font: context.regular, color: rgb(0.42, 0.42, 0.42) });
    return;
  }
  if (context.logo) {
    const scaled = context.logo.scaleToFit(58, 58);
    page.drawImage(context.logo, { x: (595.28 - scaled.width) / 2, y: 755, width: scaled.width, height: scaled.height });
  }
  centered(page, "REPÚBLICA DE COLOMBIA", 742, 10, context.bold);
  centered(page, "RAMA JUDICIAL DEL PODER PÚBLICO", 728, 10, context.bold);
  if (context.style === "tribunal_superior") {
    centered(page, context.dependency.toUpperCase(), 711, 9.5, context.bold);
  }
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
  context: SignatureSheetContext,
) {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const x = 72 + column * 244;
  const y = (context.style === "corte_suprema" ? 310 : 402) - row * 220;
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

function drawLabel(page: PDFPage, label: string, value: string, y: number, context: SignatureSheetContext) {
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
