import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  FormalProvidenceDocument,
  type CaseDocument,
  type PrintableSignature,
  type ProceedingDocument,
} from "@/components/formal-providence-document";
import { PrintDocumentShell } from "@/components/print-document-shell";
import { hashSecret } from "@/lib/secure-tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  searchParams: Promise<{ share?: string }>;
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
    const { data: internal } = await supabase
      .from("proceedings")
      .select(
        "*,case:cases(internal_number,judicial_number,authority_type,chamber,claimant_name,defendant_name,municipality,dependency:dependencies(name))",
      )
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle();
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
          imageUrl:
            (
              await assetClient.storage
                .from("signatures")
                .createSignedUrl(signature.signature_image_path, 600)
            ).data?.signedUrl ?? null,
        })),
      )
    : [];

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
    </PrintDocumentShell>
  );
}
