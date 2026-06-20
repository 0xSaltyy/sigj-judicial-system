import Image from "next/image";
import { siteUrl } from "@/lib/site-url";

export function JudicialDocumentHeader({ documentType, title, dependency, metadata = [] }: { documentType: string; title?: string; dependency?: string | null; metadata?: Array<{ label: string; value: string | null | undefined }> }) {
  return <header className="judicial-header relative border-b-2 border-[#173b5e] pb-6 text-center"><div className="grid grid-cols-[72px_1fr_72px] items-center gap-4"><Image src="/escudo-institucional.png" alt="Escudo institucional de Colombia" width={72} height={72} className="size-[72px] object-contain" priority /><div><p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#8a6a2c]">República de Colombia</p><p className="mt-1 text-sm font-bold uppercase tracking-wide text-[#153553]">Palacio Judicial</p><p className="mt-1 text-xs text-slate-600">{dependency || "Sistema Integral de Gestión Judicial"}</p></div><div className="size-[72px]" aria-hidden="true" /></div><div className="mt-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-slate-500">{documentType}</p>{title && <h1 className="mt-2 text-xl font-bold uppercase leading-7 text-[#102d49]">{title}</h1>}</div>{metadata.length > 0 && <dl className="judicial-metadata mt-6 grid grid-cols-2 border text-left text-xs sm:grid-cols-4">{metadata.map((item) => <div key={item.label} className="border-b border-r p-3"><dt className="font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt><dd className="mono-number mt-1 font-medium text-slate-900">{item.value || "—"}</dd></div>)}</dl>}</header>;
}

export function JudicialPrintFooter({ verification, verificationPath = "/" }: { verification?: string; verificationPath?: string }) {
  const generatedAt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const verificationUrl = siteUrl(verificationPath);
  return <footer className="judicial-print-footer mt-14 border-t pt-4 text-[10px] leading-4 text-slate-500"><div className="flex justify-between gap-6"><p>{verification || "Documento generado por el Sistema Integral de Gestión Judicial."}<br /><a href={verificationUrl} className="break-all underline underline-offset-2">Verificación: {verificationUrl}</a></p><p className="shrink-0">Generado: {generatedAt}</p></div><p className="print-page-number mt-2 text-right" /></footer>;
}

export function JudicialWatermark() { return <div className="judicial-watermark" aria-hidden="true">SIGJ</div>; }
