"use client";
/* eslint-disable @next/next/no-img-element -- signed Storage URLs expire and should not pass through the image optimizer. */

import { Download, FileText, Trash2 } from "lucide-react";
import { deleteDocument } from "@/app/actions/documents";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/components/document-uploader";

export type SavedDocument = {
  id: string;
  title: string;
  original_name: string | null;
  file_type: string;
  size_bytes: number | null;
  visibility: string;
  created_at: string;
  signedUrl: string | null;
  canDelete: boolean;
};

export function DocumentPreview({ document, caseId }: { document: SavedDocument; caseId: string }) {
  const name = document.original_name ?? document.title;
  return <article className="overflow-hidden rounded-lg border bg-white"><div className="bg-slate-50">{document.signedUrl && document.file_type === "application/pdf" ? <iframe title={`Documento ${name}`} src={document.signedUrl} className="h-80 w-full" sandbox="allow-downloads" /> : document.signedUrl && document.file_type.startsWith("image/") ? <div className="grid h-80 place-items-center p-3"><img src={document.signedUrl} alt={name} className="max-h-full max-w-full object-contain" /></div> : <div className="grid h-44 place-items-center text-slate-500"><FileText className="size-12" /></div>}</div><div className="space-y-3 border-t p-4"><div><p className="truncate text-sm font-semibold text-[#153553]">{name}</p><p className="mt-1 text-xs text-muted-foreground">{document.file_type || "Tipo desconocido"} · {formatBytes(document.size_bytes)} · {document.visibility}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(document.created_at))}</p></div><div className="flex flex-wrap gap-2">{document.signedUrl && <Button asChild size="sm" variant="outline"><a href={document.signedUrl} target="_blank" rel="noreferrer"><Download className="size-4" /> Abrir o descargar</a></Button>}{document.canDelete && <form action={deleteDocument}><input type="hidden" name="document_id" value={document.id} /><input type="hidden" name="case_id" value={caseId} /><ConfirmSubmitButton message={`¿Eliminar definitivamente ${name}?`} variant="destructive" className="h-8"><Trash2 className="size-4" /> Eliminar</ConfirmSubmitButton></form>}</div></div></article>;
}
