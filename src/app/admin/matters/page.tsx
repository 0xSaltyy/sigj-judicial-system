import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Plus } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

export const metadata = { title: "DOJ Matters" };

type MatterRow = {
  id: string;
  matter_number: string;
  title: string;
  matter_category: string | null;
  matter_type: string;
  lead_component: string | null;
  investigating_agency: string | null;
  status: string;
  security_classification: string;
  opened_at: string;
  archived_at: string | null;
};

export default async function MattersPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase
    .from("matters")
    .select("id,matter_number,title,matter_category,matter_type,lead_component,investigating_agency,status,security_classification,opened_at,archived_at")
    .order("created_at", { ascending: false })
    .limit(50) : { data: null };
  const rows = (data ?? []) as MatterRow[];

  return (
    <>
      <AdminPageHeader
        title="DOJ Matters"
        description="Trabajo interno del Department of Justice separado de los Cases presentados ante tribunales federales."
        action={<Button asChild className="gap-2 bg-[#153b5c]"><Link href="/admin/expedientes/nuevo"><Plus className="size-4" /> Abrir Matter</Link></Button>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No hay Matters registrados" description="Abra el primer Matter interno para registrar investigaciones, evaluaciones, referrals o trámites administrativos." icon={<BriefcaseBusiness className="size-6" />} />
      ) : (
        <div className="grid gap-4">
          {rows.map((matter) => (
            <Card key={matter.id} className="overflow-hidden">
              <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="mono-number text-xs font-semibold text-[#005ea8]">{matter.matter_number}</p>
                    <Badge variant="outline" className="bg-slate-50">{matter.status}</Badge>
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">{matter.security_classification}</Badge>
                  </div>
                  <h2 className="mt-2 font-serif text-xl font-semibold text-[#102d49]">{matter.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{matter.matter_category || matter.matter_type} · {matter.lead_component || "Lead component pending"} · {matter.investigating_agency || "No agency recorded"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Opened {formatDate(matter.opened_at)}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button asChild variant="outline" className="gap-2">
                    <Link href={`/admin/matters/${matter.id}`}>Ver Matter <ArrowRight className="size-4" /></Link>
                  </Button>
                  <LifecycleActions resource="matters" id={matter.id} archived={Boolean(matter.archived_at)} compact />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
