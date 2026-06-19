import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { createClient } from "@/lib/supabase/server";

export default async function StatePrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [{ data: state }, { data: items }] = await Promise.all([
    supabase.from("public_states").select("*").eq("id", id).maybeSingle(),
    supabase.from("judicial_state_items").select("id,description,case:cases(internal_number,judicial_number)").eq("judicial_state_id", id),
  ]);
  if (!state) notFound();
  return <div className="mx-auto max-w-4xl px-4 py-12"><div className="mb-5 flex justify-end"><PrintButton label="Imprimir estado" /></div><article className="paper border p-10"><header className="text-center"><Image src="/escudo-institucional.png" alt="Escudo institucional de Colombia" width={72} height={72} className="mx-auto size-[72px] object-contain" /><h1 className="mt-4 text-xl font-bold">ESTADO JUDICIAL</h1><p className="mono-number mt-3">{state.state_number}</p><p className="mt-2 text-sm">{state.institution_name} · {state.state_date}</p></header><div className="mt-8 space-y-3">{(items ?? []).map((item) => <div key={item.id} className="border p-4 text-sm"><p>{item.description}</p></div>)}</div></article></div>;
}
