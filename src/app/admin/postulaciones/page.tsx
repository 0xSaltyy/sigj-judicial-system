import { ClipboardCheck, Filter } from "lucide-react";
import { updateApplicationReview } from "@/app/actions/applications";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { ApplicationDeleteAction } from "@/components/application-delete-action";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, safeText } from "@/lib/display";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Postulaciones" };

type ApplicationRow = {
  id: string;
  tracking_code: string;
  application_type: string;
  applicant_name: string;
  contact_info: string | null;
  experience: string | null;
  education: string | null;
  statement: string | null;
  status: string;
  public_message: string | null;
  internal_notes: string | null;
  submitted_at: string;
  updated_at: string;
  archived_at: string | null;
};

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase
        .from("roleplay_applications")
        .select("id,tracking_code,application_type,applicant_name,contact_info,experience,education,statement,status,public_message,internal_notes,submitted_at,updated_at,archived_at")
        .order("submitted_at", { ascending: false })
        .limit(100)
    : { data: null };
  const rows = (data ?? []) as ApplicationRow[];

  return (
    <>
      <AdminPageHeader title="Postulaciones" description="Revisión administrativa de postulaciones recibidas desde el portal público." />
      {query.error ? <p className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-900">{query.error}</p> : null}
      {query.updated ? <p className="mb-5 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Postulación actualizada.</p> : null}
      {query.deleted ? <p className="mb-5 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Postulación eliminada permanentemente y registrada en auditoría.</p> : null}

      <div className="mb-5 grid gap-3 border border-[#cfd6dc] bg-[#fffdf8] p-4 sm:grid-cols-[1fr_auto]">
        <Input placeholder="Buscar por código, nombre o cargo…" />
        <Button variant="outline" className="gap-2 rounded-none">
          <Filter className="size-4" /> Filtrar
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No hay postulaciones" description="Las solicitudes enviadas desde el portal público aparecerán aquí." icon={<ClipboardCheck className="size-6" />} />
      ) : (
        <div className="grid gap-5">
          {rows.map((item) => (
            <article key={item.id} className="formal-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="mono-number text-xs font-semibold text-[#005ea8]">{item.tracking_code}</p>
                  <h2 className="mt-1 font-serif text-xl font-semibold text-[#0a2540]">{item.applicant_name}</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    {labelType(item.application_type)} · {safeText(item.contact_info, "Sin contacto")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-none bg-[#0a2540]">{item.status}</Badge>
                  {item.archived_at ? <Badge variant="outline" className="rounded-none border-amber-300 text-amber-800">Archivada</Badge> : null}
                </div>
              </div>

              <dl className="mt-4 grid gap-px border-y border-[#cfd6dc] bg-[#cfd6dc] text-sm sm:grid-cols-3">
                <Info label="Recibida" value={formatDateTime(item.submitted_at)} />
                <Info label="Actualizada" value={formatDateTime(item.updated_at)} />
                <Info label="Tipo" value={labelType(item.application_type)} />
              </dl>

              <div className="mt-4 grid gap-3 text-sm text-slate-700 lg:grid-cols-3">
                <TextBlock title="Experiencia" text={item.experience} />
                <TextBlock title="Formación" text={item.education} />
                <TextBlock title="Declaración" text={item.statement} />
              </div>

              <form action={updateApplicationReview} className="mt-4 grid gap-3 border-t border-[#cfd6dc] pt-4">
                <input type="hidden" name="id" value={item.id} />
                <Select name="status" defaultValue={item.status}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Recibida", "En revisión", "Entrevista", "Aprobada", "Rechazada", "Retirada"].map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea name="public_message" defaultValue={item.public_message || ""} placeholder="Mensaje público para consulta de estado" className="rounded-none" />
                <Textarea name="internal_notes" defaultValue={item.internal_notes || ""} placeholder="Notas internas de revisión" className="rounded-none" />
                <div>
                  <Button type="submit" className="rounded-none bg-[#005ea8]">
                    Guardar revisión
                  </Button>
                </div>
              </form>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#cfd6dc] pt-4">
                <LifecycleActions resource="roleplay_applications" id={item.id} archived={Boolean(item.archived_at)} compact allowDelete={false} />
                <ApplicationDeleteAction id={item.id} applicantName={item.applicant_name} trackingCode={item.tracking_code} />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function labelType(value: string) {
  return (
    {
      juez: "Postulación a juez",
      abogado: "Registro de abogado",
      investigador: "Investigador autorizado",
      personal: "Personal autorizado",
    } as Record<string, string>
  )[value] ?? value;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#fffdf8] p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-[#0a2540]">{value}</dd>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text?: string | null }) {
  return (
    <div className="border border-[#cfd6dc] bg-[#f7f1e5] p-3">
      <p className="text-xs font-semibold text-[#0a2540]">{title}</p>
      <p className="mt-2 line-clamp-4 text-xs leading-5">{safeText(text, "Sin registrar")}</p>
    </div>
  );
}
