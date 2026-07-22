import { AdminRouteLoading } from "@/components/loading-states";

export default function ElectionResultsLoading() {
  return <AdminRouteLoading title="Actualizando resultados…" detail="Calculando conteo electoral y publicaciones." />;
}
