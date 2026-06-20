import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PrintableSignature } from "@/components/formal-providence-document";
import { HearingMinuteDocument } from "@/components/hearing-minute-document";
import { PrintDocumentShell } from "@/components/print-document-shell";
import { requirePermission } from "@/lib/auth/permissions";
import { signatureImageDataUrl } from "@/lib/signature-images";

export const metadata: Metadata = {
  title: "Acta de audiencia",
  robots: { index: false, follow: false },
};

export default async function HearingMinutePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { supabase }] = await Promise.all([
    params,
    requirePermission({ resource: "actas", action: "view" }),
  ]);
  const [{ data: hearing }, { data: minute }] = await Promise.all([
    supabase
      .from("hearings")
      .select("*,case:cases(internal_number,judicial_number,title,chamber,authority_type,dependency:dependencies(name))")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("hearing_minutes")
      .select("*")
      .eq("hearing_id", id)
      .maybeSingle(),
  ]);
  if (!hearing || !minute || !["Finalizada", "Firmada"].includes(minute.status)) notFound();
  const caseRecord = Array.isArray(hearing.case) ? hearing.case[0] : hearing.case;
  const dependency = Array.isArray(caseRecord?.dependency) ? caseRecord.dependency[0] : caseRecord?.dependency;
  const formalCaseRecord = { ...caseRecord, dependency_name: dependency?.name || null };
  const { data: signatureRows } = await supabase
        .from("signatures")
        .select("id,signer_name,signer_title,signature_image_path,purpose,signed_at,verification_code")
        .eq("target_type", "hearing_minute")
        .eq("target_id", minute.id)
        .eq("status", "signed")
        .order("signature_order");
  const signatures: PrintableSignature[] = await Promise.all(
    (signatureRows ?? []).map(async (signature) => ({
      ...signature,
      imageUrl: await signatureImageDataUrl(supabase, signature.signature_image_path),
    })),
  );
  await supabase.rpc("log_security_event", {
    p_action: "HEARING_MINUTE_PRINT_VIEWED",
    p_table: "hearing_minutes",
    p_record_id: minute.id,
    p_description: "Vista formal de impresión del acta abierta",
    p_metadata: { hearing_id: id, status: minute.status },
  });

  return (
    <PrintDocumentShell>
      <HearingMinuteDocument
        hearing={hearing}
        minute={minute}
        caseRecord={formalCaseRecord}
        signatures={signatures}
      />
    </PrintDocumentShell>
  );
}
