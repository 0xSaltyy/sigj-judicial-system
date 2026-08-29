import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, GitBranch, ShieldAlert } from "lucide-react";
import { linkComplaintToCaseAction, openMatterFromComplaintAction, transferComplaintAttachmentToEvidenceAction } from "@/app/actions/matter-workflow";
import { updateComplaint } from "@/app/actions/complaints";
import { AdminPageHeader } from "@/components/admin-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, safeText } from "@/lib/display";

export default async function ComplaintDecisionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; updated?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const [complaintResult, casesResult, matterLinksResult, caseLinksResult, attachmentsResult] = await Promise.all([
    supabase.from("complaints").select("*").eq("id", id).maybeSingle(),
    supabase.from("cases").select("id,case_number,internal_number,case_caption,title,status").is("archived_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("complaint_matter_links").select("id,relationship_type,reason,matters(id,matter_number,title,status)").eq("complaint_id", id).eq("active", true),
    supabase.from("complaint_case_links").select("id,relationship_type,reason,cases(id,case_number,internal_number,case_caption,title,status)").eq("complaint_id", id).eq("active", true),
    supabase.from("complaint_attachments").select("id,original_name,content_type,size_bytes,created_at").eq("complaint_id", id).order("created_at", { ascending: false }),
  ]);
  if (!complaintResult.data) notFound();
  const complaint = complaintResult.data;
  const cases = casesResult.data ?? [];
  const matterLinks = matterLinksResult.data ?? [];
  const caseLinks = caseLinksResult.data ?? [];
  const attachments = attachmentsResult.data ?? [];
  return (
    <>
      <AdminPageHeader title="Denuncia pública (Public Complaint)" description={`${complaint.tracking_number} · ${complaint.category}`} action={<Button asChild variant="outline"><Link href="/admin/denuncias"><ArrowLeft className="mr-2 size-4" /> Volver</Link></Button>} />
      {query.error ? <Alert variant="destructive" className="mb-5"><AlertTriangle className="size-4" /><AlertDescription>{query.error}</AlertDescription></Alert> : null}
      {query.updated ? <Alert className="mb-5 border-emerald-200 bg-emerald-50"><AlertDescription>Denuncia actualizada.</AlertDescription></Alert> : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_.8fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="size-4" /> Información de denuncia</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2"><Badge>{complaint.status}</Badge><Badge variant="outline">{complaint.priority}</Badge>{complaint.anonymous ? <Badge variant="outline">Anónima</Badge> : null}</div>
            <dl className="grid gap-3 md:grid-cols-2">
              <Info label="Tracking Number" value={complaint.tracking_number} />
              <Info label="Fecha" value={formatDateTime(complaint.submitted_at)} />
              <Info label="Denunciante" value={complaint.anonymous ? "Denuncia anónima" : safeText(complaint.complainant_name)} />
              <Info label="Contacto" value={safeText(complaint.contact_method)} />
              <Info label="Persona / entidad denunciada" value={safeText(complaint.reported_subject)} />
              <Info label="Lugar" value={safeText(complaint.location)} />
            </dl>
            <div className="rounded border bg-slate-50 p-4 text-sm leading-7 whitespace-pre-wrap">{complaint.description}</div>
            <Section title="Adjuntos protegidos" empty="No hay adjuntos.">
              {attachments.map((file) => <div key={file.id} className="border-b p-3 last:border-b-0 text-sm">
                <p className="font-medium">{file.original_name}</p>
                <p className="text-xs text-muted-foreground">{file.content_type} · {file.size_bytes} bytes · Storage protegido</p>
                {(complaint.primary_matter_id || complaint.primary_case_id) ? <form action={transferComplaintAttachmentToEvidenceAction} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="complaint_id" value={complaint.id} />
                  <input type="hidden" name="attachment_id" value={file.id} />
                  <input type="hidden" name="matter_id" value={complaint.primary_matter_id || ""} />
                  <input type="hidden" name="case_id" value={complaint.primary_case_id || ""} />
                  <input type="hidden" name="return_to" value={`/admin/denuncias/${complaint.id}`} />
                  <Input name="title" defaultValue={file.original_name} className="h-9 max-w-xs" />
                  <Input name="reason" placeholder="Razón de transferencia" required className="h-9 max-w-xs" />
                  <Button size="sm" variant="outline">Transferir como evidencia</Button>
                </form> : <p className="mt-2 text-xs text-amber-700">Vincule primero un Matter o Case para transferir este adjunto como evidencia.</p>}
              </div>)}
            </Section>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Actualizar estado público</CardTitle></CardHeader>
          <CardContent>
            <form action={updateComplaint} className="space-y-3">
              <input type="hidden" name="id" value={complaint.id} />
              <Select name="status" defaultValue={complaint.status}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Recibida","En revisión","Referred to Matter","Under Investigation","Linked to Case","No Action","Additional Information Requested","Closed","Archived"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
              </Select>
              <Select name="priority" defaultValue={complaint.priority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Baja","Normal","Alta","Urgente"].map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea name="public_response" defaultValue={complaint.public_response || ""} placeholder="Mensaje público visible al consultar estado" />
              <Textarea name="internal_notes" defaultValue={complaint.internal_notes || ""} placeholder="Notas internas — nunca públicas" />
              <Button className="bg-[#153b5c]">Guardar decisión</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Abrir DOJ Matter</CardTitle></CardHeader>
          <CardContent>
            <form action={openMatterFromComplaintAction} className="space-y-3">
              <input type="hidden" name="complaint_id" value={complaint.id} />
              <Field name="title" label="Título del Matter" defaultValue={complaint.reported_subject || complaint.category} />
              <Field name="matter_type" label="Matter type" defaultValue="Preliminary inquiry" />
              <Field name="status" label="Status inicial" defaultValue="Under Investigation" />
              <Field name="access_level" label="Access" defaultValue="Internal DOJ only" />
              <Textarea name="summary" defaultValue={complaint.description} className="min-h-28" />
              <label className="flex items-start gap-2 rounded border bg-slate-50 p-3 text-sm"><input name="include_attachments" type="checkbox" className="mt-1" /> Incorporar referencia de adjuntos seleccionables. No los vuelve públicos.</label>
              <Textarea name="reason" required placeholder="Razón de apertura / decisión administrativa" />
              <Button className="bg-[#153b5c]">Abrir DOJ Matter</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Vincular Federal Case existente</CardTitle></CardHeader>
          <CardContent>
            <form action={linkComplaintToCaseAction} className="space-y-3">
              <input type="hidden" name="complaint_id" value={complaint.id} />
              <Label htmlFor="case_id">Federal Case</Label>
              <select id="case_id" name="case_id" required className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                <option value="">Seleccione Case…</option>
                {cases.map((item) => <option key={item.id} value={item.id}>{item.case_number || item.internal_number} · {item.case_caption || item.title}</option>)}
              </select>
              <Label htmlFor="relationship_type">Tipo de relación</Label>
              <select id="relationship_type" name="relationship_type" className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                <option value="source_complaint">source complaint</option>
                <option value="related_public_complaint">related complaint</option>
                <option value="public_submission">public submission</option>
              </select>
              <Textarea name="reason" required placeholder="Razón. La denuncia no se convierte automáticamente en evidencia admitida." />
              <Button className="bg-[#153b5c]">Vincular Case</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Section title="Related DOJ Matters" empty="No hay Matters relacionados.">
          {matterLinks.map((link) => {
            const matter = Array.isArray(link.matters) ? link.matters[0] : link.matters;
            return <Link key={link.id} href={`/admin/matters/${matter?.id}`} className="block border-b p-3 last:border-b-0 hover:bg-slate-50"><p className="mono-number text-xs font-semibold text-[#005ea8]">{matter?.matter_number}</p><p className="text-sm font-semibold">{matter?.title}</p><p className="text-xs text-muted-foreground">{link.relationship_type} · {matter?.status}</p></Link>;
          })}
        </Section>
        <Section title="Related Federal Cases" empty="No hay Federal Cases relacionados.">
          {caseLinks.map((link) => {
            const item = Array.isArray(link.cases) ? link.cases[0] : link.cases;
            return <Link key={link.id} href={`/admin/expedientes/${item?.id}`} className="block border-b p-3 last:border-b-0 hover:bg-slate-50"><p className="mono-number text-xs font-semibold text-[#005ea8]">{item?.case_number || item?.internal_number}</p><p className="text-sm font-semibold">{item?.case_caption || item?.title}</p><p className="text-xs text-muted-foreground">{link.relationship_type} · {item?.status}</p></Link>;
          })}
        </Section>
      </div>
      <p className="mt-5 rounded border bg-amber-50 p-3 text-xs text-amber-950">Public Complaint, Criminal Complaint y Civil Complaint se tratan como conceptos separados. Esta denuncia pública no inicia por sí sola un procedimiento penal federal ni hace pública la identidad del denunciante.</p>
    </>
  );
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} defaultValue={defaultValue} /></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 text-sm text-[#153553]">{value}</dd></div>;
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const list = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(list) ? list.length === 0 : !list;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><GitBranch className="size-4" />{title}</CardTitle></CardHeader><CardContent className="p-0">{isEmpty ? <div className="p-4 text-sm text-muted-foreground">{empty}</div> : children}</CardContent></Card>;
}
