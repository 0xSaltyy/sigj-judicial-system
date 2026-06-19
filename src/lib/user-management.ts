export const APP_ROLES = [
  "SUPER_ADMIN",
  "ADMIN_INSTITUCIONAL",
  "MAGISTRADO_CORTE_SUPREMA",
  "MAGISTRADO_TRIBUNAL",
  "JUEZ_CIRCUITO",
  "JUEZ_MUNICIPAL",
  "SECRETARIO_GENERAL",
  "SECRETARIO_DESPACHO",
  "OFICIAL_MAYOR",
  "RADICADOR",
  "REPARTO",
  "ARCHIVO",
  "GOBERNACION_COMUNICACIONES",
  "CONSULTA_PUBLICA",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_DESCRIPTIONS: Record<AppRole, { label: string; scope: string; permissions: string[] }> = {
  SUPER_ADMIN: { label: "Superadministración", scope: "Configuración global; el propietario es la única cuenta que administra usuarios.", permissions: ["Configuración global", "Auditoría", "Administración de usuarios si es propietario"] },
  ADMIN_INSTITUCIONAL: { label: "Administración institucional", scope: "Operación de una institución sin acceso a cuentas ni al propietario.", permissions: ["Panel institucional", "Consulta de expedientes asignados", "Configuración operativa local"] },
  MAGISTRADO_CORTE_SUPREMA: { label: "Magistratura de Corte Suprema", scope: "Casación, revisión, tutelas contra providencias y conflictos de competencia.", permissions: ["Providencias de Corte", "Revisión y casación", "Expedientes de su institución"] },
  MAGISTRADO_TRIBUNAL: { label: "Magistratura de Tribunal", scope: "Segunda instancia, apelaciones y salas especializadas.", permissions: ["Providencias del Tribunal", "Apelaciones", "Expedientes de su sala"] },
  JUEZ_CIRCUITO: { label: "Juez de Circuito", scope: "Primera instancia de mayor competencia y tutelas.", permissions: ["Actuaciones del despacho", "Audiencias", "Providencias"] },
  JUEZ_MUNICIPAL: { label: "Juez Municipal", scope: "Asuntos locales, pequeñas causas y primeras actuaciones.", permissions: ["Actuaciones del despacho", "Audiencias", "Providencias"] },
  SECRETARIO_GENERAL: { label: "Secretaría General", scope: "Estados, certificaciones, notificaciones y coordinación secretarial.", permissions: ["Estados", "Constancias", "Notificaciones"] },
  SECRETARIO_DESPACHO: { label: "Secretaría de Despacho", scope: "Trámite secretarial del despacho asignado.", permissions: ["Actuaciones", "Estados del despacho", "Constancias"] },
  OFICIAL_MAYOR: { label: "Oficial Mayor", scope: "Apoyo procesal y control documental de la dependencia.", permissions: ["Actuaciones", "Documentos internos", "Consulta institucional"] },
  RADICADOR: { label: "Radicación", scope: "Recepción, validación y creación del radicado.", permissions: ["Radicar expedientes", "Validar anexos", "Generar constancias"] },
  REPARTO: { label: "Reparto", scope: "Asignación manual o automática a despachos competentes.", permissions: ["Cola de reparto", "Asignación de despacho", "Constancias de reparto"] },
  ARCHIVO: { label: "Archivo Judicial", scope: "Cierre, transferencia y custodia de expedientes.", permissions: ["Consulta archivística", "Cierre y archivo", "Control de préstamos"] },
  GOBERNACION_COMUNICACIONES: { label: "Gobernación — comunicaciones", scope: "Autoridad externa limitada a comunicaciones y avisos ejecutivos.", permissions: ["Comunicados autorizados", "Avisos ejecutivos", "Sin funciones jurisdiccionales"] },
  CONSULTA_PUBLICA: { label: "Consulta interna limitada", scope: "Lectura de información expresamente autorizada.", permissions: ["Consulta de expedientes permitidos", "Sin mutaciones"] },
};

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "••••••••";
  const [domainName, ...suffixParts] = domain.split(".");
  const suffix = suffixParts.length ? `.${suffixParts.join(".")}` : "";
  return `${local.slice(0, 1)}${"•".repeat(Math.max(5, local.length - 1))}@${domainName.slice(0, 1)}${"•".repeat(Math.max(4, domainName.length - 1))}${suffix}`;
}
