import { Building2, Plus } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

type DependencyRow = { id: string; name: string; code: string; type: string; department: string; municipality: string; is_active: boolean; archived_at: string | null };

export default async function DependenciesPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("dependencies").select("id,name,code,type,department,municipality,is_active,archived_at").order("name").limit(100) : { data: null };
  const dependencies = (data ?? []) as DependencyRow[];
  return <><AdminPageHeader title="Dependencias" description="Estructura organizacional de divisiones, oficinas y unidades del Department of Justice." action={<Button className="gap-2 bg-[#153b5c]"><Plus className="size-4" /> Nueva dependencia</Button>} />{dependencies.length === 0 ? <EmptyState title="No hay dependencias registradas" description="Cree unidades institucionales para asignar usuarios y expedientes." icon={<Building2 className="size-6" />} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{dependencies.map((item) => <article key={item.id} className="rounded-lg border bg-white p-5"><div className="flex items-start justify-between"><div className="grid size-10 place-items-center rounded bg-[#edf2f6] text-[#183d61]"><Building2 className="size-5" /></div><Badge className={item.is_active && !item.archived_at ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}>{item.is_active && !item.archived_at ? "Activa" : "Archivada"}</Badge></div><h2 className="mt-4 text-sm font-semibold text-[#153553]">{item.name}</h2><p className="mono-number mt-2 text-xs text-muted-foreground">Código: {item.code}</p><p className="mt-1 text-xs text-muted-foreground">{item.type} · {item.department} · {item.municipality}</p></article>)}</div>}</>;
}
