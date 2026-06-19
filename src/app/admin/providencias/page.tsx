import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseStatusBadge } from "@/components/status-badges";
import { requireInternalUser } from "@/lib/auth/authorization";
import { formatDate } from "@/lib/demo-data";
export default async function AdminProceedingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ supabase }, query] = await Promise.all([requireInternalUser(), searchParams]);
  const { data, error } = await supabase.from("proceedings").select("id,providence_number,title,type,chamber,status,created_at,case:cases(internal_number)").order("created_at", { ascending: false });
  return <><AdminPageHeader title="Providencias" description="Redacción, revisión, firma y publicación sobre Supabase." action={<Button asChild className="bg-[#153b5c]"><Link href="/admin/providencias/nueva"><Plus className="size-4" /> Nueva providencia</Link></Button>} /><ActionMessage error={query.error ?? error?.message} success={query.success} /><div className="overflow-x-auto rounded-lg border bg-white"><Table><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Tipo / título</TableHead><TableHead>Expediente</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader><TableBody>{(data ?? []).map((p) => <TableRow key={p.id}><TableCell className="mono-number text-xs">{p.providence_number}</TableCell><TableCell><p className="font-semibold">{p.title}</p><p className="text-xs text-muted-foreground">{p.type} · {p.chamber}</p></TableCell><TableCell className="mono-number text-xs">{p.case?.[0]?.internal_number}</TableCell><TableCell className="text-xs">{formatDate(p.created_at)}</TableCell><TableCell><CaseStatusBadge status={p.status} /></TableCell><TableCell><Button asChild size="icon" variant="ghost"><Link href={`/admin/providencias/${p.id}`}><Eye className="size-4" /></Link></Button></TableCell></TableRow>)}</TableBody></Table>{!data?.length && <p className="p-8 text-center text-sm text-muted-foreground">No hay providencias.</p>}</div></>;
}
