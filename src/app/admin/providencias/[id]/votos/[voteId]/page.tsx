import Link from "next/link";
import { notFound } from "next/navigation";
import { manageVoteDocument } from "@/app/actions/sala";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import { SignaturePanel } from "@/components/signature-panel";
import { Button } from "@/components/ui/button";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";

export default async function VoteDetail({ params, searchParams }: { params: Promise<{ id: string; voteId: string }>; searchParams: Promise<{ error?: string; success?: string; signingLink?: string }> }) {
  const [{ id, voteId }, query, session] = await Promise.all([params, searchParams, requirePermission(PERMISSIONS.votesView)]);
  const { supabase, profile, user } = session;
  const { data: vote } = await supabase.from("vote_documents").select("*,author:profiles!vote_documents_author_id_fkey(full_name,position_title),proceeding:proceedings(providence_number,title)").eq("id", voteId).eq("proceeding_id", id).maybeSingle();
  if (!vote) notFound();
  const [canVoteSign, canSign, canRequest, canRevoke, canEdit, canPublish, canArchive] = await Promise.all([
    can(profile,"sign","votos",{supabase}), can(profile,"sign","firmas",{supabase}), can(profile,"request","firmas",{supabase}), can(profile,"revoke","firmas",{supabase}), can(profile,"edit","votos",{supabase}), can(profile,"publish","votos",{supabase}), can(profile,"archive","votos",{supabase}),
  ]);
  const author = Array.isArray(vote.author) ? vote.author[0] : vote.author;
  const authorName = vote.author_display_name || author?.full_name || "Magistratura";
  const authorCargo = vote.author_cargo || author?.position_title || "Magistrado/a";
  const isAuthor = vote.author_id === user.id;
  const maySign = (isAuthor || profile.is_owner) && canVoteSign;
  return <>
    <AdminPageHeader title={`Documento del voto particular · ${vote.vote_type}`} description={`${vote.title} · ${vote.status}`} action={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/admin/providencias/${id}`}>Volver a la providencia</Link></Button>{vote.status === "Borrador" && canEdit && (isAuthor || profile.is_owner) && <Button asChild variant="outline"><Link href={`/admin/providencias/${id}/votos/${vote.id}/editar`}>Editar voto particular</Link></Button>}<PrintButton label="Imprimir voto particular" href={`/imprimir/votos/${vote.id}`} /></div>} />
    <ActionMessage error={query.error} success={query.success} />
    <article className="judicial-document rounded-xl border bg-white p-10"><p className="text-center text-sm font-bold">{vote.institution_style === "corte_suprema" ? "CORTE SUPREMA DE JUSTICIA" : "TRIBUNAL SUPERIOR DE JUSTICIA"}</p><h1 className="mt-8 text-center text-lg font-bold uppercase">{vote.vote_type}</h1><p className="mt-2 text-center text-sm">{authorName}<br />{authorCargo}</p><div className="mt-10"><MarkdownViewer content={vote.content_markdown} variant="document" /></div></article>
    {vote.status !== "Borrador" && vote.status !== "Archivado" && <SignaturePanel caseId={vote.case_id} targetType="vote_document" targetId={vote.id} destination={`/admin/providencias/${id}/votos/${vote.id}`} signingLink={query.signingLink} canRequest={maySign&&canRequest} canRevoke={maySign&&canRevoke} canSign={maySign&&canSign} />}
    <div className="no-print mt-4 flex flex-wrap gap-2">
      {vote.status === "Firmado" && canPublish && <form action={manageVoteDocument}><Hidden vote={vote}/><input type="hidden" name="operation" value="publish"/><ConfirmSubmitButton message="¿Publicar este voto particular firmado?">Publicar voto particular</ConfirmSubmitButton></form>}
      {vote.status !== "Archivado" && canArchive && <form action={manageVoteDocument}><Hidden vote={vote}/><input type="hidden" name="operation" value="archive"/><ConfirmSubmitButton variant="outline" message="¿Archivar este voto particular?">Archivar voto particular</ConfirmSubmitButton></form>}
      {["Firmado","Publicado"].includes(vote.status) && profile.is_owner && <form action={manageVoteDocument}><Hidden vote={vote}/><input type="hidden" name="operation" value="reopen"/><input type="hidden" name="reason" value="Corrección autorizada por el propietario"/><ConfirmSubmitButton variant="outline" message="¿Reabrir el documento? La firma vigente será revocada y la acción quedará auditada.">Reabrir para corrección</ConfirmSubmitButton></form>}
    </div>
  </>;
}

function Hidden({ vote }: { vote: { id: string; case_id: string; proceeding_id: string } }) { return <><input type="hidden" name="vote_id" value={vote.id}/><input type="hidden" name="case_id" value={vote.case_id}/><input type="hidden" name="proceeding_id" value={vote.proceeding_id}/></>; }
