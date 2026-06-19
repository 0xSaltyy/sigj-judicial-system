import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { proceedings } from "@/lib/demo-data";

export default async function ProceedingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = proceedings.find((entry) => entry.id === id);
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-5 flex justify-end"><PrintButton label="Imprimir providencia" /></div>
      <article className="paper min-h-[1000px] border px-8 py-12 sm:px-16">
        <header className="border-b-2 border-[#153553] pb-7 text-center">
          <div className="relative mx-auto mb-4 size-[72px] overflow-hidden rounded-md border border-slate-200 bg-white p-1">
            <Image src="/escudo-institucional.png" alt="Emblema institucional SIGJ" fill sizes="72px" className="object-contain p-1" priority />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#98712b]">Tribunal Superior de Justicia</p>
          <h1 className="mt-3 text-xl font-bold uppercase text-[#102d49]">{item.title}</h1>
          <p className="mono-number mt-2 text-sm">{item.number}</p>
        </header>
        <dl className="my-8 grid gap-2 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="font-semibold">Radicado</dt><dd className="mono-number">{item.caseNumber}</dd>
          <dt className="font-semibold">Sala</dt><dd>{item.chamber}</dd>
          <dt className="font-semibold">Magistratura</dt><dd>{item.judge}</dd>
        </dl>
        <div className="space-y-7 text-justify text-sm leading-7 text-slate-800">
          <section><h2 className="font-bold uppercase">I. Antecedentes</h2><p className="mt-2">La Sala examina el asunto ficticio identificado en la referencia, remitido para el trámite procesal correspondiente dentro de esta demostración académica.</p></section>
          <section><h2 className="font-bold uppercase">II. Consideraciones</h2><p className="mt-2">Verificada la competencia simulada y la oportunidad de la actuación, se advierte que concurren los presupuestos para continuar con el trámite. Ninguna mención de este documento corresponde a personas o procesos reales.</p></section>
          <section><h2 className="font-bold uppercase">III. Resuelve</h2><p className="mt-2"><strong>PRIMERO.</strong> DISPONER la continuación del trámite en los términos expuestos.</p><p><strong>SEGUNDO.</strong> Por Secretaría, comuníquese esta decisión demostrativa.</p></section>
          <p className="pt-8 text-center font-semibold">Notifíquese y cúmplase.</p>
          <div className="mx-auto mt-16 w-64 border-t pt-2 text-center text-xs"><p className="font-semibold">Firma electrónica simulada</p><p className="text-muted-foreground">{item.judge}</p></div>
        </div>
        <footer className="mt-20 border-t pt-4 text-center text-[10px] text-muted-foreground">Documento ficticio · No produce efectos jurídicos · SIGJ 2026</footer>
      </article>
    </div>
  );
}
