import { notFound } from "next/navigation";
import { JudicialDocumentHeader, JudicialPrintFooter, JudicialWatermark } from "@/components/judicial-document";
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
  return <div className="mx-auto max-w-4xl px-4 py-12"><div className="mb-5 flex justify-end no-print"><PrintButton label="Imprimir estado" /></div><article className="paper judicial-document border p-10"><JudicialWatermark /><JudicialDocumentHeader documentType="Estado judicial" title={state.state_number} dependency={state.institution_name} metadata={[{ label: "Número", value: state.state_number }, { label: "Fecha", value: state.state_date }, { label: "Dependencia", value: state.institution_name }, { label: "Actuaciones", value: String(state.item_count ?? items?.length ?? 0) }]} /><div className="mt-8"><table><thead><tr className="border-b-2 text-left text-xs uppercase"><th className="w-14 p-3">N.º</th><th className="p-3">Actuación publicada</th></tr></thead><tbody>{(items ?? []).map((item, index) => <tr key={item.id} className="border-b align-top text-sm"><td className="mono-number p-3">{index + 1}</td><td className="p-3">{item.description}</td></tr>)}</tbody></table></div><JudicialPrintFooter verification={`Estado público ${state.state_number}.`} /></article></div>;
}
