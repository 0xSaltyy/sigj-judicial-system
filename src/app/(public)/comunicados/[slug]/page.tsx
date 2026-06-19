import Image from "next/image";
import { notFound } from "next/navigation";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";

export default async function NoticeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: notice } = await supabase.from("public_notices").select("*").eq("slug", slug).eq("status", "Publicado").maybeSingle();
  if (!notice) notFound();
  return <div className="mx-auto max-w-4xl px-4 py-12"><article className="paper rounded-lg border p-10"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-4"><Image src="/escudo-institucional.png" alt="Escudo institucional de Colombia" width={64} height={64} className="size-16 object-contain" /><Badge variant="outline">{notice.category}</Badge></div><PrintButton /></div><h1 className="mt-8 text-3xl font-semibold">{notice.title}</h1><p className="mt-4 border-y py-4 text-sm text-muted-foreground">{notice.issuing_entity} · {formatDate(notice.published_at)}</p><div className="mt-8"><MarkdownViewer content={notice.content_markdown} /></div></article></div>;
}
