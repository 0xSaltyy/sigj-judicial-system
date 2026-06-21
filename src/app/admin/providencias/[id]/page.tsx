import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Gavel, PenLine, Scale } from "lucide-react";
import { publishProceeding } from "@/app/actions/proceedings";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ClearDrafts } from "@/components/clear-drafts";
import { FormalProvidenceDocument } from "@/components/formal-providence-document";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { PrintButton } from "@/components/print-button";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ShareAccessForm } from "@/components/share-access-form";
import {
  SignaturePanel,
} from "@/components/signature-panel";
import { Button } from "@/components/ui/button";
import { can, requirePermission } from "@/lib/auth/permissions";
import { signatureImageDataUrl } from "@/lib/signature-images";
import { proceedingDetailRealtime } from "@/lib/realtime-subscriptions";
import { inferTemplateStyle } from "@/lib/document-templates";

export default async function ProceedingDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
    signingLink?: string;
  }>;
}) {
  const [{ id }, query, { supabase, profile }] = await Promise.all([
    params,
    searchParams,
    requirePermission({ resource: "providencias", action: "view" }),
  ]);
  const [{ data: proceeding }, { data: dependencies }, { data: users }] =
    await Promise.all([
      supabase
        .from("proceedings")
        .select(
          "*,case:cases(internal_number,judicial_number,authority_type,chamber,claimant_name,defendant_name,municipality,confidentiality_level,dependency:dependencies(name))",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("dependencies")
        .select("id,name")
        .eq("is_active", true)
        .order("name"),
      profile.is_owner
        ? supabase
            .from("profiles")
            .select("id,full_name")
            .eq("is_active", true)
            .neq("role", "CONSULTA_PUBLICA")
            .order("full_name")
        : Promise.resolve({ data: [] }),
    ]);
  if (!proceeding) notFound();
  const [canWrite, canPublish, canShare, canProvidenceSign, canSign, canRequestSignatures, canRevokeSignatures, canPrint, canArchive, canRestore, canHardDelete] = await Promise.all([
    can(profile, "edit", "providencias", { supabase }),
    can(profile, "publish", "providencias", { supabase }),
    can(profile, "share", "providencias", { supabase }),
    can(profile, "sign", "providencias", { supabase }),
    can(profile, "sign", "firmas", { supabase }),
    can(profile, "request", "firmas", { supabase }),
    can(profile, "revoke", "firmas", { supabase }),
    can(profile, "print", "providencias", { supabase }),
    can(profile, "archive", "providencias", { supabase }),
    can(profile, "restore", "providencias", { supabase }),
    can(profile, "hard_delete", "providencias", { supabase }),
  ]);
  const caseRecord = Array.isArray(proceeding.case)
    ? proceeding.case[0]
    : proceeding.case;
  const dependency = Array.isArray(caseRecord?.dependency) ? caseRecord.dependency[0] : caseRecord?.dependency;
  const institutionStyle = inferTemplateStyle([proceeding.template_style, proceeding.chamber, dependency?.name, caseRecord?.authority_type]);
  const collegiate = institutionStyle === "corte_suprema" || institutionStyle === "tribunal_superior";
  const [{ data: votes }, canViewVotes, canCreateVotes, canViewSala] = await Promise.all([
    collegiate ? supabase.from("vote_documents").select("id,vote_type,title,status,author_id,created_at,author:profiles!vote_documents_author_id_fkey(full_name,position_title)").eq("proceeding_id", id).order("created_at") : Promise.resolve({ data: [] }),
    can(profile, "view", "votos", { supabase }),
    can(profile, "create", "votos", { supabase }),
    can(profile, "view", "sala", { supabase }),
  ]);
  const formalCaseRecord = { ...caseRecord, dependency_name: dependency?.name || null };
  const originalPdfUrl = proceeding.pdf_path && canPrint ? `/api/providencias/${id}/pdf?variant=original` : null;
  const combinedPdfUrl = proceeding.pdf_path && canPrint ? `/api/providencias/${id}/pdf` : null;
  const canUseSignatures = canProvidenceSign && (canSign || canRequestSignatures || canRevokeSignatures);
  const { data: signatureRows } = await supabase
    .from("signatures")
    .select(
      "id,signer_name,signer_title,signature_image_path,purpose,signed_at,verification_code",
    )
    .eq("target_type", "proceeding")
    .eq("target_id", id)
    .eq("status", "signed")
    .order("signature_order");
  const signatures = await Promise.all(
    (signatureRows ?? []).map(async (s) => ({
      ...s,
      imageUrl: await signatureImageDataUrl(supabase, s.signature_image_path),
    })),
  );
  return (
    <>
      <RealtimeRefresh
        channel={`admin-proceeding-${id}`}
        subscriptions={proceedingDetailRealtime(id, proceeding.case_id)}
      />
      {query.success && <ClearDrafts storageKeys={["sigj:proceeding:new", `sigj:proceeding:${id}`]} />}
      <AdminPageHeader
        title={proceeding.providence_number}
        description={`${proceeding.type} · ${proceeding.status} · ${proceeding.creation_mode === "pdf" ? "PDF" : proceeding.creation_mode === "mixed" ? "Mixta" : "Editor"}`}
        action={
          <div className="flex flex-wrap gap-2">
            {canWrite &&
              !proceeding.archived_at &&
              ["Borrador", "En revisión"].includes(proceeding.status) && (
                <Button asChild variant="outline">
                  <Link href={`/admin/providencias/${id}/editar`}>
                    Editar borrador
                  </Link>
                </Button>
              )}
            {canUseSignatures ? <Button asChild variant="outline">
              <Link href={`/admin/providencias/${id}/firmas`}>
                <PenLine className="size-4" />
                Firmas
              </Link>
            </Button> : <Button variant="outline" disabled title="No tiene permiso para administrar firmas"><PenLine className="size-4" /> Firmas</Button>}
            {canPrint ? <PrintButton label="Imprimir providencia" href={`/imprimir/providencias/${id}`} /> : <Button disabled title="No tiene permiso para imprimir providencias">Imprimir providencia</Button>}
            {canPrint && collegiate && votes?.length ? <Button asChild variant="outline"><Link href={`/imprimir/providencias/${id}?includeVotes=1`} target="_blank">Imprimir con votos anexos</Link></Button> : null}
            {combinedPdfUrl && (
              <Button asChild>
                <a href={combinedPdfUrl} target="_blank" rel="noreferrer">
                  <FileText className="size-4" /> PDF formal con firmas
                </a>
              </Button>
            )}
          </div>
        }
      />
      <p className="no-print -mt-3 mb-5 text-xs text-muted-foreground">
        Para impresión limpia, desactive encabezados y pies del navegador o use
        el PDF formal cuando esté disponible.
      </p>
      <ActionMessage error={query.error} success={query.success} />
      <FormalProvidenceDocument proceeding={proceeding} caseRecord={formalCaseRecord} signatures={signatures} pdfUrl={originalPdfUrl} combinedPdfUrl={combinedPdfUrl} />
      {collegiate && canViewVotes && <section className="no-print mt-6 rounded-xl border bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold text-[#153553]"><Scale className="size-5" /> Votos particulares</h2><p className="mt-1 text-xs text-muted-foreground">Documentos separados que no sustituyen la providencia principal.</p></div><div className="flex flex-wrap gap-2">{canViewSala && <Button asChild variant="outline"><Link href={`/admin/providencias/${id}/sala`}><Gavel className="size-4" /> Modo Sala</Link></Button>}{canCreateVotes && <><Button asChild variant="outline"><Link href={`/admin/providencias/${id}/votos/nuevo?type=Salvamento%20de%20voto`}>Agregar salvamento de voto</Link></Button><Button asChild variant="outline"><Link href={`/admin/providencias/${id}/votos/nuevo?type=Aclaraci%C3%B3n%20de%20voto`}>Agregar aclaración de voto</Link></Button></>}</div></div>
        <div className="mt-4 space-y-2">{(votes ?? []).map((vote) => { const author = Array.isArray(vote.author) ? vote.author[0] : vote.author; return <article key={vote.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><p className="font-semibold">{vote.vote_type}</p><p className="text-sm text-slate-700">{vote.title}</p><p className="mt-1 text-xs text-muted-foreground">{author?.full_name ?? "Magistratura"} · {institutionStyle === "corte_suprema" ? (vote.vote_type.startsWith("Salvamento") ? "Magistrado/a que salva voto" : "Magistrado/a que aclara voto") : (vote.vote_type.startsWith("Salvamento") ? "Magistrado/a disidente" : "Magistrado/a que aclara")} · {vote.status}</p></div><div className="flex gap-2">{vote.status === "Borrador" && vote.author_id === profile.id && <Button asChild size="sm" variant="outline"><Link href={`/admin/providencias/${id}/votos/${vote.id}/editar`}>Editar</Link></Button>}<Button asChild size="sm" variant="outline"><Link href={`/admin/providencias/${id}/votos/${vote.id}`}>Ver y firmar</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/imprimir/votos/${vote.id}`} target="_blank">Imprimir</Link></Button></div></article>; })}{!votes?.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">No se han presentado votos particulares.</p>}</div>
      </section>}
      <div id="firmas">
        <SignaturePanel
          caseId={proceeding.case_id}
          targetType="proceeding"
          targetId={id}
          destination={`/admin/providencias/${id}`}
          signingLink={query.signingLink}
          canRequest={canProvidenceSign && canRequestSignatures}
          canRevoke={canProvidenceSign && canRevokeSignatures}
          canSign={canProvidenceSign && canSign}
        />
      </div>
      <div className="mt-4 space-y-4 no-print">
        {canShare && <ShareAccessForm
          resourceType="proceeding"
          resourceId={id}
          caseId={proceeding.case_id}
          destination={`/admin/providencias/${id}`}
          users={(users ?? []).map((user) => ({
            id: user.id,
            name: user.full_name,
          }))}
          dependencies={(dependencies ?? []).map((dependency) => ({
            id: dependency.id,
            name: dependency.name,
          }))}
        />}
        <LifecycleActions
          resource="proceedings"
          recordId={id}
          recordLabel={proceeding.providence_number}
          destination="/admin/providencias"
          archived={Boolean(proceeding.archived_at)}
          canArchive={canArchive}
          canRestore={canRestore}
          canHardDelete={canHardDelete}
        />
        {canPublish && proceeding.status !== "Publicado" && !proceeding.archived_at && (
          <form action={publishProceeding}>
            <input type="hidden" name="id" value={proceeding.id} />
            <input type="hidden" name="case_id" value={proceeding.case_id} />
            <ConfirmSubmitButton
              message={
                proceeding.requires_signature
                  ? "¿Publicar esta providencia? Se validará que tenga al menos una firma capturada."
                  : "¿Publicar esta providencia sin requisito de firma?"
              }
            >
              Publicar providencia
            </ConfirmSubmitButton>
          </form>
        )}
      </div>
    </>
  );
}
