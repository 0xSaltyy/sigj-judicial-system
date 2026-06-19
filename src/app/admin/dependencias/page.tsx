import { Building2, GitBranch } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page";
import { Badge } from "@/components/ui/badge";
import { institutions } from "@/lib/demo-data";

export default function DependenciesPage() {
  return <><AdminPageHeader title="Instituciones y competencias" description="Cortes, tribunales, juzgados, salas, secretarías y oficinas que operan dentro del Palacio Judicial ficticio." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{institutions.map((institution) => <article key={institution.code} className="rounded-lg border bg-white p-5"><div className="flex items-start justify-between"><div className="grid size-10 place-items-center rounded bg-[#edf2f6] text-[#183d61]"><Building2 className="size-5" /></div><div className="flex gap-2"><Badge variant="outline" className="mono-number">{institution.code}</Badge><Badge className="bg-emerald-50 text-emerald-800">Activa</Badge></div></div><h2 className="mt-4 text-sm font-semibold text-[#153553]">{institution.name}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{institution.competence}</p><div className="mt-4 flex gap-2 rounded border bg-slate-50 p-3"><GitBranch className="mt-0.5 size-4 shrink-0 text-[#8b6829]" /><p className="text-xs leading-5 text-slate-700">{institution.workflow}</p></div></article>)}</div></>;
}
