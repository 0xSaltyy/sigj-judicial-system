import Link from "next/link";
import { FileSearch, ShieldAlert, UserSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader, EmptyState, MetricCard } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDate, safeText } from "@/lib/display";

export const metadata = { title: "Registros de antecedentes penales" };

type PersonRow = {
  id: string;
  person_record_number: string;
  legal_first_name: string;
  legal_middle_name: string | null;
  legal_last_name: string;
  aliases: string[] | null;
  date_of_birth: string | null;
  verification_status: string;
  duplicate_review_status: string;
  access_classification: string;
};

type SummaryRow = {
  person_id: string;
  total_arrest_events: number;
  pending_charges: number;
  conviction_counts: number;
  dismissed_counts: number;
  acquitted_counts: number;
  incomplete_dispositions: number;
};

export default async function CriminalHistoryAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; purpose?: string }> }) {
  const query = await searchParams;
  const q = cleanFilter(query.q);
  const purpose = (query.purpose ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  const supabase = await createClient();
  const shouldSearch = q.length >= 2 && purpose.length >= 8;

  const [{ data: metrics }, { data: incomplete }, peopleResult] = await Promise.all([
    supabase ? supabase.from("person_criminal_history_summary").select("person_id,total_arrest_events,pending_charges,conviction_counts,dismissed_counts,acquitted_counts,incomplete_dispositions").limit(500) : Promise.resolve({ data: [] }),
    supabase ? supabase.from("incomplete_dispositions_queue").select("charge_id").limit(1000) : Promise.resolve({ data: [] }),
    supabase && shouldSearch
      ? supabase
          .from("persons")
          .select("id,person_record_number,legal_first_name,legal_middle_name,legal_last_name,aliases,date_of_birth,verification_status,duplicate_review_status,access_classification")
          .or(`person_record_number.ilike.%${q}%,legal_first_name.ilike.%${q}%,legal_middle_name.ilike.%${q}%,legal_last_name.ilike.%${q}%`)
          .limit(30)
      : Promise.resolve({ data: [] }),
  ]);

  const people = (peopleResult.data ?? []) as PersonRow[];
  const summary = (metrics ?? []) as SummaryRow[];
  if (supabase && shouldSearch) {
    await supabase.rpc("log_criminal_history_search", {
      p_query: q,
      p_purpose: purpose,
      p_results_count: people.length,
      p_viewed_person_ids: people.map((person) => person.id),
    });
  }
  const totalArrests = summary.reduce((sum, item) => sum + Number(item.total_arrest_events ?? 0), 0);
  const incompleteCount = incomplete?.length ?? 0;

  return (
    <>
      <AdminPageHeader
        title="Registros de antecedentes penales"
        description="Criminal History Records: búsqueda interna sensible basada en Person, Arrest Event, Charge y Disposition. Requiere propósito y queda auditada."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Person records" value={String(summary.length)} detail="Personas con resumen derivado de eventos del portal." icon={<UserSearch className="size-4" />} />
        <MetricCard label="Arrest events" value={String(totalArrests)} detail="Eventos documentados; no equivalen automáticamente a convicción." icon={<ShieldAlert className="size-4" />} />
        <MetricCard label="Incomplete dispositions" value={String(incompleteCount)} detail="Cargos/arrestos sin disposición final recibida." icon={<FileSearch className="size-4" />} />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base text-[#153553]">Búsqueda interna autorizada</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-[1fr_1.2fr_auto]">
            <div className="grid gap-2">
              <Label htmlFor="q">Person Record Number, nombre, alias o identificador operativo</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="RP-PER-2026-100001 / nombre legal" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="purpose">Propósito de búsqueda</Label>
              <Input id="purpose" name="purpose" defaultValue={purpose} placeholder="Ej. revisión vinculada al Case RP-CR-..." />
            </div>
            <Button className="self-end rounded-none bg-[#153b5c]">Buscar</Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            No use esta búsqueda para solicitudes públicas. Las consultas privadas del titular y background checks se procesan en colas separadas.
          </p>
        </CardContent>
      </Card>

      <div className="mt-6 divide-y border bg-white">
        {!shouldSearch ? (
          <EmptyState title="Indique búsqueda y propósito" description="Por seguridad, la consulta interna no se ejecuta sin un propósito suficiente y auditable." icon={<UserSearch />} />
        ) : people.length === 0 ? (
          <EmptyState title="Sin coincidencias" description="No se encontró una persona con los datos ingresados. No se asumirá identidad por nombre." icon={<FileSearch />} />
        ) : people.map((person) => (
          <article key={person.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
            <div>
              <p className="mono-number text-xs font-semibold text-[#8b6829]">{person.person_record_number}</p>
              <h2 className="mt-1 font-serif text-xl font-semibold text-[#102d49]">{person.legal_first_name} {person.legal_middle_name} {person.legal_last_name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">DOB: {formatDate(person.date_of_birth)} · Aliases: {person.aliases?.join(", ") || "None recorded"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Badge variant="outline">{safeText(person.verification_status)}</Badge>
              <Badge variant="secondary">{safeText(person.access_classification)}</Badge>
              {person.duplicate_review_status !== "Not reviewed" ? <Badge>{person.duplicate_review_status}</Badge> : null}
              <Button asChild variant="outline" size="sm"><Link href={`/admin/antecedentes/${person.id}`}>Ver registro</Link></Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function cleanFilter(value?: string) {
  return (value ?? "").replace(/[%,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}
