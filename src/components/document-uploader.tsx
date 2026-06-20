"use client";
/* eslint-disable @next/next/no-img-element -- blob: previews are local ephemeral URLs and cannot use the Next image optimizer. */

import { useEffect, useRef, useState } from "react";
import { FileText, FileUp, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type LocalPreview = { file: File; url: string };
export function DocumentUploader({ name = "attachments", multiple = true, required = false, accept = ".pdf,.docx,.png,.jpg,.jpeg", label = "Adjuntar documento", hint = "PDF, DOCX, PNG o JPG · máximo 20 MB por archivo" }: { name?: string; multiple?: boolean; required?: boolean; accept?: string; label?: string; hint?: string }) {
  const [previews, setPreviews] = useState<LocalPreview[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { previews.forEach((preview) => URL.revokeObjectURL(preview.url)); }, [previews]);
  function selectFiles(files: FileList | null) { previews.forEach((preview) => URL.revokeObjectURL(preview.url)); setPreviews(files ? Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) })) : []); }
  function removeFile(target: LocalPreview) { URL.revokeObjectURL(target.url); const remaining = previews.filter((item) => item !== target); const transfer = new DataTransfer(); remaining.forEach((item) => transfer.items.add(item.file)); if (inputRef.current) inputRef.current.files = transfer.files; setPreviews(remaining); }
  return <div className="space-y-4"><label className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed p-8 text-center hover:bg-slate-50"><FileUp className="size-7 text-[#416786]" /><span className="mt-3 text-sm font-semibold text-[#153553]">{label}</span><span className="mt-1 text-xs text-muted-foreground">{hint}</span><Input ref={inputRef} name={name} type="file" accept={accept} multiple={multiple} required={required} className="mt-4 max-w-sm" onChange={(event) => selectFiles(event.target.files)} /></label>{previews.length > 0 && <div className="grid gap-3 md:grid-cols-2">{previews.map((preview) => <article key={`${preview.file.name}-${preview.file.lastModified}`} className="overflow-hidden rounded border bg-white"><LocalDocumentPreview preview={preview} /><div className="flex items-center justify-between gap-3 border-t p-3"><div className="min-w-0"><p className="truncate text-xs font-semibold">{preview.file.name}</p><p className="text-[11px] text-muted-foreground">{formatBytes(preview.file.size)}</p></div><Button type="button" size="icon" variant="ghost" aria-label={`Quitar ${preview.file.name}`} onClick={() => removeFile(preview)}><X className="size-4" /></Button></div></article>)}</div>}</div>;
}
function LocalDocumentPreview({ preview }: { preview: LocalPreview }) { if (preview.file.type === "application/pdf") return <iframe title={`Vista previa de ${preview.file.name}`} src={preview.url} className="h-64 w-full bg-slate-50" />; if (preview.file.type.startsWith("image/")) return <div className="grid h-64 place-items-center bg-slate-50 p-3"><img src={preview.url} alt={`Vista previa de ${preview.file.name}`} className="max-h-full max-w-full object-contain" /></div>; return <div className="grid h-40 place-items-center bg-slate-50 text-slate-500"><FileText className="size-10" /></div>; }
export function formatBytes(value: number | null | undefined) { if (!value) return "Tamaño no disponible"; if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB`; }
