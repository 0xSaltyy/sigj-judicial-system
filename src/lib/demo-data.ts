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
    title: "Investigación por fraude financiero organizado",
    chamber: "Criminal Division",
    processType: "Penal",
    processSubtype: "Investigación",
    status: "En investigación",
    court: "District Court · Criminal Docket",
    filedAt: "2026-05-14",
    claimant: "Office of the Prosecutor",
    defendant: "Red Mercury Group",
    judge: "Juez Harper Vale",
    confidentiality: "Público",
    summary: "Expediente público sobre una red financiera dentro de la comunidad.",
    publicVisibility: true,
  },
  {
    id: "civil-000002",
    internalNumber: "DOJ-RP-CV-2026-000002",
    judicialNumber: "RP-DC-002-2026-00002",
    title: "Acción civil por incumplimiento contractual",
    chamber: "Civil Division",
    processType: "Civil",
    processSubtype: "Declarativo",
    status: "Pendiente",
    court: "District Court · Civil Docket",
    filedAt: "2026-04-28",
    claimant: "Liberty Harbor Logistics",
    defendant: "Northline Services RP",
    judge: "Jueza Amelia Knox",
    confidentiality: "Público",
    summary: "Controversia contractual para prácticas de litigación y gestión documental.",
    publicVisibility: true,
  },
  {
    id: "admin-000003",
    internalNumber: "DOJ-RP-IA-2026-000003",
    judicialNumber: "RP-IA-001-2026-00003",
    title: "Revisión interna de cumplimiento operativo",
    chamber: "Office of Professional Standards RP",
    processType: "Administrativo",
    processSubtype: "Control interno",
    status: "Reservado",
    court: "Internal Review Board",
    filedAt: "2026-06-02",
    claimant: "Office of Professional Standards",
    defendant: "Unidad operativa interna",
    judge: "Panel interno",
    confidentiality: "Reservado",
    summary: "Asunto reservado de demostración. No se expone información sensible en el portal público.",
    publicVisibility: false,
  },
  {
    id: "warrant-000004",
    internalNumber: "DOJ-RP-WR-2026-000004",
    judicialNumber: "RP-WR-003-2026-00004",
    title: "Solicitud de orden de registro",
    chamber: "Warrants & Orders Unit",
    processType: "Orden",
    processSubtype: "Warrant",
    status: "Audiencia programada",
    court: "Magistrate Office",
    filedAt: "2026-05-20",
    claimant: "Investigador Rowan Pierce",
    defendant: "Bodega 17",
    judge: "Magistrado Noah Sterling",
    confidentiality: "Público",
    summary: "Solicitud demostrativa marcada como pública para enseñar el flujo de revisión de órdenes.",
    publicVisibility: true,
  },
];

export const actions = [
  { id: "a1", caseId: "crim-000001", type: "Apertura de investigación", title: "Se registra expediente inicial", description: "La división penal abre la línea de tiempo y asigna fiscal.", date: "2026-06-16", visibility: "Pública", user: "Secretaría de Docket" },
  { id: "a2", caseId: "civil-000002", type: "Moción", title: "Moción de producción documental", description: "Se incorpora solicitud civil simulada y se programa respuesta.", date: "2026-06-14", visibility: "Pública", user: "Clerk Civil RP" },
  { id: "a3", caseId: "warrant-000004", type: "Audiencia", title: "Revisión de orden programada", description: "Se fija audiencia pública para validar requisitos del trámite.", date: "2026-06-12", visibility: "Pública", user: "Warrants Unit" },
  { id: "a4", caseId: "admin-000003", type: "Revisión interna", title: "Control de permisos", description: "Registro interno no visible al público.", date: "2026-06-10", visibility: "Interna", user: "Office of Professional Standards" },
];

export const hearings = [
  { id: "h1", date: "24 JUN", time: "09:00", iso: "2026-06-24T09:00:00", title: "Audiencia de revisión de warrant", type: "Warrant review", room: "Sala virtual 3", court: "Magistrate Office", caseNumber: "DOJ-RP-WR-2026-000004", status: "Programada", public: true },
  { id: "h2", date: "26 JUN", time: "10:30", iso: "2026-06-26T10:30:00", title: "Conferencia inicial civil", type: "Inicial", room: "Sala 201", court: "Civil Division", caseNumber: "DOJ-RP-CV-2026-000002", status: "Programada", public: true },
  { id: "h3", date: "30 JUN", time: "14:00", iso: "2026-06-30T14:00:00", title: "Lectura de resolución", type: "Resolución", room: "Auditorio de sesiones", court: "Criminal Division", caseNumber: "DOJ-RP-CR-2026-000011", status: "Programada", public: true },
  { id: "h4", date: "18 JUN", time: "08:30", iso: "2026-06-18T08:30:00", title: "Sesión de conciliación", type: "Conciliación", room: "Sala 104", court: "Civil Division", caseNumber: "DOJ-RP-CV-2026-000008", status: "Celebrada", public: true },
];

