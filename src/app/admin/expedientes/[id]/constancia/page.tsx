import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { cases, formatDate } from "@/lib/demo-data";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = cases.find((entry) => entry.id === id) ?? cases[0];
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex justify-end"><PrintButton label="Imprimir constancia" /></div>
      <article className="paper min-h-[850px] border p-10 sm:p-16">
        <header className="flex items-center gap-4 border-b-2 border-[#153553] pb-7">
          <div className="relative size-[72px] shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white p-1">
            <Image src="/sigj-emblem.svg" alt="Emblema ficticio SIGJ" fill sizes="72px" className="object-contain p-1" priority />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#98712b]">República Judicial</p>
            <h1 className="mt-1 text-xl font-bold text-[#102d49]">Constancia de radicación</h1>
            <p className="text-xs text-muted-foreground">Sistema Integral de Gestión Judicial — SIGJ</p>
          </div>
        </header>
        <div className="my-10 rounded border-2 border-[#153553] p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Número interno asignado</p>
          <p className="mono-number mt-3 text-2xl font-bold text-[#102d49]">{item.internalNumber}</p>
          <p className="mono-number mt-2 text-sm text-muted-foreground">{item.judicialNumber}</p>
        </div>
        <dl className="grid gap-y-5 text-sm sm:grid-cols-[190px_1fr]">
          <dt className="font-semibold text-slate-500">Fecha de recepción</dt><dd>{formatDate(item.filedAt)} · 09:42</dd>
          <dt className="font-semibold text-slate-500">Dependencia</dt><dd>{item.court}</dd>
          <dt className="font-semibold text-slate-500">Clase de proceso</dt><dd>{item.processType} · {item.processSubtype}</dd>
          <dt className="font-semibold text-slate-500">Recibido por</dt><dd>Operador de demostración · Secretaría General</dd>
          <dt className="font-semibold text-slate-500">Resumen</dt><dd>{item.summary}</dd>
        </dl>
        <div className="mt-12 flex items-end justify-between border-t pt-8">
          <p className="max-w-sm text-xs leading-5 text-muted-foreground">Esta constancia acredita únicamente una operación dentro de una plataforma académica ficticia y no produce efectos jurídicos.</p>
          <div className="grid size-24 grid-cols-5 gap-1 bg-[#102d49] p-2" aria-label="Código QR simulado">
            {Array.from({ length: 25 }).map((_, index) => <span key={index} className={(index * 7 + 3) % 5 < 2 ? "bg-white" : "bg-[#102d49]"} />)}
          </div>
        </div>
      </article>
    </div>
  );
}
