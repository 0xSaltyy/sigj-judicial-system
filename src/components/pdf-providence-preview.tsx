import { Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecurePdfPreview } from "@/components/secure-pdf-preview";

export function PdfProvidencePreview({
  title,
  providenceNumber,
  documentType,
  documentDate,
  originalName,
  originalUrl,
  combinedUrl,
}: {
  title: string;
  providenceNumber: string;
  documentType: string;
  documentDate?: string | null;
  originalName?: string | null;
  originalUrl?: string | null;
  combinedUrl?: string | null;
}) {
  const downloadUrl = originalUrl
    ? `${originalUrl}${originalUrl.includes("?") ? "&" : "?"}download=1`
    : null;
  return (
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="border-b bg-slate-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#8a6a2c]">Providencia PDF original</p>
        <h2 className="mt-1 break-words text-lg font-semibold text-[#153553]">{title}</h2>
        <p className="mt-1 break-words text-sm text-muted-foreground">{providenceNumber} · {documentType}{documentDate ? ` · ${documentDate}` : ""}</p>
        <p className="mt-1 break-all text-xs text-muted-foreground">Archivo: {originalName || "Documento PDF"}</p>
      </div>
      {originalUrl ? (
        <>
          <SecurePdfPreview url={originalUrl} title={`PDF original ${providenceNumber}`} className="h-[min(780px,75vh)]" />
          <div className="flex flex-wrap gap-2 border-t bg-white p-4 no-print">
            <Button asChild variant="outline"><a href={originalUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Abrir PDF en nueva pestaña</a></Button>
            {downloadUrl && <Button asChild variant="outline"><a href={downloadUrl}><Download className="size-4" /> Descargar PDF original</a></Button>}
            {combinedUrl && <Button asChild><a href={combinedUrl} target="_blank" rel="noreferrer"><FileText className="size-4" /> PDF formal con firmas</a></Button>}
          </div>
        </>
      ) : (
        <div className="grid min-h-72 place-items-center p-8 text-center text-sm text-muted-foreground">No se pudo previsualizar el PDF porque el archivo no está disponible.</div>
      )}
    </section>
  );
}
