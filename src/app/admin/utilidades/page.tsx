import Link from "next/link";
import { FileDown, GitBranch, Search, ShieldCheck, TimerReset, Wrench } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, safeText } from "@/lib/display";

type SearchParams = { q?: string };
type Result = { type: string; identifier: string; title: string; status: string; href: string; meta?: string };

export default async function UtilitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const supabase = await createClient();
  if (!supabase) return <EmptyState title="Supabase no está configurado" description="Configure las variables de entorno para usar Utilities." icon={<Wrench />} />;

  const caseQuery = supabase.from("cases").select("id,case_number,internal_number,docket_number,case_caption,title,status,federal_access_level").is("archived_at", null).limit(25);
  const matterQuery = supabase.from("matters").select("id,matter_number,title,status,security_classification").is("archived_at", null).limit(25);
  const complaintQuery = supabase.from("complaints").select("id,tracking_number,reference_number,category,status,complainant_name,anonymous").is("archived_at", null).limit(25);
  const peopleQuery = supabase.from("participants").select("id,legal_name,display_name,internal_identifier,record_status").is("archived_at", null).limit(25);
  const evidenceQuery = supabase.from("evidence_items").select("id,ete_id,evidence_number,formal_title,title,evidence_status,access_classification,sha256_hash,mime_type,file_size_bytes").is("archived_at", null).is("deleted_at", null).limit(25);
  const warrantQuery = supabase.from("roleplay_warrants").select("id,warrant_number,warrant_type,status,confidentiality").is("archived_at", null).limit(25);
  if (q) {
    caseQuery.or(`case_number.ilike.%${q}%,internal_number.ilike.%${q}%,docket_number.ilike.%${q}%,case_caption.ilike.%${q}%,title.ilike.%${q}%,status.ilike.%${q}%`);
    matterQuery.or(`matter_number.ilike.%${q}%,title.ilike.%${q}%,status.ilike.%${q}%,security_classification.ilike.%${q}%`);
    complaintQuery.or(`tracking_number.ilike.%${q}%,reference_number.ilike.%${q}%,category.ilike.%${q}%,status.ilike.%${q}%,complainant_name.ilike.%${q}%`);
    peopleQuery.or(`legal_name.ilike.%${q}%,display_name.ilike.%${q}%,internal_identifier.ilike.%${q}%`);
    evidenceQuery.or(`ete_id.ilike.%${q}%,evidence_number.ilike.%${q}%,formal_title.ilike.%${q}%,title.ilike.%${q}%,sha256_hash.ilike.%${q}%`);
    warrantQuery.or(`warrant_number.ilike.%${q}%,warrant_type.ilike.%${q}%,status.ilike.%${q}%`);
  }

  const [cases, matters, complaints, people, evidence, warrants, relationships, custody, workflow] = await Promise.all([
    caseQuery,
    matterQuery,
    complaintQuery,
    peopleQuery,
    evidenceQuery,
    warrantQuery,
    supabase.from("related_records").select("id,source_type,source_id,target_type,target_id,relationship_type,reason,created_at").eq("active", true).order("created_at", { ascending: false }).limit(30),
    supabase.from("evidence_chain_of_custody").select("id,evidence_id,action,event_at,purpose,acknowledgment,evidence_items(ete_id,formal_title,title,sha256_hash,integrity_status)").order("event_at", { ascending: false }).limit(20),
    supabase.from("workflow_events").select("id,title,event_code,occurred_at,matter_id,case_id,complaint_id,new_status").order("occurred_at", { ascending: false }).limit(30),
  ]);

  const results: Result[] = [
    ...(complaints.data ?? []).map((item) => ({ type: "Complaint", identifier: item.tracking_number || item.reference_number || "Complaint", title: item.category, status: item.status, href: `/admin/denuncias/${item.id}`, meta: item.anonymous ? "Anónima" : safeText(item.complainant_name) })),
    ...(matters.data ?? []).map((item) => ({ type: "DOJ Matter", identifier: item.matter_number, title: item.title, status: item.status, href: `/admin/matters/${item.id}`, meta: item.security_classification })),
    ...(cases.data ?? []).map((item) => ({ type: "Federal Case", identifier: item.case_number || item.internal_number, title: item.case_caption || item.title, status: item.status, href: `/admin/expedientes/${item.id}`, meta: item.docket_number || item.federal_access_level })),
    ...(people.data ?? []).map((item) => ({ type: "Person", identifier: item.internal_identifier || item.id.slice(0, 8), title: item.display_name || item.legal_name, status: item.record_status || "active", href: `/admin/utilidades?q=${encodeURIComponent(item.display_name || item.legal_name)}`, meta: "Participant master record" })),
    ...(evidence.data ?? []).map((item) => ({ type: "Evidence", identifier: item.ete_id || item.evidence_number, title: item.formal_title || item.title, status: item.evidence_status || "received", href: `/api/evidence/${item.id}/download`, meta: `${item.access_classification} · ${item.mime_type || "file"} · hash ${(item.sha256_hash || "").slice(0, 12)}` })),
    ...(warrants.data ?? []).map((item) => ({ type: "Warrant", identifier: item.warrant_number, title: item.warrant_type, status: item.status, href: `/admin/warrants/${item.id}/imprimir`, meta: item.confidentiality })),
  ];

  return (
    <>
      <AdminPageHeader title="Utilities" description="Centro interno para búsqueda, relaciones, integridad probatoria, timelines y paquetes administrativos." />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Search className="size-4" /> Global record search</CardTitle></CardHeader>
        <CardContent>
          <form className="flex flex-col gap-2 sm:flex-row">
            <Input name="q" defaultValue={q} placeholder="Complaint, Matter, Case, Docket, ETE, warrant, persona, estado…" className="rounded-none" />
            <Button className="gap-2 rounded-none bg-[#153b5c]"><Search className="size-4" />Buscar</Button>
          </form>
          <div className="mt-5 divide-y rounded border">
            {results.length === 0 ? <div className="p-5 text-sm text-muted-foreground">No records matched the current filters.</div> : results.map((item) => (
              <Link key={`${item.type}-${item.identifier}-${item.href}`} href={item.href} className="grid gap-2 p-4 hover:bg-slate-50 md:grid-cols-[140px_1fr_auto] md:items-center">
                <Badge variant="outline">{item.type}</Badge>
                <div><p className="mono-number text-xs font-semibold text-[#005ea8]">{item.identifier}</p><p className="text-sm font-semibold text-[#153553]">{item.title}</p><p className="text-xs text-muted-foreground">{item.meta}</p></div>
                <Badge>{item.status}</Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="size-4" />Relationship explorer</CardTitle></CardHeader><CardContent className="divide-y p-0">{(relationships.data ?? []).length === 0 ? <Empty text="No active relationships recorded." /> : (relationships.data ?? []).map((item) => <div key={item.id} className="p-4 text-sm"><p className="font-semibold text-[#153553]">{item.source_type} → {item.target_type}</p><p className="mono-number mt-1 text-xs text-slate-600">{item.source_id} → {item.target_id}</p><p className="mt-1 text-xs text-muted-foreground">{item.relationship_type} · {formatDateTime(item.created_at)}</p>{item.reason ? <p className="mt-2 text-xs">{item.reason}</p> : null}</div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" />Evidence integrity verifier</CardTitle></CardHeader><CardContent className="divide-y p-0">{(custody.data ?? []).length === 0 ? <Empty text="No custody entries available." /> : (custody.data ?? []).map((item) => {
          const evidenceItem = Array.isArray(item.evidence_items) ? item.evidence_items[0] : item.evidence_items;
          return <div key={item.id} className="p-4 text-sm"><p className="mono-number text-xs font-semibold text-[#005ea8]">{evidenceItem?.ete_id || "ETE pending"}</p><p className="font-semibold text-[#153553]">{evidenceItem?.formal_title || evidenceItem?.title || "Evidence item"}</p><p className="mt-1 text-xs text-muted-foreground">{item.action} · {formatDateTime(item.event_at)} · hash {(evidenceItem?.sha256_hash || "").slice(0, 16)} · {evidenceItem?.integrity_status || "pending"}</p><p className="mt-2 text-xs">{item.acknowledgment || item.purpose}</p></div>;
        })}</CardContent></Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <UtilityCard title="Evidence intake utility" description="Use Matter/Case Evidence Manager para subir archivos, calcular SHA-256, generar ETE y registrar chain of custody." href="/admin/matters" icon={<Wrench className="size-4" />} />
        <UtilityCard title="Timeline builder" description="Construye cronología desde complaints, Matters, Cases, docket, evidence, warrants y hearings." href="/admin/utilidades#timeline" icon={<TimerReset className="size-4" />} />
        <UtilityCard title="Case packet generator" description="Genere PDFs desde cada Matter o Federal Case respetando sealed/confidential permissions." href="/admin/expedientes" icon={<FileDown className="size-4" />} />
      </div>

      <Card id="timeline" className="mt-5">
        <CardHeader><CardTitle className="flex items-center gap-2"><TimerReset className="size-4" />Timeline builder</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {(workflow.data ?? []).length === 0 ? <Empty text="No workflow events available." /> : (workflow.data ?? []).map((item) => <div key={item.id} className="p-4"><p className="text-sm font-semibold text-[#153553]">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.event_code} · {formatDateTime(item.occurred_at)} · {item.new_status || "No status change"}</p></div>)}
        </CardContent>
      </Card>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-5 text-sm text-slate-600">{text}</div>;
}

function UtilityCard({ title, description, href, icon }: { title: string; description: string; href: string; icon: React.ReactNode }) {
  return <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm font-semibold text-[#153553]">{icon}{title}</div><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p><Button asChild variant="outline" size="sm" className="mt-4"><Link href={href}>Abrir</Link></Button></CardContent></Card>;
}
