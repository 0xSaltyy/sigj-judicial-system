import { ScrollText } from "lucide-react";
import { createRoleplayWarrant } from "@/app/actions/roleplay";
import { AdminPageHeader } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { warrants as demoWarrants } from "@/lib/demo-data";

type DbWarrant = {
  id: string;
  warrant_number: string;
  warrant_type: string;
  target_description: string;
  status: string;
  confidentiality: string;
  expires_at: string | null;
};

export const metadata = { title: "Warrants" };

export default async function AdminWarrantsPage({ searchParams }: { searchParams: Promise<{ created?: string; error?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from("roleplay_warrants").select("id,warrant_number,warrant_type,target_description,status,confidentiality,expires_at").order("created_at", { ascending: false }).limit(25)
    : { data: null };
  const rows: DbWarrant[] = data ?? demoWarrants.map((item) => ({
    id: item.id,
    warrant_number: item.number,
    warrant_type: item.type,
    target_description: item.target,
    status: item.status,
    confidentiality: item.public ? "public" : "reserved",
    expires_at: item.expires,
  }));

  return (
    <>
      <AdminPageHeader title="Warrants roleplay" description="Creación y seguimiento de órdenes ficticias vinculadas a expedientes." />
      {query.created && <p className="mb-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Warrant creado correctamente.</p>}
      {query.error && <p className="mb-5 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">{query.error}</p>}
      <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-[#153553]"><ScrollText className="size-4" /> Crear warrant</CardTitle></CardHeader>
          <CardContent>
            <form action={createRoleplayWarrant} className="grid gap-4">
              <Field label="Número único" name="warrant_number" placeholder="RP-WR-2026-00017" />
              <Field label="Tipo" name="warrant_type" placeholder="Search warrant roleplay" />
              <Field label="ID de expediente relacionado (opcional)" name="case_id" required={false} />
              <div className="space-y-2"><Label htmlFor="target_description">Persona, lugar u objeto relacionado</Label><Textarea id="target_description" name="target_description" required /></div>
              <div className="space-y-2"><Label htmlFor="reason">Motivo</Label><Textarea id="reason" name="reason" required /></div>
              <div className="space-y-2"><Label htmlFor="legal_basis">Fundamentos roleplay</Label><Textarea id="legal_basis" name="legal_basis" required /></div>
              <Field label="Fecha de expiración" name="expires_at" type="datetime-local" required={false} />
              <div className="space-y-2">
                <Label htmlFor="confidentiality">Confidencialidad</Label>
                <select id="confidentiality" name="confidentiality" className="h-10 w-full rounded-md border px-3 text-sm" defaultValue="internal">
                  <option value="public">Público</option>
                  <option value="internal">Interno</option>
                  <option value="reserved">Reservado</option>
                  <option value="confidential">Confidencial</option>
                </select>
              </div>
              <div className="space-y-2"><Label htmlFor="observations">Observaciones</Label><Textarea id="observations" name="observations" /></div>
              <Button type="submit" className="bg-[#153b5c]">Crear warrant ficticio</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-[#153553]">Últimos warrants</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {rows.map((item) => (
              <article key={item.id} className="rounded border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="mono-number text-xs font-semibold text-[#9a752f]">{item.warrant_number}</p>
                    <h2 className="mt-1 text-sm font-semibold text-[#153553]">{item.warrant_type}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{item.target_description}</p>
                  </div>
                  <div className="flex gap-2"><Badge variant="outline">{item.status}</Badge><Badge>{item.confidentiality}</Badge></div>
                </div>
                <p className="mt-3 border-t pt-3 text-[11px] font-semibold uppercase tracking-wide text-red-800">ROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.</p>
              </article>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, name, type = "text", placeholder, required = true }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} placeholder={placeholder} required={required} /></div>;
}