export const notices = [
  { slug: "directiva-operativa-junio", title: "Directiva operativa para expedientes durante junio", excerpt: "Se actualizan reglas internas para presentación, revisión y publicación de documentos.", category: "Comunicado", entity: "Office of the Attorney General", date: "2026-06-17", featured: true },
  { slug: "mantenimiento-programado-portal", title: "Mantenimiento programado del portal", excerpt: "La consulta pública tendrá una ventana de mantenimiento técnico el sábado 27 de junio.", category: "Aviso técnico", entity: "Technology & Records Unit", date: "2026-06-15", featured: false },
  { slug: "convocatoria-jueces-abogados", title: "Convocatoria para jueces, abogados y personal autorizado", excerpt: "Se abre ciclo de postulaciones para nuevos roles jurídicos dentro de la comunidad.", category: "Postulaciones", entity: "Human Resources", date: "2026-06-11", featured: false },
];

export const proceedings = [
  { id: "p1", number: "RP-ORDER-018-2026", title: "Orden procesal de apertura", type: "Providencia", chamber: "Criminal Division", judge: "Juez Harper Vale", date: "2026-06-16", caseNumber: "DOJ-RP-CR-2026-000001", status: "Publicado" },
  { id: "p2", number: "RP-CIV-041-2026", title: "Resolución sobre producción documental", type: "Resolución", chamber: "Civil Division", judge: "Jueza Amelia Knox", date: "2026-06-14", caseNumber: "DOJ-RP-CV-2026-000002", status: "Publicado" },
  { id: "p3", number: "RP-WR-012-2026", title: "Providencia de revisión de warrant", type: "Auto", chamber: "Warrants & Orders Unit", judge: "Magistrado Noah Sterling", date: "2026-06-06", caseNumber: "DOJ-RP-WR-2026-000004", status: "Publicado" },
];

export const warrants = [
  { id: "w1", number: "RP-WR-2026-00014", type: "Search warrant", target: "Bodega 17", caseNumber: "DOJ-RP-WR-2026-000004", status: "Activa", expires: "2026-07-03", public: true },
  { id: "w2", number: "RP-WR-2026-00015", type: "Arrest warrant", target: "Persona reservada", caseNumber: "DOJ-RP-CR-2026-000001", status: "Pendiente", expires: "2026-07-08", public: false },
  { id: "w3", number: "RP-WR-2026-00016", type: "Production order", target: "Registros de comunicaciones", caseNumber: "DOJ-RP-CV-2026-000002", status: "Aprobada", expires: "2026-07-12", public: true },
];

export const applications = [
  { id: "app-judge", title: "Postulación a juez", position: "Juez", status: "Abierta", vacancies: 3, closes: "2026-07-15", description: "Proceso para seleccionar jueces de sala y jueces de audiencias." },
  { id: "app-lawyer", title: "Registro de abogado", position: "Abogado", status: "Abierta", vacancies: 12, closes: "2026-07-22", description: "Registro interno de litigantes autorizados para actuar en expedientes de la comunidad." },
  { id: "app-investigator", title: "Investigador autorizado", position: "Investigador", status: "En revisión", vacancies: 4, closes: "2026-07-10", description: "Convocatoria para apoyo probatorio y manejo de evidencias internas." },
];

export const workAreas = [
  { title: "Criminal Division", description: "Investiga y litiga asuntos penales con control de acceso y trazabilidad." },
  { title: "Civil Division", description: "Gestiona controversias civiles, mociones, providencias y audiencias." },
  { title: "Warrants & Orders Unit", description: "Tramita órdenes con revisión autorizada y controles documentales." },
  { title: "Technology & Records Unit", description: "Administra publicación pública, expedientes, documentos y auditoría técnica." },
];

export const judicialStates = [
  { id: "e1", number: "RP-STATE-094-2026", date: "2026-06-18", court: "Criminal Division", items: 8, status: "Publicado" },
  { id: "e2", number: "RP-STATE-071-2026", date: "2026-06-18", court: "Civil Division", items: 11, status: "Publicado" },
  { id: "e3", number: "RP-STATE-063-2026", date: "2026-06-17", court: "Warrants & Orders Unit", items: 6, status: "Publicado" },
  { id: "e4", number: "RP-STATE-102-2026", date: "2026-06-17", court: "Magistrate Office", items: 14, status: "Publicado" },
];

export const dependencies = ["Office of the Attorney General", "Criminal Division", "Civil Division", "Warrants & Orders Unit", "Magistrate Office", "Public Communications Office", "Technology & Records Unit", "Office of Professional Standards", "Human Resources"];

export const templates: Record<string, string> = {
  "Orden procesal": "# DEPARTMENT OF JUSTICE ROLEPLAY\n\n**Número de caso:** {{case_number}}  \n**División:** {{division}}  \n**Funcionario:** {{ponente}}\n\n## FINDINGS\n[Describa hechos ficticios]\n\n## ORDER\n**FIRST.** This roleplay document is issued only for narrative purposes.\n\n**SECOND.** No real legal effect is created.\n\nROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.",
  "Resolución": "# RESOLUCIÓN ROLEPLAY\n\n## Antecedentes\n[Antecedentes ficticios]\n\n## Consideraciones\n[Consideraciones]\n\n## Resuelve\n[Decisión simulada]\n\nROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.",
  "Acta de audiencia": "# ACTA DE AUDIENCIA ROLEPLAY\n\n**Fecha y hora:** {{fecha}}  \n**Número de caso:** {{case_number}}  \n**Sala:** {{despacho}}\n\n## Participantes\n- [Nombre y rol]\n\n## Desarrollo\n[Registro de la sesión]\n\n## Decisiones\n[Decisiones]\n\nROLEPLAY WEBSITE — documento ficticio sin validez real.",
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
