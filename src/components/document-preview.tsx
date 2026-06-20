"use client";
/* eslint-disable @next/next/no-img-element -- signed Storage URLs expire and should not pass through the image optimizer. */

import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/components/document-uploader";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { DocumentShareButton } from "@/components/document-share-button";

export type SavedDocument = {
  id: string;
  title: string;
  original_name: string | null;
  file_type: string;
  size_bytes: number | null;
  visibility: string;
  created_at: string;
  signedUrl: string | null;
  archived_at: string | null;
  canArchive: boolean;
  canRestore: boolean;
  canHardDelete: boolean;
  canShare: boolean;
};

export function DocumentPreview({ document, caseId }: { document: SavedDocument; caseId: string }) {
  const name = document.original_name ?? document.title;
  return <article className={`overflow-hidden rounded-lg border bg-white ${document.archived_at ? "opacity-75" : ""}`}><div className="bg-slate-50">{document.signedUrl && document.file_type === "application/pdf" ? <iframe title={`Documento ${name}`} src={document.signedUrl} className="h-80 w-full" sandbox="allow-downloads" /> : document.signedUrl && document.file_type.startsWith("image/") ? <div className="grid h-80 place-items-center p-3"><img src={document.signedUrl} alt={name} className="max-h-full max-w-full object-contain" /></div> : <div className="grid h-44 place-items-center text-slate-500"><FileText className="size-12" /></div>}</div><div className="space-y-3 border-t p-4"><div><p className="truncate text-sm font-semibold text-[#153553]">{name}</p><p className="mt-1 text-xs text-muted-foreground">{document.file_type || "Tipo desconocido"} · {formatBytes(document.size_bytes)} · {document.visibility}{document.archived_at ? " · Archivado" : ""}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(document.created_at))}</p></div><div className="flex flex-wrap gap-2">{document.signedUrl && <Button asChild size="sm" variant="outline"><a href={document.signedUrl} target="_blank" rel="noreferrer"><Download className="size-4" /> Abrir o descargar</a></Button>}{!document.archived_at && document.canShare && <DocumentShareButton documentId={document.id} />}{!document.archived_at && !document.canShare && <Button size="sm" variant="outline" disabled title="No tiene permiso para compartir documentos">Compartir</Button>}<LifecycleActions resource="documents" recordId={document.id} recordLabel={name} destination={`/admin/expedientes/${caseId}`} archived={Boolean(document.archived_at)} canArchive={document.canArchive} canRestore={document.canRestore} canHardDelete={document.canHardDelete} compact /></div></div></article>;
}
