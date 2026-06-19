export const templates: Record<string, string> = {
  "Auto de avocamiento": "# TRIBUNAL SUPERIOR DE JUSTICIA\n\n**Radicado:** {{radicado}}  \n**Sala:** {{sala}}  \n**Magistratura:** {{ponente}}\n\n## ASUNTO\nAuto por medio del cual se avoca conocimiento.\n\n## ANTECEDENTES\n[Describa los antecedentes relevantes]\n\n## CONSIDERACIONES\n### Competencia\n[Fundamentos de competencia]\n\n## RESUELVE\n**PRIMERO.** AVOCAR el conocimiento del asunto de la referencia.\n\n**SEGUNDO.** Por Secretaría, comuníquese esta decisión.\n\nNotifíquese y cúmplase.",
  "Decreto de pruebas": "# AUTO DE APERTURA DE INSTRUCCIÓN Y DECRETO DE PRUEBAS\n\n## Identificación del expediente\n{{radicado}}\n\n## Antecedentes\n[Antecedentes]\n\n## Fundamentos de competencia\n[Fundamentos]\n\n## Consideraciones\n[Consideraciones]\n\n## Decreto de pruebas\n1. Ténganse como pruebas los documentos aportados.\n2. Ofíciese a [dependencia].\n\n## Órdenes a Secretaría\nLíbrense las comunicaciones correspondientes.\n\n## RESUELVE\nNotifíquese y cúmplase.",
  "Sentencia": "# SENTENCIA\n\n**Radicado:** {{radicado}}\n\n## I. ANTECEDENTES\n[Antecedentes]\n\n## II. PROBLEMA JURÍDICO\n[Problema jurídico]\n\n## III. CONSIDERACIONES\n[Consideraciones]\n\n## IV. ANÁLISIS DEL CASO CONCRETO\n[Análisis]\n\n## V. DECISIÓN\nEn mérito de lo expuesto, esta Sala...\n\n## FALLA\n**PRIMERO.** [Decisión]\n\nNotifíquese y cúmplase.",
  "Acta de audiencia": "# ACTA DE AUDIENCIA\n\n**Fecha y hora:** {{fecha}}  \n**Radicado:** {{radicado}}  \n**Despacho:** {{despacho}}\n\n## Intervinientes\n- [Nombre y calidad]\n\n## Desarrollo\n[Registro de la sesión]\n\n## Decisiones adoptadas\n[Decisiones]\n\n## Constancias\n[Constancias]\n\n## Cierre\nSe da por terminada la audiencia.",
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
