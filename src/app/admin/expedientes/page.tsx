import Link from "next/link";
import { Eye, Filter, FolderKanban, Plus } from "lucide-react";
import { AdminPageHeader, EmptyState } from "@/components/admin-page";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseStatusBadge, ConfidentialityBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/display";

export const metadata = { title: "Federal Cases" };

type CaseRow = {
  id: string;
  case_number: string | null;
  docket_number: string | null;
  internal_number: string;
  title: string;
  case_caption: string | null;
  case_category: string;
  status: string;
  federal_access_level: string;
  confidentiality_level: string;
  filed_at: string;
  archived_at: string | null;
  federal_courts: { official_name: string; abbreviation: string } | { official_name: string; abbreviation: string }[] | null;
};

export default async function CasesPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase
    .from("cases")
    .select("id,case_number,docket_number,internal_number,title,case_caption,case_category,status,federal_access_level,confidentiality_level,filed_at,archived_at,federal_courts(official_name,abbreviation)")
    .order("created_at", { ascending: false })
    .limit(50) : { data: null };
  const rows = (data ?? []) as CaseRow[];

  return (
    <>
      <AdminPageHeader
        title="Federal Cases"
        description="Cases presentados ante tribunales federales. El Case Number del portal y el Docket Number del tribunal se mantienen separados."
        action={<Button asChild className="gap-2 bg-[#153b5c]"><Link href="/admin/expedientes/nuevo"><Plus className="size-4" /> Abrir Matter o Case</Link></Button>}
      />
      <div className="rounded-lg border bg-white">
        <div className="grid gap-3 border-b p-4 md:grid-cols-[1.5fr_repeat(3,1fr)_auto]">
          <Input placeholder="Buscar por Case Number, Docket Number, caption o participante…" />
          <FilterSelect placeholder="Court" values={["District Court", "Court of Appeals", "Supreme Court", "Bankruptcy Court"]} />
          <FilterSelect placeholder="Case Category" values={["Civil", "Criminal", "Magistrate", "Miscellaneous", "Appeal"]} />
          <FilterSelect placeholder="Access" values={["Public", "Restricted", "Sealed", "Grand-jury restricted", "Internal DOJ only"]} />
          <Button variant="outline" className="gap-2"><Filter className="size-4" /> Filtrar</Button>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No hay Federal Cases registrados" description="Abra un Matter interno o un Case judicial federal desde el flujo guiado." icon={<FolderKanban className="size-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Case Number</TableHead>
                  <TableHead>Caption / title</TableHead>
                  <TableHead>Court</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => {
                  const displayCaseNumber = item.case_number || item.internal_number;
                  const court = Array.isArray(item.federal_courts) ? item.federal_courts[0] : item.federal_courts;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link href={`/admin/expedientes/${item.id}`} className="mono-number text-xs font-semibold text-[#153b5c] hover:underline">{displayCaseNumber}</Link>
                        <p className="mono-number mt-1 text-[10px] text-muted-foreground">{item.docket_number || "No Docket Number"}</p>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="truncate text-sm font-medium text-[#153553]">{item.case_caption || item.title}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{item.title}</p>
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs">
                        <p className="truncate">{court?.abbreviation || "Court pending"}</p>
                        <p className="mt-1 truncate text-muted-foreground">{court?.official_name}</p>
                      </TableCell>
                      <TableCell className="text-xs">{item.case_category}</TableCell>
                      <TableCell><CaseStatusBadge status={item.status} /></TableCell>
                      <TableCell><ConfidentialityBadge level={item.federal_access_level || item.confidentiality_level} /></TableCell>
                      <TableCell className="text-xs">{formatDate(item.filed_at)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="ghost" size="icon"><Link href={`/admin/expedientes/${item.id}`} aria-label={`Ver ${displayCaseNumber}`}><Eye className="size-4" /></Link></Button>
                          <LifecycleActions resource="cases" id={item.id} archived={Boolean(item.archived_at)} compact />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}

function FilterSelect({ placeholder, values }: { placeholder: string; values: string[] }) {
  return <Select><SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{values.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>;
}
