import Image from "next/image";
import { notFound } from "next/navigation";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import { createClient } from "@/lib/supabase/server";

export default async function ProceedingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: proceeding } = await supabase.from("public_proceedings").select("*").eq("id", id).maybeSingle();
  if (!proceeding) notFound();
  return <div className="mx-auto max-w-4xl px-4 py-12"><div className="mb-5 flex justify-end"><PrintButton label="Imprimir providencia" /></div><article className="paper min-h-[900px] border p-12"><header className="text-center"><Image src="/escudo-institucional.png" alt="Escudo institucional de Colombia" width={72} height={72} className="mx-auto size-[72px] object-contain" priority /><p className="mt-4 text-xs uppercase tracking-widest">{proceeding.chamber}</p><h1 className="mt-3 text-xl font-bold">{proceeding.title}</h1><p className="mono-number mt-2">{proceeding.providence_number}</p></header><div className="mt-8"><MarkdownViewer content={proceeding.content_markdown} /></div></article></div>;
}
