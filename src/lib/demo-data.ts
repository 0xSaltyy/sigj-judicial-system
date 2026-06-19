export type CaseRecord = {
  id: string; internalNumber: string; judicialNumber: string; title: string; chamber: string;
  processType: string; processSubtype: string; status: string; court: string; filedAt: string;
  claimant: string; defendant: string; judge: string; confidentiality: "Público" | "Reservado" | "Confidencial";
  summary: string; publicVisibility: boolean;
};

export const cases: CaseRecord[] = [
  { id: "penal-000001", internalNumber: "TSJ-SP-2026-000001", judicialNumber: "11001-31-03-001-2026-00001-00", title: "Revisión de medida procesal simulada", chamber: "Sala Penal", processType: "Penal", processSubtype: "Apelación", status: "Auto de avocamiento", court: "Tribunal Superior · Sala Penal", filedAt: "2026-05-14", claimant: "Parte solicitante A.", defendant: "Parte convocada B.", judge: "Magistratura 02", confidentiality: "Público", summary: "Recurso de apelación dentro de una actuación penal enteramente ficticia.", publicVisibility: true },
  { id: "civil-000002", internalNumber: "TSJ-SC-2026-000002", judicialNumber: "11001-31-03-002-2026-00002-00", title: "Proceso declarativo de responsabilidad simulado", chamber: "Sala Civil", processType: "Civil", processSubtype: "Declarativo", status: "Pruebas decretadas", court: "Tribunal Superior · Sala Civil", filedAt: "2026-04-28", claimant: "Comercial Ejemplo S.A.S.", defendant: "Servicios Demostrativos S.A.S.", judge: "Magistratura 05", confidentiality: "Público", summary: "Controversia demostrativa de responsabilidad contractual.", publicVisibility: true },
  { id: "admin-000003", internalNumber: "TSJ-SA-2026-000003", judicialNumber: "11001-33-01-001-2026-00003-00", title: "Control de legalidad administrativo simulado", chamber: "Sala Administrativa", processType: "Administrativo", processSubtype: "Control de legalidad", status: "En reparto", court: "Tribunal Superior · Sala Administrativa", filedAt: "2026-06-02", claimant: "Solicitante reservado", defendant: "Entidad administrativa ficticia", judge: "Pendiente de reparto", confidentiality: "Reservado", summary: "Asunto administrativo sujeto a reserva demostrativa.", publicVisibility: false },
  { id: "laboral-000004", internalNumber: "TSJ-SL-2026-000004", judicialNumber: "11001-31-05-001-2026-00004-00", title: "Proceso laboral ordinario simulado", chamber: "Sala Laboral", processType: "Laboral", processSubtype: "Apelación", status: "Audiencia programada", court: "Tribunal Superior · Sala Laboral", filedAt: "2026-05-20", claimant: "Persona trabajadora C.", defendant: "Empresa Modelo S.A.S.", judge: "Magistratura 07", confidentiality: "Público", summary: "Controversia laboral de carácter exclusivamente demostrativo.", publicVisibility: true },
];

export const actions = [
  { id: "a1", caseId: "penal-000001", type: "Auto de avocamiento", title: "Despacho avoca conocimiento", description: "Se avoca conocimiento del recurso y se ordena comunicar a las partes.", date: "2026-06-16", visibility: "Pública", user: "Secretaría Sala Penal" },
  { id: "a2", caseId: "civil-000002", type: "Decreto de pruebas", title: "Pruebas documentales decretadas", description: "Se incorporan los documentos allegados oportunamente al expediente.", date: "2026-06-14", visibility: "Pública", user: "Magistratura 05" },
  { id: "a3", caseId: "laboral-000004", type: "Fijación de audiencia", title: "Audiencia de instrucción programada", description: "Se fija audiencia pública para el 24 de junio de 2026.", date: "2026-06-12", visibility: "Pública", user: "Secretaría Sala Laboral" },
  { id: "a4", caseId: "admin-000003", type: "Reparto", title: "Turno para reparto", description: "Expediente disponible para asignación interna.", date: "2026-06-10", visibility: "Interna", user: "Oficina de Reparto" },
];

export const hearings = [
  { id: "h1", date: "24 JUN", time: "09:00", iso: "2026-06-24T09:00:00", title: "Audiencia de instrucción", type: "Instrucción", room: "Sala virtual 3", court: "Sala Laboral", caseNumber: "TSJ-SL-2026-000004", status: "Programada", public: true },
  { id: "h2", date: "26 JUN", time: "10:30", iso: "2026-06-26T10:30:00", title: "Audiencia inicial", type: "Inicial", room: "Sala 201", court: "Juzgado Primero Civil", caseNumber: "11001-31-03-001-2026-00018-00", status: "Programada", public: true },
  { id: "h3", date: "30 JUN", time: "14:00", iso: "2026-06-30T14:00:00", title: "Lectura de decisión", type: "Lectura de fallo", room: "Auditorio de sesiones", court: "Sala Penal", caseNumber: "TSJ-SP-2026-000011", status: "Programada", public: true },
  { id: "h4", date: "18 JUN", time: "08:30", iso: "2026-06-18T08:30:00", title: "Audiencia de conciliación", type: "Conciliación", room: "Sala 104", court: "Sala Civil", caseNumber: "TSJ-SC-2026-000008", status: "Realizada", public: true },
];

