import { headers } from "next/headers";
import { LockKeyhole } from "lucide-react";
import { FormalProvidenceDocument } from "@/components/formal-providence-document";
import { InstitutionalMark } from "@/components/institutional-mark";
import { MarkdownViewer } from "@/components/markdown-editor";
import { PrintButton } from "@/components/print-button";
import { SignaturePrintBlocks } from "@/components/signature-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSecret } from "@/lib/secure-tokens";
import { formatDate } from "@/lib/demo-data";

export default async function SharedCasePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const requestHeaders = await headers();
  const { data: link } = admin
    ? await admin
        .from("share_links")
        .select("*")
        .eq("token_hash", hashSecret(token))
        .maybeSingle()
    : { data: null };
  const valid =
    link && !link.revoked_at && new Date(link.expires_at) > new Date();
  if (!valid) {
    if (admin && link)
      await admin
        .from("share_link_access_events")
        .insert({
          share_link_id: link.id,
          event_type: link.revoked_at ? "revoked" : "expired",
          user_agent: requestHeaders.get("user-agent")?.slice(0, 500),
        });
    return (
      <SharedShell>
        <Card>
          <CardContent className="p-8 text-center">
            <LockKeyhole className="mx-auto mb-3 size-8 text-amber-700" />
            <h1 className="font-semibold">Acceso no disponible</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              El enlace no existe, venció o fue revocado.
            </p>
          </CardContent>
        </Card>
      </SharedShell>
    );
  }
  await Promise.all([
    admin!
      .from("share_links")
      .update({ last_access_at: new Date().toISOString() })
      .eq("id", link.id),
    admin!
      .from("share_link_access_events")
      .insert({
        share_link_id: link.id,
        event_type: "opened",
        user_agent: requestHeaders.get("user-agent")?.slice(0, 500),
      }),
  ]);
  const [
    { data: item },
    { data: actions },
    { data: parties },
    { data: hearings },
    { data: proceedings },
    { data: documents },
  ] = await Promise.all([
    admin!
      .from("cases")
      .select(
        "id,internal_number,judicial_number,title,chamber,authority_type,claimant_name,defendant_name,municipality,process_type,process_subtype,status,summary,filed_at,confidentiality_level,dependency:dependencies(name)",
      )
      .eq("id", link.case_id)
      .is("archived_at", null)
      .single(),
    admin!
      .from("case_actions")
      .select("id,title,description,action_date,visibility")
      .eq("case_id", link.case_id)
      .is("archived_at", null)
      .order("action_date", { ascending: false }),
    link.include_parties
      ? admin!
          .from("case_parties")
          .select("id,name,party_type")
          .eq("case_id", link.case_id)
          .is("archived_at", null)
      : Promise.resolve({ data: [] }),
    link.include_hearings
      ? admin!
          .from("hearings")
          .select("id,title,hearing_type,scheduled_at,status,room")
          .eq("case_id", link.case_id)
          .is("archived_at", null)
      : Promise.resolve({ data: [] }),
    link.include_proceedings
      ? admin!
          .from("proceedings")
          .select(
            "id,providence_number,title,type,chamber,content_markdown,status,visibility,creation_mode,pdf_path,pdf_original_name,published_at,providence_date,template_style,template_key,document_metadata",
          )
          .eq("case_id", link.case_id)
          .is("archived_at", null)
      : Promise.resolve({ data: [] }),
    link.include_documents
      ? admin!
          .from("documents")
          .select("id,title,file_path,file_type,created_at")
          .eq("case_id", link.case_id)
          .is("archived_at", null)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
  ]);
  if (!item) {
    return (
      <SharedShell>
        <Card><CardContent className="p-8 text-center">El expediente ya no está disponible.</CardContent></Card>
      </SharedShell>
    );
  }
  const safeActions = (actions ?? []).filter(
    (a) => link.actions_scope === "all" || a.visibility === "public",
  );
  const signedDocuments = await Promise.all(
    (documents ?? []).map(async (d) => ({
      ...d,
      url: (
        await admin!.storage
          .from("case-documents")
          .createSignedUrl(d.file_path, 600)
      ).data?.signedUrl,
    })),
  );
  const signedProceedings = await Promise.all(
    (proceedings ?? []).map(async (p) => ({
      ...p,
      pdfUrl: p.pdf_path ? `/api/providencias/${p.id}/pdf?share=${encodeURIComponent(token)}&variant=original` : null,
      combinedPdfUrl: p.pdf_path ? `/api/providencias/${p.id}/pdf?share=${encodeURIComponent(token)}` : null,
    })),
  );
  const hearingIds = (hearings ?? []).map((hearing) => hearing.id);
  const { data: minutes } = hearingIds.length
    ? await admin!
        .from("hearing_minutes")
        .select(
          "id,hearing_id,interveners,attendees,absences,development_markdown,decisions_markdown,evidence_markdown,records_markdown,observations_markdown,closing_markdown,status",
        )
        .in("hearing_id", hearingIds)
    : { data: [] };
  const signedTargetIds = [
    ...signedProceedings.map((proceeding) => proceeding.id),
    ...(minutes ?? []).map((minute) => minute.id),
  ];
  const { data: signatureRows } = signedTargetIds.length
    ? await admin!
        .from("signatures")
        .select(
          "id,target_type,target_id,signer_name,signer_title,signature_image_path,purpose,signed_at,verification_code",
        )
        .in("target_id", signedTargetIds)
        .eq("status", "signed")
        .order("signature_order")
    : { data: [] };
  const sharedSignatures = await Promise.all(
    (signatureRows ?? []).map(async (signature) => ({
      ...signature,
      imageUrl:
        (
          await admin!.storage
            .from("signatures")
            .createSignedUrl(signature.signature_image_path, 600)
        ).data?.signedUrl ?? null,
    })),
  );
  return (
    <SharedShell>
      <div className="rounded-xl border-t-4 border-[#b38a3c] bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[.16em] text-[#8a6a2c]">
          Acceso compartido de sólo lectura
        </p>
        <h1 className="mt-2 text-xl font-semibold text-[#153553]">
          {item.title}
        </h1>
        <p className="mt-1 font-mono text-sm">
          {item.internal_number} · {item.judicial_number}
        </p>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Proceso</dt>
            <dd>
              {item.process_type} · {item.process_subtype}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Estado</dt>
            <dd>{item.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Clasificación</dt>
            <dd>{item.confidentiality_level}</dd>
          </div>
        </dl>
        <p className="mt-5 text-sm leading-7">{item.summary}</p>
      </div>
      <Section title="Actuaciones">
        {safeActions.map((a) => (
          <Row
            key={a.id}
            title={a.title}
            detail={`${formatDate(a.action_date)} · ${a.description}`}
          />
        ))}
      </Section>
      {link.include_parties && (
        <Section title="Partes procesales">
          {(parties ?? []).map((p) => (
            <Row key={p.id} title={p.name} detail={p.party_type} />
          ))}
        </Section>
      )}
      {link.include_hearings && (
        <Section title="Audiencias y actas">
          {(hearings ?? []).map((h) => (
            <article key={h.id} className="rounded-lg border p-4">
              <p className="font-semibold">{h.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(h.scheduled_at)} · {h.status} · {h.room || "Sala por definir"}
              </p>
              {(() => {
                const minute = (minutes ?? []).find((item) => item.hearing_id === h.id);
                if (!minute) return null;
                return (
                  <div className="mt-5 border-t pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6a2c]">Acta de audiencia · {minute.status}</p>
                    <CompactMarkdown title="Desarrollo" content={minute.development_markdown} />
                    <CompactMarkdown title="Decisiones" content={minute.decisions_markdown} />
                    <CompactMarkdown title="Constancias" content={minute.records_markdown} />
                    <SignaturePrintBlocks signatures={sharedSignatures.filter((signature) => signature.target_type === "hearing_minute" && signature.target_id === minute.id)} />
                  </div>
                );
              })()}
            </article>
          ))}
        </Section>
      )}
      {link.include_proceedings && (
        <Section title="Providencias">
          {signedProceedings.map((p) => (
            <div key={p.id}>
              <div className="no-print mb-3 flex justify-end">
                <PrintButton
                  label="Imprimir providencia"
                  href={`/imprimir/providencias/${p.id}?share=${encodeURIComponent(token)}`}
                />
              </div>
              <FormalProvidenceDocument
                proceeding={p}
                caseRecord={{
                  ...item,
                  dependency_name: item.dependency?.[0]?.name,
                }}
                signatures={sharedSignatures.filter((signature) => signature.target_type === "proceeding" && signature.target_id === p.id)}
                pdfUrl={p.pdfUrl}
                combinedPdfUrl={p.combinedPdfUrl}
              />
            </div>
          ))}
        </Section>
      )}
      {link.include_documents && (
        <Section title="Documentos">
          {signedDocuments.map((d) => (
            <a
              key={d.id}
              href={d.url || "#"}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border p-4 text-sm font-medium hover:bg-slate-50"
            >
              {d.title} · Abrir archivo privado
            </a>
          ))}
        </Section>
      )}
      <p className="mt-8 text-center text-xs text-slate-500">
        El acceso está limitado a este expediente y vence automáticamente. No
        permite modificar registros.
      </p>
    </SharedShell>
  );
}
function SharedShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <InstitutionalMark size={58} />
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-[#8a6a2c]">
              República de Colombia
            </p>
            <p className="font-semibold text-[#153553]">
              Palacio Judicial · SIGJ
            </p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}
function Row({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
function CompactMarkdown({ title, content }: { title: string; content?: string | null }) {
  if (!content) return null;
  return (
    <section className="mt-4">
      <h3 className="text-sm font-semibold text-[#153553]">{title}</h3>
      <div className="mt-2 [&>article]:min-h-0 [&>article]:border-0 [&>article]:p-0">
        <MarkdownViewer content={content} />
      </div>
    </section>
  );
}
