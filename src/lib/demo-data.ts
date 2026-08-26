export const ROLEPLAY_NOTICE =
  "ROLEPLAY WEBSITE — This website is fictional and is not affiliated with the real United States Department of Justice.";

export type CaseRecord = {
  id: string;
  internalNumber: string;
  judicialNumber: string;
  title: string;
  chamber: string;
  processType: string;
  processSubtype: string;
  status: string;
  court: string;
  filedAt: string;
  claimant: string;
  defendant: string;
  judge: string;
  confidentiality: "Público" | "Reservado" | "Confidencial";
  summary: string;
  publicVisibility: boolean;
};

export const cases: CaseRecord[] = [
  {
    id: "crim-000001",
    internalNumber: "DOJ-RP-CR-2026-000001",
    judicialNumber: "RP-DC-001-2026-00001",
    title: "Investigación ficticia por fraude financiero organizado",
    chamber: "Division of Criminal Roleplay",
    processType: "Penal roleplay",
    processSubtype: "Investigación",
    status: "En investigación",
    court: "Roleplay District Court · Criminal Docket",
    filedAt: "2026-05-14",
    claimant: "Office of the Roleplay Prosecutor",
    defendant: "Red Mercury Group",
    judge: "Juez Harper Vale",
    confidentiality: "Público",
    summary: "Expediente de roleplay sobre una red financiera ficticia dentro de una comunidad narrativa.",
    publicVisibility: true,
  },
  {
    id: "civil-000002",
    internalNumber: "DOJ-RP-CV-2026-000002",
    judicialNumber: "RP-DC-002-2026-00002",
    title: "Acción civil ficticia por incumplimiento contractual",
    chamber: "Civil Roleplay Division",
    processType: "Civil roleplay",
    processSubtype: "Declarativo",
    status: "Pendiente",
    court: "Roleplay District Court · Civil Docket",
    filedAt: "2026-04-28",
    claimant: "Liberty Harbor Logistics",
    defendant: "Northline Services RP",
    judge: "Jueza Amelia Knox",
    confidentiality: "Público",
    summary: "Controversia contractual simulada para prácticas de litigación dentro del roleplay.",
    publicVisibility: true,
  },
  {
    id: "admin-000003",
    internalNumber: "DOJ-RP-IA-2026-000003",
    judicialNumber: "RP-IA-001-2026-00003",
    title: "Revisión interna ficticia de cumplimiento operativo",
    chamber: "Office of Professional Standards RP",
    processType: "Administrativo roleplay",
    processSubtype: "Control interno",
    status: "Reservado",
    court: "Internal Review Board",
    filedAt: "2026-06-02",
    claimant: "Inspectoría Roleplay",
    defendant: "Unidad operativa ficticia",
    judge: "Panel interno",
    confidentiality: "Reservado",
    summary: "Asunto reservado de demostración. No se expone información sensible en el portal público.",
    publicVisibility: false,
  },
  {
    id: "warrant-000004",
    internalNumber: "DOJ-RP-WR-2026-000004",
    judicialNumber: "RP-WR-003-2026-00004",
    title: "Solicitud ficticia de orden de registro",
    chamber: "Warrants & Orders Unit",
    processType: "Orden roleplay",
    processSubtype: "Warrant",
    status: "Audiencia programada",
    court: "Roleplay Magistrate Office",
    filedAt: "2026-05-20",
    claimant: "Investigador Rowan Pierce",
    defendant: "Bodega 17 — escenario ficticio",
    judge: "Magistrado Noah Sterling",
    confidentiality: "Público",
    summary: "Solicitud demostrativa marcada como pública para enseñar el flujo de revisión de órdenes.",
    publicVisibility: true,
  },
];