export const notices = [
  { slug: "jornada-servicios-digitales-junio", title: "Jornada de servicios digitales durante el cierre de junio", excerpt: "Se informa el horario especial de atención y recepción electrónica de memoriales.", category: "Institucional", entity: "Secretaría General", date: "2026-06-17", featured: true },
  { slug: "mantenimiento-programado-plataforma", title: "Mantenimiento programado de la plataforma demostrativa", excerpt: "La consulta pública tendrá una ventana de mantenimiento el sábado 27 de junio.", category: "Mantenimiento", entity: "Gobernación Judicial Administrativa", date: "2026-06-15", featured: false },
  { slug: "orientaciones-audiencias-publicas", title: "Orientaciones para el ingreso a audiencias públicas", excerpt: "Recomendaciones de acceso, identificación y conducta para sesiones abiertas.", category: "Aviso público", entity: "Presidencia del Tribunal", date: "2026-06-11", featured: false },
];

export const proceedings = [
  { id: "p1", number: "SP-AV-018-2026", title: "Auto de avocamiento", type: "Auto de avocamiento", chamber: "Sala Penal", judge: "Magistratura 02", date: "2026-06-16", caseNumber: "TSJ-SP-2026-000001", status: "Publicado" },
  { id: "p2", number: "SC-PR-041-2026", title: "Auto que decreta pruebas", type: "Auto interlocutorio", chamber: "Sala Civil", judge: "Magistratura 05", date: "2026-06-14", caseNumber: "TSJ-SC-2026-000002", status: "Publicado" },
  { id: "p3", number: "SL-SEN-012-2026", title: "Sentencia de segunda instancia", type: "Sentencia", chamber: "Sala Laboral", judge: "Magistratura 07", date: "2026-06-06", caseNumber: "TSJ-SL-2026-000009", status: "Publicado" },
];

export const judicialStates = [
  { id: "e1", number: "EST-SP-094-2026", date: "2026-06-18", court: "Sala Penal", items: 8, status: "Publicado" },
  { id: "e2", number: "EST-SC-071-2026", date: "2026-06-18", court: "Sala Civil", items: 11, status: "Publicado" },
  { id: "e3", number: "EST-SL-063-2026", date: "2026-06-17", court: "Sala Laboral", items: 6, status: "Publicado" },
  { id: "e4", number: "EST-JC1-102-2026", date: "2026-06-17", court: "Juzgado Primero Civil", items: 14, status: "Publicado" },
];

export const dependencies = ["Tribunal Superior de Justicia de la República Judicial", "Sala Penal", "Sala Civil", "Sala Laboral", "Sala Administrativa", "Juzgado Primero Civil del Circuito", "Juzgado Segundo Penal del Circuito", "Secretaría General", "Relatoría", "Gobernación Judicial Administrativa"];

export const templates: Record<string, string> = {
  "Auto de avocamiento": "# TRIBUNAL SUPERIOR DE JUSTICIA\n\n**Radicado:** {{radicado}}  \n**Sala:** {{sala}}  \n**Magistratura:** {{ponente}}\n\n## ASUNTO\nAuto por medio del cual se avoca conocimiento.\n\n## ANTECEDENTES\n[Describa los antecedentes relevantes]\n\n## CONSIDERACIONES\n### Competencia\n[Fundamentos de competencia]\n\n## RESUELVE\n**PRIMERO.** AVOCAR el conocimiento del asunto de la referencia.\n\n**SEGUNDO.** Por Secretaría, comuníquese esta decisión.\n\nNotifíquese y cúmplase.",
  "Decreto de pruebas": "# AUTO DE APERTURA DE INSTRUCCIÓN Y DECRETO DE PRUEBAS\n\n## Identificación del expediente\n{{radicado}}\n\n## Antecedentes\n[Antecedentes]\n\n## Fundamentos de competencia\n[Fundamentos]\n\n## Consideraciones\n[Consideraciones]\n\n## Decreto de pruebas\n1. Ténganse como pruebas los documentos aportados.\n2. Ofíciese a [dependencia].\n\n## Órdenes a Secretaría\nLíbrense las comunicaciones correspondientes.\n\n## RESUELVE\nNotifíquese y cúmplase.",
  "Sentencia": "# SENTENCIA\n\n**Radicado:** {{radicado}}\n\n## I. ANTECEDENTES\n[Antecedentes]\n\n## II. PROBLEMA JURÍDICO\n[Problema jurídico]\n\n## III. CONSIDERACIONES\n[Consideraciones]\n\n## IV. ANÁLISIS DEL CASO CONCRETO\n[Análisis]\n\n## V. DECISIÓN\nEn mérito de lo expuesto, esta Sala...\n\n## FALLA\n**PRIMERO.** [Decisión]\n\nNotifíquese y cúmplase.",
  "Acta de audiencia": "# ACTA DE AUDIENCIA\n\n**Fecha y hora:** {{fecha}}  \n**Radicado:** {{radicado}}  \n**Despacho:** {{despacho}}\n\n## Intervinientes\n- [Nombre y calidad]\n\n## Desarrollo\n[Registro de la sesión]\n\n## Decisiones adoptadas\n[Decisiones]\n\n## Constancias\n[Constancias]\n\n## Cierre\nSe da por terminada la audiencia.",
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
