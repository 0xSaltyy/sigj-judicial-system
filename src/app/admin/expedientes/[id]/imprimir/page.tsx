import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { requireInternalUser } from "@/lib/auth/authorization";

export default async function CasePrint({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { supabase }] = await Promise.all([params, requireInternalUser()]);
  const [{ data: caseRecord }, { data: actions }, { data: hearings }, { data: proceedings }, { data: documents }] = await Promise.all([
    supabase.from("cases").select("*").eq("id", id).maybeSingle(),
    supabase.from("case_actions").select("*").eq("case_id", id),
    supabase.from("hearings").select("*").eq("case_id", id),
    supabase.from("proceedings").select("*").eq("case_id", id),
    supabase.from("documents").select("title,file_type,created_at").eq("case_id", id),
  ]);
  if (!caseRecord) notFound();
  return <div className="mx-auto max-w-5xl"><div className="mb-5 flex justify-end"><PrintButton label="Imprimir / guardar PDF" /></div><article className="paper border p-10"><header className="flex items-center gap-4 border-b-2 pb-6"><Image src="/escudo-institucional.png" alt="Escudo institucional de Colombia" width={72} height={72} className="size-[72px] object-contain" priority /><div><h1 className="text-xl font-bold">Expediente {caseRecord.internal_number}</h1><p className="mono-number text-sm">{caseRecord.judicial_number}</p></div></header><section className="mt-8"><h2 className="font-bold">Datos generales</h2><p className="mt-3 text-sm">{caseRecord.authority_type} · {caseRecord.chamber} · {caseRecord.process_type} · {caseRecord.status}</p><p className="mt-3 text-sm"><b>Partes:</b> {caseRecord.claimant_name} / {caseRecord.defendant_name}</p><p className="mt-3 text-sm">{caseRecord.summary}</p></section><PrintList title="Actuaciones" items={(actions ?? []).map((action) => `${action.action_date} · ${action.title}: ${action.description}`)} /><PrintList title="Audiencias" items={(hearings ?? []).map((hearing) => `${hearing.scheduled_at} · ${hearing.title} · ${hearing.status}`)} /><PrintList title="Providencias" items={(proceedings ?? []).map((proceeding) => `${proceeding.providence_number} · ${proceeding.title} · ${proceeding.status}`)} /><PrintList title="Documentos" items={(documents ?? []).map((document) => `${document.title} · ${document.file_type}`)} /></article></div>;
}
function PrintList({ title, items }: { title: string; items: string[] }) { return <section className="mt-8"><h2 className="font-bold">{title}</h2>{items.length ? items.map((item) => <p key={item} className="mt-2 border-b pb-2 text-sm">{item}</p>) : <p className="mt-2 text-sm text-muted-foreground">Sin registros.</p>}</section>; }
