import type { Metadata } from "next";
import { ApplicationStatusLookup } from "@/components/application-status-lookup";
import { PageHero } from "@/components/page-hero";
export const metadata:Metadata={title:"Consultar estado de postulación",robots:{index:false,follow:false}};
export default function ApplicationStatusPage(){return <><PageHero title="Estado de postulación" description="Consulta privada mediante código de seguimiento y correo."/><main className="mx-auto max-w-6xl px-4 py-10"><ApplicationStatusLookup/></main></>}
