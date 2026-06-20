import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  JudicialDocumentHeader,
  JudicialPrintFooter,
  JudicialWatermark,
} from "@/components/judicial-document";
import { PrintDocumentShell } from "@/components/print-document-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Estado judicial",
  robots: { index: false, follow: false },
};

export default async function JudicialStatePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: internalState } = user
    ? await supabase
        .from("judicial_states")
        .select("id,state_number,state_date,published_at,status,dependency:dependencies(name)")
        .eq("id", id)
        .maybeSingle()
    : { data: null };
  const { data: publicState } = internalState
    ? { data: null }
    : await supabase.from("public_states").select("*").eq("id", id).maybeSingle();
  const state = internalState
    ? {
        ...internalState,
        institution_name: internalState.dependency?.[0]?.name,
        item_count: null,
      }
    : publicState;
  const { data: items } = await supabase
    .from("judicial_state_items")
    .select("id,description,case:cases(internal_number,judicial_number)")
    .eq("judicial_state_id", id);
  if (!state) notFound();

  return (
    <PrintDocumentShell>
      <article className="print-document paper judicial-document border p-10">
        <JudicialWatermark />
        <JudicialDocumentHeader
          documentType="Estado judicial"
          title={state.state_number}
          dependency={state.institution_name}
          metadata={[
            { label: "Número", value: state.state_number },
            { label: "Fecha", value: state.state_date },
            { label: "Dependencia", value: state.institution_name },
            { label: "Actuaciones", value: String(state.item_count ?? items?.length ?? 0) },
          ]}
        />
        <div className="mt-8">
          <table>
            <thead><tr className="border-b-2 text-left text-xs uppercase"><th className="w-14 p-3">N.º</th><th className="p-3">Actuación publicada</th></tr></thead>
            <tbody>{(items ?? []).map((item, index) => <tr key={item.id} className="border-b align-top text-sm"><td className="mono-number p-3">{index + 1}</td><td className="p-3">{item.description}</td></tr>)}</tbody>
          </table>
        </div>
        <JudicialPrintFooter verificationPath={`/estados/${id}`} verification={`Estado público ${state.state_number}.`} />
      </article>
    </PrintDocumentShell>
  );
}
