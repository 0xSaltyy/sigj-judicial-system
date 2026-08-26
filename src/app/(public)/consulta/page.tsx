import { PageHero } from "@/components/page-hero";
import { PublicCaseSearch } from "@/components/public-case-search";
export const metadata = { title: "Consulta de expedientes" };
export default function ConsultaPage() { return <><PageHero title="Consulta de expedientes" description="Verifique el estado y las actuaciones públicas de un expediente judicial simulado." /><div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16"><PublicCaseSearch /></div></>; }