export const actions = [
  { id: "a1", caseId: "crim-000001", type: "Apertura de investigación", title: "Se registra expediente inicial", description: "La división penal roleplay abre la línea de tiempo y asigna fiscal ficticio.", date: "2026-06-16", visibility: "Pública", user: "Secretaría de Docket" },
  { id: "a2", caseId: "civil-000002", type: "Moción", title: "Moción de producción documental", description: "Se incorpora solicitud civil simulada y se programa respuesta.", date: "2026-06-14", visibility: "Pública", user: "Clerk Civil RP" },
  { id: "a3", caseId: "warrant-000004", type: "Audiencia", title: "Revisión de orden programada", description: "Se fija audiencia pública ficticia para validar requisitos narrativos.", date: "2026-06-12", visibility: "Pública", user: "Warrants Unit" },
  { id: "a4", caseId: "admin-000003", type: "Revisión interna", title: "Control de permisos", description: "Registro interno no visible al público.", date: "2026-06-10", visibility: "Interna", user: "Office of Professional Standards" },
];

export const hearings = [
  { id: "h1", date: "24 JUN", time: "09:00", iso: "2026-06-24T09:00:00", title: "Audiencia de revisión de warrant", type: "Warrant review", room: "Sala virtual RP-3", court: "Roleplay Magistrate Office", caseNumber: "DOJ-RP-WR-2026-000004", status: "Programada", public: true },
  { id: "h2", date: "26 JUN", time: "10:30", iso: "2026-06-26T10:30:00", title: "Conferencia inicial civil", type: "Inicial", room: "Sala 201", court: "Civil Roleplay Division", caseNumber: "DOJ-RP-CV-2026-000002", status: "Programada", public: true },
  { id: "h3", date: "30 JUN", time: "14:00", iso: "2026-06-30T14:00:00", title: "Lectura de resolución ficticia", type: "Resolución", room: "Auditorio de sesiones", court: "Division of Criminal Roleplay", caseNumber: "DOJ-RP-CR-2026-000011", status: "Programada", public: true },
  { id: "h4", date: "18 JUN", time: "08:30", iso: "2026-06-18T08:30:00", title: "Sesión de conciliación roleplay", type: "Conciliación", room: "Sala 104", court: "Civil Roleplay Division", caseNumber: "DOJ-RP-CV-2026-000008", status: "Celebrada", public: true },
];

export const notices = [
  { slug: "directiva-operativa-roleplay-junio", title: "Directiva operativa para expedientes de roleplay durante junio", excerpt: "Se actualizan reglas internas para presentación, revisión y publicación de documentos ficticios.", category: "Comunicado", entity: "Office of the Attorney General RP", date: "2026-06-17", featured: true },
  { slug: "mantenimiento-programado-portal-roleplay", title: "Mantenimiento programado del portal DOJ Roleplay", excerpt: "La consulta pública tendrá una ventana de mantenimiento técnico el sábado 27 de junio.", category: "Aviso técnico", entity: "Technology & Records Unit", date: "2026-06-15", featured: false },
  { slug: "convocatoria-jueces-abogados-roleplay", title: "Convocatoria para jueces, abogados y personal autorizado", excerpt: "Se abre ciclo de postulaciones para nuevos roles jurídicos dentro de la comunidad.", category: "Postulaciones", entity: "Human Resources RP", date: "2026-06-11", featured: false },
];

export const proceedings = [
  { id: "p1", number: "RP-ORDER-018-2026", title: "Orden procesal ficticia de apertura", type: "Providencia", chamber: "Division of Criminal Roleplay", judge: "Juez Harper Vale", date: "2026-06-16", caseNumber: "DOJ-RP-CR-2026-000001", status: "Publicado" },
  { id: "p2", number: "RP-CIV-041-2026", title: "Resolución ficticia sobre producción documental", type: "Resolución", chamber: "Civil Roleplay Division", judge: "Jueza Amelia Knox", date: "2026-06-14", caseNumber: "DOJ-RP-CV-2026-000002", status: "Publicado" },
  { id: "p3", number: "RP-WR-012-2026", title: "Providencia de revisión de warrant", type: "Auto", chamber: "Warrants & Orders Unit", judge: "Magistrado Noah Sterling", date: "2026-06-06", caseNumber: "DOJ-RP-WR-2026-000004", status: "Publicado" },
];

