import { AdminRouteLoading } from "@/components/loading-states";

export default function VoteAnalysisLoading() {
  return <AdminRouteLoading title="Analizando votos…" detail="Buscando señales sospechosas sin modificar datos." />;
}
