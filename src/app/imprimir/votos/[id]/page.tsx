import Image from "next/image";
import { notFound } from "next/navigation";
import { CorteSupremaLogo } from "@/components/corte-suprema-logo";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintDocumentShell } from "@/components/print-document-shell";
import { PrintOnLoad } from "@/components/print-on-load";
import { requirePermission } from "@/lib/auth/permissions";
import { signatureImageDataUrl } from "@/lib/signature-images";

export default async function PrintVote({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { supabase }] = await Promise.all([params, requirePermission({ resource: "votos", action: "print" })]);
  const [{ data: vote }, { data: signatureRows }] = await Promise.all([
    supabase.from("vote_documents").select("*,author:profiles!vote_documents_author_id_fkey(full_name,position_title),proceeding:proceedings(providence_number,title,chamber)").eq("id", id).maybeSingle(),
    supabase.from("signatures").select("id,signer_name,signer_title,signature_image_path,signed_at,verification_code").eq("target_type", "vote_document").eq("target_id", id).eq("status", "signed").order("signature_order"),
  ]);
  if (!vote) notFound();
  const signatures = await Promise.all((signatureRows ?? []).map(async (item) => ({ ...item, imageUrl: await signatureImageDataUrl(supabase, item.signature_image_path) })));
  const author = Array.isArray(vote.author) ? vote.author[0] : vote.author;
  return <PrintDocumentShell><PrintOnLoad /><article className="print-document judicial-document mx-auto max-w-[210mm] bg-white px-[22mm] py-[18mm]">
    <header className="text-center">{vote.institution_style === "corte_suprema" ? <CorteSupremaLogo className="mx-auto mb-4 h-24 w-auto" /> : <Image src="/escudo-institucional.png" alt="Escudo institucional" width={72} height={72} className="mx-auto mb-4 h-16 w-auto object-contain" />}<p className="font-bold">{vote.institution_style === "corte_suprema" ? "CORTE SUPREMA DE JUSTICIA" : "TRIBUNAL SUPERIOR"}</p><p className="mt-1 text-sm">{Array.isArray(vote.proceeding) ? vote.proceeding[0]?.chamber : vote.proceeding?.chamber}</p><h1 className="mt-8 text-lg font-bold uppercase">{vote.vote_type}</h1><p className="mt-2 text-sm">{author?.full_name ?? "Magistratura"}<br />{author?.position_title ?? "Magistrado/a"}</p></header>
    <div className="mt-10"><MarkdownViewer content={vote.content_markdown} variant="document" /></div>
    <section className="mt-16 grid gap-10 sm:grid-cols-2">{signatures.map((signature) => <div key={signature.id} className="text-center">{signature.imageUrl && <Image src={signature.imageUrl} alt={`Firma de ${signature.signer_name}`} width={260} height={100} unoptimized className="mx-auto h-20 w-auto max-w-full object-contain" />}<div className="mx-auto mt-2 w-64 border-t border-black pt-2"><p className="font-bold">{signature.signer_name}</p><p className="text-sm">{signature.signer_title}</p><p className="mt-1 text-xs">{signature.signed_at ? new Intl.DateTimeFormat("es-CO",{dateStyle:"long",timeStyle:"short"}).format(new Date(signature.signed_at)) : ""}</p><p className="text-xs">Verificación: {signature.verification_code}</p></div></div>)}</section>
  </article></PrintDocumentShell>;
}
