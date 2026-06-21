"use client";
/* eslint-disable @next/next/no-img-element -- authenticated file routes redirect to short-lived signed URLs. */

import { useState } from "react";
import { Download, Eye, FileText } from "lucide-react";
import { DocumentShareButton } from "@/components/document-share-button";
import { formatBytes } from "@/components/document-uploader";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { Button } from "@/components/ui/button";
import { SecurePdfPreview } from "@/components/secure-pdf-preview";

export type SavedDocument = {
  id: string;
  title: string;
  original_name: string | null;
  file_type: string;
  size_bytes: number | null;
  visibility: string;
  created_at: string;
  document_type: string | null;
  document_date: string | null;
  description: string | null;
  folios: number | null;
  source: string | null;
  uploaded_by_name: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  archived_at: string | null;
  canArchive: boolean;
  canRestore: boolean;
  canHardDelete: boolean;
  canShare: boolean;
};

const visibilityLabels: Record<string, string> = {
  public: "Público",
  internal: "Interno",
  reserved: "Reservado",
};

function FileFallback({ message = "No se pudo previsualizar. Abrir/descargar archivo." }: { message?: string }) {
  return (
    <div className="grid h-44 place-items-center p-5 text-center text-slate-500">
      <div><FileText className="mx-auto size-11" /><p className="mt-3 text-xs">{message}</p></div>
    </div>
  );
}

export function DocumentPreview({ document, caseId }: { document: SavedDocument; caseId: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const name = document.original_name ?? document.title;
  const formattedDate = document.document_date
    ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${document.document_date}T00:00:00Z`))
    : null;
  const uploadedAt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(document.created_at));

  return (
    <article className={`app-card-enter min-w-0 overflow-hidden rounded-lg border bg-white ${document.archived_at ? "opacity-75" : ""}`}>
      <div className="bg-slate-50">
        {document.previewUrl && document.file_type === "application/pdf" ? (
          <SecurePdfPreview url={document.previewUrl} title={`Vista previa de ${name}`} className="h-80" />
        ) : document.previewUrl && document.file_type.startsWith("image/") && !imageFailed ? (
          <div className="grid h-80 place-items-center p-3">
            <img src={document.previewUrl} alt={name} className="max-h-full max-w-full object-contain" onError={() => setImageFailed(true)} />
          </div>
        ) : (
          <FileFallback />
        )}
      </div>
      <div className="space-y-3 border-t p-4">
        <div>
          <p className="break-words text-sm font-semibold text-[#153553]">{document.title}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {document.document_type || "Documento"} · {formatBytes(document.size_bytes)} · {visibilityLabels[document.visibility] ?? document.visibility}{document.archived_at ? " · Archivado" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cargado el {uploadedAt}{document.uploaded_by_name ? ` por ${document.uploaded_by_name}` : ""}
          </p>
          {formattedDate && <p className="mt-1 text-xs text-muted-foreground">Fecha del documento: {formattedDate}</p>}
          {(document.folios || document.source) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {document.folios ? `${document.folios} folio${document.folios === 1 ? "" : "s"}` : ""}{document.folios && document.source ? " · " : ""}{document.source ? `Origen: ${document.source}` : ""}
            </p>
          )}
          {document.description && <p className="mt-2 break-words text-sm leading-relaxed text-slate-700">{document.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {document.previewUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={document.previewUrl} target="_blank" rel="noreferrer"><Eye className="size-4" /> Vista previa</a>
            </Button>
          )}
          {document.downloadUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={document.downloadUrl}><Download className="size-4" /> Descargar</a>
            </Button>
          )}
          {!document.archived_at && document.canShare && <DocumentShareButton documentId={document.id} />}
          {!document.archived_at && !document.canShare && <Button size="sm" variant="outline" disabled title="No tiene permiso para compartir documentos">Compartir</Button>}
          <LifecycleActions
            resource="documents"
            recordId={document.id}
            recordLabel={name}
            destination={`/admin/expedientes/${caseId}`}
            archived={Boolean(document.archived_at)}
            canArchive={document.canArchive}
            canRestore={document.canRestore}
            canHardDelete={document.canHardDelete}
            compact
          />
        </div>
      </div>
    </article>
  );
}
