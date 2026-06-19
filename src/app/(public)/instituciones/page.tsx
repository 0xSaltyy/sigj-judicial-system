import { Building2, GitBranch } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { institutions } from "@/lib/demo-data";

export const metadata = { title: "Instituciones y competencias" };

export default function InstitutionsPage() {
  return <>
    <PageHero eyebrow="Palacio Judicial" title="Instituciones, cortes y oficinas" description="Estructura ficticia multiinstitucional con competencias y flujos diferenciados." />
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{institutions.map((institution) => <Card key={institution.code}><CardHeader><div className="flex items-start justify-between gap-3"><div className="grid size-10 place-items-center rounded bg-[#edf2f6] text-[#183d61]"><Building2 className="size-5" /></div><Badge variant="outline" className="mono-number">{institution.code}</Badge></div><CardTitle className="pt-3 text-base text-[#153553]">{institution.name}</CardTitle><Badge className="w-fit bg-slate-100 text-slate-700">{institution.type}</Badge></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{institution.competence}</p><div className="mt-4 flex gap-2 rounded border bg-slate-50 p-3"><GitBranch className="mt-0.5 size-4 shrink-0 text-[#8b6829]" /><p className="text-xs leading-5 text-slate-700">{institution.workflow}</p></div></CardContent></Card>)}</div></div>
  </>;
}
