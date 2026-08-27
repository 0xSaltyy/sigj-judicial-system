import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: item } = await supabase.from("cases").select("internal_number,judicial_number,filed_at,chamber,process_type,process_subtype,summary").eq("id", id).maybeSingle();
  if (!item) notFound();
  return <div className="mx-auto max-w-4xl"><div className="mb-5 flex justify-end"><PrintButton label="Imprimir constancia" /></div><article className="paper min-h-[850px] border p-10 sm:p-16"><header className="flex items-center gap-4 border-b-2 border-[#153553] pb-7"><div className="grid size-14 place-items-center rounded border-2 border-[#b38a3c] text-[#153553]"><Scale className="size-7" /></div><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#98712b]">U.S. Department of Justice</p><h1 className="mt-1 text-xl font-bold text-[#102d49]">Constancia de radicación</h1><p className="text-xs text-muted-foreground">Sistema interno de gestión documental</p></div></header><div className="my-10 rounded border-2 border-[#153553] p-6 text-center"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Número interno asignado</p><p className="mono-number mt-3 text-2xl font-bold text-[#102d49]">{item.internal_number}</p><p className="mono-number mt-2 text-sm text-muted-foreground">{item.judicial_number}</p></div><dl className="grid gap-y-5 text-sm sm:grid-cols-[190px_1fr]"><dt className="font-semibold text-slate-500">Fecha de recepción</dt><dd>{formatDate(item.filed_at)}</dd><dt className="font-semibold text-slate-500">Dependencia</dt><dd>{item.chamber}</dd><dt className="font-semibold text-slate-500">Clase de proceso</dt><dd>{item.process_type} · {item.process_subtype}</dd><dt className="font-semibold text-slate-500">Resumen</dt><dd>{item.summary}</dd></dl><div className="mt-12 flex items-end justify-between border-t pt-8"><div className="max-w-sm text-xs leading-5 text-muted-foreground">Constancia generada desde el sistema interno.</div><div className="grid size-24 grid-cols-5 gap-1 bg-[#102d49] p-2" aria-label="Código de verificación visual">{Array.from({ length: 25 }).map((_, i) => <span key={i} className={(i * 7 + 3) % 5 < 2 ? "bg-white" : "bg-[#102d49]"} />)}</div></div></article></div>;
}