export const warrants = [
  { id: "w1", number: "RP-WR-2026-00014", type: "Search warrant roleplay", target: "Bodega 17 — escenario ficticio", caseNumber: "DOJ-RP-WR-2026-000004", status: "Activa", expires: "2026-07-03", public: true },
  { id: "w2", number: "RP-WR-2026-00015", type: "Arrest warrant roleplay", target: "Personaje narrativo reservado", caseNumber: "DOJ-RP-CR-2026-000001", status: "Pendiente", expires: "2026-07-08", public: false },
  { id: "w3", number: "RP-WR-2026-00016", type: "Production order roleplay", target: "Registros ficticios de comunicaciones", caseNumber: "DOJ-RP-CV-2026-000002", status: "Aprobada", expires: "2026-07-12", public: true },
];

export const applications = [
  { id: "app-judge", title: "Postulación a juez roleplay", position: "Juez", status: "Abierta", vacancies: 3, closes: "2026-07-15", description: "Proceso ficticio para seleccionar jueces de sala y jueces de audiencias narrativas." },
  { id: "app-lawyer", title: "Registro de abogado roleplay", position: "Abogado", status: "Abierta", vacancies: 12, closes: "2026-07-22", description: "Registro interno de litigantes autorizados para actuar en expedientes de la comunidad." },
  { id: "app-investigator", title: "Investigador autorizado", position: "Investigador", status: "En revisión", vacancies: 4, closes: "2026-07-10", description: "Convocatoria para apoyo probatorio y manejo de evidencias ficticias." },
];

export const workAreas = [
  { title: "Criminal Roleplay Division", description: "Investiga y litiga asuntos penales ficticios con control de acceso y trazabilidad." },
  { title: "Civil Roleplay Division", description: "Gestiona controversias civiles, mociones, providencias y audiencias simuladas." },
  { title: "Warrants & Orders Unit", description: "Tramita órdenes ficticias con marca obligatoria de roleplay y revisión autorizada." },
  { title: "Technology & Records Unit", description: "Administra publicación pública, expedientes, documentos y auditoría técnica." },
];

export const judicialStates = [
  { id: "e1", number: "RP-STATE-094-2026", date: "2026-06-18", court: "Criminal Roleplay Division", items: 8, status: "Publicado" },
  { id: "e2", number: "RP-STATE-071-2026", date: "2026-06-18", court: "Civil Roleplay Division", items: 11, status: "Publicado" },
  { id: "e3", number: "RP-STATE-063-2026", date: "2026-06-17", court: "Warrants & Orders Unit", items: 6, status: "Publicado" },
  { id: "e4", number: "RP-STATE-102-2026", date: "2026-06-17", court: "Roleplay Magistrate Office", items: 14, status: "Publicado" },
];

export const dependencies = ["Office of the Attorney General RP", "Division of Criminal Roleplay", "Civil Roleplay Division", "Warrants & Orders Unit", "Roleplay Magistrate Office", "Public Communications Office", "Technology & Records Unit", "Office of Professional Standards", "Human Resources RP"];

export const templates: Record<string, string> = {
  "Orden procesal": "# DEPARTMENT OF JUSTICE ROLEPLAY\n\n**Expediente:** {{radicado}}  \n**División:** {{division}}  \n**Funcionario:** {{ponente}}\n\n## FINDINGS\n[Describa hechos ficticios]\n\n## ORDER\n**FIRST.** This roleplay document is issued only for narrative purposes.\n\n**SECOND.** No real legal effect is created.\n\nROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.",
  "Resolución": "# RESOLUCIÓN ROLEPLAY\n\n## Antecedentes\n[Antecedentes ficticios]\n\n## Consideraciones\n[Consideraciones]\n\n## Resuelve\n[Decisión simulada]\n\nROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.",
  "Acta de audiencia": "# ACTA DE AUDIENCIA ROLEPLAY\n\n**Fecha y hora:** {{fecha}}  \n**Expediente:** {{radicado}}  \n**Sala:** {{despacho}}\n\n## Participantes\n- [Nombre y rol]\n\n## Desarrollo\n[Registro de la sesión]\n\n## Decisiones\n[Decisiones]\n\nROLEPLAY WEBSITE — documento ficticio sin validez real.",
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
