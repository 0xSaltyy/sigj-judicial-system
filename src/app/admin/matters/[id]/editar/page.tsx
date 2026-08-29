import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { updateMatterControlled } from "@/app/actions/matter-workflow";
import { AdminPageHeader } from "@/components/admin-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/display";

export default async function EditMatterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: matter } = await supabase.from("matters").select("*").eq("id", id).maybeSingle();
  if (!matter) notFound();
  return (
    <>
      <AdminPageHeader title="Editar Matter" description={`${matter.matter_number} · ${matter.title}`} action={<Button asChild variant="outline"><Link href={`/admin/matters/${matter.id}`}><ArrowLeft className="mr-2 size-4" /> Volver</Link></Button>} />
      {query.error ? <Alert variant="destructive" className="mb-5"><AlertTriangle className="size-4" /><AlertDescription>{query.error}</AlertDescription></Alert> : null}
      <form action={updateMatterControlled} className="space-y-5">
        <input type="hidden" name="matter_id" value={matter.id} />
        <Card>
          <CardHeader><CardTitle>Campos inmutables</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <ReadOnly label="Matter Number" value={matter.matter_number} />
            <ReadOnly label="Fecha original" value={formatDateTime(matter.opened_at)} />
            <ReadOnly label="Creator" value={matter.created_by || "Recorded in audit"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Información editable</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field name="title" label="Título" defaultValue={matter.title} required />
            <Field name="matter_type" label="Matter type" defaultValue={matter.matter_type} />
            <Field name="lead_component" label="Lead DOJ component" defaultValue={matter.lead_component || ""} />
            <Field name="investigating_agency" label="Investigating agency" defaultValue={matter.investigating_agency || ""} />
            <Field name="referring_agency" label="Referring agency" defaultValue={matter.referring_agency || ""} />
            <Field name="referral_date" label="Referral date" type="date" defaultValue={matter.referral_date || ""} />
            <Field name="status" label="Status" defaultValue={matter.status} />
            <Field name="access_level" label="Access classification" defaultValue={matter.access_level} />
            <Field name="security_classification" label="Security classification" defaultValue={matter.security_classification} />
            <Field name="closing_date" label="Closing date" type="date" defaultValue={matter.closing_date || ""} />
            <TextareaField name="summary" label="Resumen" defaultValue={matter.summary || ""} />
            <TextareaField name="participating_components" label="Participating components (uno por línea)" defaultValue={(matter.participating_components || []).join("\n")} />
            <TextareaField name="statutes_under_review" label="Statutes under review (uno por línea)" defaultValue={(matter.statutes_under_review || []).join("\n")} />
            <TextareaField name="closing_reason" label="Closing reason / memo" defaultValue={matter.closing_reason || ""} />
            <TextareaField name="reason" label="Razón de auditoría para esta edición" required />
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2 rounded border bg-white p-4">
          <Button asChild variant="outline"><Link href={`/admin/matters/${matter.id}`}>Cancelar</Link></Button>
          <Button className="bg-[#153b5c]">Guardar Matter</Button>
        </div>
      </form>
    </>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div className="rounded border bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function Field({ name, label, defaultValue, type = "text", required }: { name: string; label: string; defaultValue?: string; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} /></div>;
}

function TextareaField({ name, label, defaultValue = "", required }: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return <div className="space-y-2 md:col-span-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} defaultValue={defaultValue} required={required} className="min-h-28" /></div>;
}
