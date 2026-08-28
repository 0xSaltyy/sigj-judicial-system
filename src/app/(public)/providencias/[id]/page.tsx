import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

type ProceedingDetailRow = { providence_number: string; title: string; type: string; chamber: string; content_markdown: string; created_at: string; cases: { case_number: string | null; internal_number: string } | { case_number: string | null; internal_number: string }[] | null };

export default async function ProceedingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data } = await supabase.from("proceedings").select("providence_number,title,type,chamber,content_markdown,created_at,cases(case_number,internal_number)").eq("id", id).eq("status", "Publicado").eq("visibility", "public").is("archived_at", null).maybeSingle();
  if (!data) notFound();
  const item = data as ProceedingDetailRow;
  const relatedCase = Array.isArray(item.cases) ? item.cases[0] : item.cases;
  return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><div className="mb-5 flex justify-end"><PrintButton label="Print order" /></div><article className="paper min-h-[1000px] border px-8 py-12 sm:px-16"><header className="border-b-2 border-[#153553] pb-7 text-center"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#98712b]">U.S. Department of Justice</p><h1 className="mt-3 font-serif text-xl font-bold uppercase text-[#102d49]">{item.title}</h1><p className="mono-number mt-2 text-sm">{item.providence_number}</p></header><dl className="my-8 grid gap-2 text-sm sm:grid-cols-[160px_1fr]"><dt className="font-semibold">Case Number</dt><dd className="mono-number">{relatedCase?.case_number || relatedCase?.internal_number}</dd><dt className="font-semibold">Court / office</dt><dd>{item.chamber}</dd><dt className="font-semibold">Date</dt><dd>{formatDate(item.created_at)}</dd></dl><div className="whitespace-pre-wrap text-justify text-sm leading-7 text-slate-800">{item.content_markdown}</div></article></div>;
}
