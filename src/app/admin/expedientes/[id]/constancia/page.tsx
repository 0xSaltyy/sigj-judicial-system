import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { requireInternalUser } from "@/lib/auth/authorization";
import { formatDate } from "@/lib/demo-data";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { supabase }] = await Promise.all([params, requireInternalUser()]);
  const { data: caseRecord } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
  if (!caseRecord) notFound();
  return <div className="mx-auto max-w-4xl"><div className="mb-5 flex justify-end"><PrintButton label="Imprimir constancia" /></div><article className="paper min-h-[850px] border p-12"><header className="flex items-center gap-4 border-b-2 pb-7"><Image src="/escudo-institucional.png" alt="Escudo institucional de Colombia" width={72} height={72} className="size-[72px] object-contain" priority /><div><p className="text-xs uppercase tracking-widest">Palacio Judicial</p><h1 className="text-xl font-bold">Constancia de radicación</h1></div></header><div className="my-10 rounded border-2 p-6 text-center"><p className="mono-number text-2xl font-bold">{caseRecord.internal_number}</p><p className="mono-number mt-2 text-sm">{caseRecord.judicial_number}</p></div><dl className="grid gap-5 sm:grid-cols-[180px_1fr]"><dt className="font-semibold">Fecha</dt><dd>{formatDate(caseRecord.filed_at)}</dd><dt className="font-semibold">Dependencia</dt><dd>{caseRecord.chamber}</dd><dt className="font-semibold">Proceso</dt><dd>{caseRecord.process_type} · {caseRecord.process_subtype}</dd><dt className="font-semibold">Resumen</dt><dd>{caseRecord.summary}</dd></dl></article></div>;
}
