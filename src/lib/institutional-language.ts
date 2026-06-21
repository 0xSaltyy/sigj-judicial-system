import type { AppRole } from "@/lib/user-management";

export const LOCAL_JURISDICTION_DEFAULT = "Circuitos judiciales del Valle del Cauca";

export function defaultJurisdiction(type?: string | null, name?: string | null) {
  const value = `${type || ""} ${name || ""}`.toLowerCase();
  if (value.includes("corte suprema") || value.includes("corte")) return "Jurisdicción nacional";
  if (value.includes("tribunal") || value.includes("sala")) return "Distrito judicial correspondiente";
  if (value.includes("juzgado") || value.includes("despacho") || value.includes("circuito") || !value.trim()) return LOCAL_JURISDICTION_DEFAULT;
  return "Sin definir";
}

export function judicialResponsibilityLabel(role?: AppRole | string | null, context?: string | null) {
  if (role === "MAGISTRADO_CORTE_SUPREMA" || role === "MAGISTRADO_TRIBUNAL") return "Magistrado/a del despacho";
  if (role === "JUEZ_CIRCUITO" || role === "JUEZ_MUNICIPAL") return "Juez del despacho";
  const value = (context || "").toLowerCase();
  if (value.includes("corte") || value.includes("tribunal") || value.includes("sala")) return "Magistrado/a del despacho";
  if (value.includes("juzgado") || value.includes("despacho")) return "Juez del despacho";
  if (value.includes("oficina")) return "Responsable de oficina";
  return "Responsable de dependencia";
}
