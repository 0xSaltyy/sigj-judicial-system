import { notFound } from "next/navigation";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import { SignaturePanel } from "@/components/signature-panel";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function VoteDetail({ params, searchParams }: { params: Promise<{ id: string; voteId: string }>; searchParams: Promise<{ error?: string; success?: string; signingLink?: string }> }) {
  const [{ id, voteId }, query, { supabase, profile }] = await Promise.all([params, searchParams, requirePermission(PERMISSIONS.votesView)]);
  const { data: vote } = await supabase.from("vote_documents").select("*,author:profiles!vote_documents_author_id_fkey(full_name,position_title),proceeding:proceedings(providence_number,title)").eq("id", voteId).eq("proceeding_id", id).maybeSingle();
  if (!vote) notFound();
  const [canVoteSign, canSign, canRequest, canRevoke] = await Promise.all([can(profile,"sign","votos",{supabase}),can(profile,"sign","firmas",{supabase}),can(profile,"request","firmas",{supabase}),can(profile,"revoke","firmas",{supabase})]);
  const author = Array.isArray(vote.author) ? vote.author[0] : vote.author;
  return <><AdminPageHeader title={vote.vote_type} description={`${vote.title} · ${vote.status}`} action={<PrintButton label="Imprimir voto" href={`/imprimir/votos/${vote.id}`} />} /><ActionMessage error={query.error} success={query.success} /><article className="judicial-document rounded-xl border bg-white p-10"><p className="text-center text-sm font-bold">{vote.institution_style === "corte_suprema" ? "CORTE SUPREMA DE JUSTICIA" : "TRIBUNAL SUPERIOR"}</p><h1 className="mt-8 text-center text-lg font-bold uppercase">{vote.vote_type}</h1><p className="mt-2 text-center text-sm">{author?.full_name ?? "Magistratura"}<br />{author?.position_title ?? (vote.institution_style === "corte_suprema" ? "Magistrado/a" : "Magistrado/a disidente")}</p><div className="mt-10"><MarkdownViewer content={vote.content_markdown} variant="document" /></div></article><SignaturePanel caseId={vote.case_id} targetType="vote_document" targetId={vote.id} destination={`/admin/providencias/${id}/votos/${vote.id}`} signingLink={query.signingLink} canRequest={canVoteSign&&canRequest} canRevoke={canVoteSign&&canRevoke} canSign={canVoteSign&&canSign} /></>;
}
