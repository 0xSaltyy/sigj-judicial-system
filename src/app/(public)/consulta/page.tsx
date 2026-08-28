import { PageHero } from "@/components/page-hero";
import { PublicCaseSearch } from "@/components/public-case-search";
export const metadata = { title: "Consulta de Federal Cases" };
export default function ConsultaPage() { return <><PageHero title="Consulta de Federal Cases" description="Verifique el estado público, Docket Number y eventos públicos de un Case federal." /><div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16"><PublicCaseSearch /></div></>; }
