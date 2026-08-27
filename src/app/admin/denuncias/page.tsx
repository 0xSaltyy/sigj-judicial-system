import { ShieldAlert } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateComplaint } from "@/app/actions/complaints";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, safeText } from "@/lib/display";

export const metadata = { title: "Denuncias" };

type Complaint = {
  id: string;
  tracking_number: string;
  anonymous: boolean;
  complainant_name: string | null;
  contact_method: string | null;
  category: string;
  reported_subject: string | null;
  description: string;
  status: string;
  priority: string;
  public_response: string | null;
  internal_notes: string | null;
  submitted_at: string;
  public_updated_at: string | null;
  archived_at: string | null;
};

export default async function AdminComplaintsPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from("complaints").select("id,tracking_number,anonymous,complainant_name,contact_method,category,reported_subject,description,status,priority,public_response,internal_notes,submitted_at,public_updated_at,archived_at").order("submitted_at", { ascending: false }).limit(50)
    : { data: null };
  const rows = (data ?? []) as Complaint[];
  return (
    <>
      <AdminPageHeader title="Denuncias" description="Recepción, revisión y respuesta pública segura de denuncias del portal." />
      {query.error ? <p className="mb-5 rounded-none border border-red-200 bg-red-50 p-4 text-sm text-red-900">{query.error}</p> : null}
      {query.updated ? <p className="mb-5 rounded-none border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Denuncia actualizada.</p> : null}
      {rows.length === 0 ? <EmptyState title="No hay denuncias registradas" description="Cuando una persona envíe el formulario público, aparecerá aquí para revisión autorizada." icon={<ShieldAlert className="size-6" />} /> : null}
      <div className="grid gap-5">
        {rows.map((item) => (
          <article key={item.id} className="rounded-none border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mono-number text-xs font-semibold text-[#005ea8]">{item.tracking_number}</p>
                <h2 className="mt-1 text-base font-semibold text-[#153553]">{item.category}</h2>
                <p className="mt-1 text-xs text-slate-600">{item.anonymous ? "Denuncia anónima" : safeText(item.complainant_name)} · {safeText(item.contact_method, "Sin contacto")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-none bg-[#112f4e]">{item.status}</Badge>
                <Badge variant="outline" className="rounded-none">{item.priority}</Badge>
                {item.archived_at ? <Badge variant="outline" className="rounded-none border-amber-300 text-amber-800">Archivada</Badge> : null}
              </div>
            </div>
            <dl className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
              <Info label="Reportado" value={safeText(item.reported_subject)} />
              <Info label="Recibida" value={formatDateTime(item.submitted_at)} />
              <Info label="Actualización pública" value={formatDateTime(item.public_updated_at)} />
            </dl>
            <p className="mt-4 whitespace-pre-wrap border bg-slate-50 p-4 text-sm leading-7 text-slate-700">{item.description}</p>
            <form action={updateComplaint} className="mt-4 grid gap-4 border-t pt-4">
              <input type="hidden" name="id" value={item.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select name="status" defaultValue={item.status}>
                  <SelectTrigger className="rounded-none"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>{["Recibida","En revisión","Escalada","Resuelta","Archivada"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                </Select>
                <Select name="priority" defaultValue={item.priority}>
                  <SelectTrigger className="rounded-none"><SelectValue placeholder="Prioridad" /></SelectTrigger>
                  <SelectContent>{["Baja","Normal","Alta","Urgente"].map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Textarea name="public_response" defaultValue={item.public_response || ""} placeholder="Mensaje público visible al consultar estado" className="min-h-24 rounded-none" />
              <Textarea name="internal_notes" defaultValue={item.internal_notes || ""} placeholder="Notas internas — no visibles al público" className="min-h-24 rounded-none" />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="rounded-none bg-[#005ea8] hover:bg-[#1a4480]">Guardar cambios</Button>
                <LifecycleActions resource="complaints" id={item.id} archived={Boolean(item.archived_at)} compact />
              </div>
            </form>
          </article>
        ))}
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[11px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</dt><dd className="mt-1 text-[#112f4e]">{value}</dd></div>;
}
