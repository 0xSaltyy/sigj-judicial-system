import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/print-button";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

export default async function NoticeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: item } = await supabase.from("public_notices").select("title,category,issuing_entity,content_markdown,published_at").eq("slug", slug).eq("status", "Publicado").is("archived_at", null).maybeSingle();
  if (!item) notFound();
  return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16"><article className="border bg-white p-7 sm:p-12"><div className="flex flex-wrap items-center justify-between gap-4"><Badge variant="outline" className="rounded-none border-[#b21b1b] bg-white text-[#b21b1b]">{item.category}</Badge><PrintButton /></div><h1 className="mt-8 font-serif text-3xl font-semibold leading-tight text-[#102d49] sm:text-4xl">{item.title}</h1><div className="mt-5 border-y py-4 text-sm text-muted-foreground">{item.issuing_entity} · {formatDate(item.published_at)}</div><div className="mt-8 whitespace-pre-wrap text-[15px] leading-8 text-slate-700">{item.content_markdown}</div></article></div>;
}
