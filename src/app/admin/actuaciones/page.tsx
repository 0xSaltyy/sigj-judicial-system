import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireInternalUser } from "@/lib/auth/authorization";
import { formatDate } from "@/lib/demo-data";
export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ supabase }, query] = await Promise.all([requireInternalUser(), searchParams]);
  const { data, error } = await supabase.from("case_actions").select("id,action_date,action_type,title,description,visibility,case_id,case:cases(internal_number)").order("action_date", { ascending: false }).limit(200);
  return <><AdminPageHeader title="Actuaciones procesales" description="Registro cronológico real de los expedientes." action={<Button asChild className="bg-[#153b5c]"><Link href="/admin/actuaciones/nueva"><Plus className="size-4" /> Nueva actuación</Link></Button>} /><ActionMessage error={query.error ?? error?.message} success={query.success} /><div className="overflow-x-auto rounded-lg border bg-white"><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Actuación</TableHead><TableHead>Expediente</TableHead><TableHead>Visibilidad</TableHead></TableRow></TableHeader><TableBody>{(data ?? []).map((a) => <TableRow key={a.id}><TableCell className="text-xs">{formatDate(a.action_date)}</TableCell><TableCell><p className="font-semibold">{a.title}</p><p className="text-xs text-muted-foreground">{a.action_type} · {a.description}</p></TableCell><TableCell><Link className="mono-number text-xs text-[#153b5c] hover:underline" href={`/admin/expedientes/${a.case_id}`}>{a.case?.[0]?.internal_number}</Link></TableCell><TableCell><Badge variant="outline">{a.visibility}</Badge></TableCell></TableRow>)}</TableBody></Table>{!data?.length && <p className="p-8 text-center text-sm text-muted-foreground">No hay actuaciones.</p>}</div></>;
}
