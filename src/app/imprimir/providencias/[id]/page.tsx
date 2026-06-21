import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  FormalProvidenceDocument,
  type CaseDocument,
  type PrintableSignature,
  type ProceedingDocument,
} from "@/components/formal-providence-document";
import { PrintDocumentShell } from "@/components/print-document-shell";
import { MarkdownViewer } from "@/components/markdown-editor";
import { SignaturePrintBlocks } from "@/components/signature-panel";
import { hashSecret } from "@/lib/secure-tokens";
import { signatureImageDataUrl } from "@/lib/signature-images";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AuthenticatedProfile } from "@/lib/auth/authorization";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Documento judicial",
  robots: { index: false, follow: false },
};

type LoadedProvidence = {
  proceeding: ProceedingDocument & {
    pdf_path?: string | null;
    pdf_original_name?: string | null;
  };
  caseRecord: CaseDocument;
  publicView: boolean;
  useAdminForAssets: boolean;
};

export default async function ProvidencePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string; includeVotes?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  if (!supabase) notFound();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let loaded: LoadedProvidence | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,full_name,email,role,dependency_id,position_title,is_active,is_owner")
      .eq("id", user.id)
      .maybeSingle();
    const internalAllowed = profile?.is_active &&
      await can(profile as AuthenticatedProfile, "view", "providencias", { supabase }) &&
      await can(profile as AuthenticatedProfile, "print", "providencias", { supabase });
    const { data: internal } = internalAllowed
      ? await supabase
          .from("proceedings")
          .select(
            "*,case:cases(internal_number,judicial_number,authority_type,chamber,claimant_name,defendant_name,municipality,dependency:dependencies(name))",
          )
          .eq("id", id)
          .is("archived_at", null)
          .maybeSingle()
      : { data: null };
    if (internal) {
      const caseRecord = Array.isArray(internal.case)
        ? internal.case[0]
        : internal.case;
      const dependency = Array.isArray(caseRecord?.dependency)
        ? caseRecord.dependency[0]
        : caseRecord?.dependency;
      loaded = {
        proceeding: internal as LoadedProvidence["proceeding"],
        caseRecord: {
          ...caseRecord,
          dependency_name: dependency?.name || null,
        },
        publicView: false,
        useAdminForAssets: false,
      };
    }
  }

  if (!loaded) {
    const { data: published } = await supabase
      .from("public_proceedings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (published && admin) {
      const { data: privateRecord } = await admin
        .from("proceedings")
        .select("pdf_path,pdf_original_name")
        .eq("id", id)
        .single();
      loaded = {
        proceeding: {
          ...published,
          pdf_path: privateRecord?.pdf_path,
          pdf_original_name: privateRecord?.pdf_original_name,
        } as LoadedProvidence["proceeding"],
        caseRecord: published,
        publicView: true,
        useAdminForAssets: true,
      };
    }
  }

  if (!loaded && query.share && admin) {
    const { data: link } = await admin
      .from("share_links")
      .select("case_id,include_proceedings,expires_at,revoked_at")
      .eq("token_hash", hashSecret(query.share))
      .maybeSingle();
    const valid =
      link?.include_proceedings &&
      !link.revoked_at &&
      new Date(link.expires_at) > new Date();
    if (valid) {
      const { data: shared } = await admin
        .from("proceedings")
        .select(
          "*,case:cases(internal_number,judicial_number,authority_type,chamber,claimant_name,defendant_name,municipality,dependency:dependencies(name))",
        )
        .eq("id", id)
        .eq("case_id", link.case_id)
        .is("archived_at", null)
        .maybeSingle();
      if (shared) {
        const caseRecord = Array.isArray(shared.case)
          ? shared.case[0]
          : shared.case;
        const dependency = Array.isArray(caseRecord?.dependency)
          ? caseRecord.dependency[0]
          : caseRecord?.dependency;
        loaded = {
          proceeding: shared as LoadedProvidence["proceeding"],
          caseRecord: {
            ...caseRecord,
            dependency_name: dependency?.name || null,
          },
          publicView: true,
          useAdminForAssets: true,
        };
      }
    }
  }

  if (!loaded) notFound();

  const pdfQuery = query.share
    ? `?share=${encodeURIComponent(query.share)}`
    : "";
  const originalPdfUrl = loaded.proceeding.pdf_path
    ? `/api/providencias/${id}/pdf${pdfQuery}${pdfQuery ? "&" : "?"}variant=original`
    : null;
  const combinedPdfUrl = loaded.proceeding.pdf_path
    ? `/api/providencias/${id}/pdf${pdfQuery}`
    : null;

  if (loaded.proceeding.creation_mode === "pdf" && combinedPdfUrl) {
    redirect(combinedPdfUrl);
  }

  const assetClient = loaded.useAdminForAssets ? admin : supabase;
  if (assetClient) {
    const { data: sala } = await assetClient.from("sala_sessions").select("act_number,session_date,chamber,vote_result,rapporteur:profiles!sala_sessions_rapporteur_id_fkey(full_name)").eq("proceeding_id", id).maybeSingle();
    if (sala) {
      const rapporteur = Array.isArray(sala.rapporteur) ? sala.rapporteur[0] : sala.rapporteur;
      loaded.proceeding.document_metadata = {
        ...(loaded.proceeding.document_metadata ?? {}),
        actNumber: sala.act_number || loaded.proceeding.document_metadata?.actNumber,
        sessionDate: sala.session_date || undefined,
        roomName: sala.chamber || loaded.proceeding.document_metadata?.roomName,
        rapporteurName: rapporteur?.full_name || loaded.proceeding.document_metadata?.rapporteurName,
        voteResult: sala.vote_result || undefined,
      };
    }
  }
  const { data: signatureRows } = assetClient
    ? await assetClient
        .from("signatures")
        .select(
          "id,signer_name,signer_title,signature_image_path,purpose,signed_at,verification_code",
        )
        .eq("target_type", "proceeding")
        .eq("target_id", id)
        .eq("status", "signed")
        .order("signature_order")
    : { data: [] };
  const signatures: PrintableSignature[] = assetClient
    ? await Promise.all(
        (signatureRows ?? []).map(async (signature) => ({
          ...signature,
          imageUrl: await signatureImageDataUrl(assetClient, signature.signature_image_path),
        })),
      )
    : [];
  const voteAnnexes: Array<{ id: string; vote_type: string; title: string; content_markdown: string; institution_style: string; signatures: PrintableSignature[] }> = [];
  if (query.includeVotes === "1" && assetClient) {
    let voteQuery = assetClient.from("vote_documents").select("id,vote_type,title,content_markdown,institution_style,visibility").eq("proceeding_id", id).in("status", ["Presentado", "Firmado", "Publicado"]).order("created_at");
    if (loaded.publicView) voteQuery = voteQuery.eq("visibility", "public");
    const { data: voteRows } = await voteQuery;
    for (const vote of voteRows ?? []) {
      const { data: voteSignatureRows } = await assetClient.from("signatures").select("id,signer_name,signer_title,signature_image_path,purpose,signed_at,verification_code").eq("target_type", "vote_document").eq("target_id", vote.id).eq("status", "signed").order("signature_order");
      const voteSignatures = await Promise.all((voteSignatureRows ?? []).map(async (signature) => ({ ...signature, imageUrl: await signatureImageDataUrl(assetClient, signature.signature_image_path) })));
      voteAnnexes.push({ ...vote, signatures: voteSignatures });
    }
  }

  return (
    <PrintDocumentShell>
      <FormalProvidenceDocument
        proceeding={loaded.proceeding}
        caseRecord={loaded.caseRecord}
        signatures={signatures}
        pdfUrl={originalPdfUrl}
        combinedPdfUrl={combinedPdfUrl}
        publicView={loaded.publicView}
      />
      {voteAnnexes.map((vote) => <article key={vote.id} className={`print-document paper judicial-document formal-document formal-document--${vote.institution_style} page-break-before relative mx-auto bg-white`}><header className="text-center"><p className="font-bold">{vote.institution_style === "corte_suprema" ? "CORTE SUPREMA DE JUSTICIA" : "TRIBUNAL SUPERIOR"}</p><h2 className="mt-8 text-lg font-bold uppercase">{vote.vote_type}</h2><p className="mt-2">{vote.title}</p></header><div className="judicial-body mt-10"><MarkdownViewer content={vote.content_markdown} variant="document" /></div><SignaturePrintBlocks signatures={vote.signatures} /></article>)}
    </PrintDocumentShell>
  );
}
