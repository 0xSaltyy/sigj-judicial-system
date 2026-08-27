export const ROLEPLAY_DOCUMENT_NOTICE = "ROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER";
export const ROLEPLAY_WATERMARK = "ROLEPLAY — NOT A REAL WARRANT";

export type WarrantTypeKey =
  | "search_seizure"
  | "arrest"
  | "bench"
  | "electronic_data"
  | "tracking_device"
  | "stored_communications"
  | "property_seizure"
  | "inspection"
  | "material_witness"
  | "custom";

export type WarrantFormData = {
  warrant_type: WarrantTypeKey;
  warrant_number?: string;
  warrant_title?: string;
  case_number?: string;
  court?: string;
  district?: string;
  division?: string;
  city_state?: string;
  issued_at?: string;
  expires_at?: string;
  applicant_name?: string;
  applicant_title?: string;
  applicant_agency?: string;
  attorney_name?: string;
  internal_reference?: string;
  target_type?: string;
  target_description?: string;
  precise_location?: string;
  person_name?: string;
  alias?: string;
  date_of_birth?: string;
  physical_description?: string;
  last_known_address?: string;
  vehicle_description?: string;
  vin?: string;
  device_identifier?: string;
  provider?: string;
  account_identifier?: string;
  data_period?: string;
  probable_cause?: string;
  legal_basis?: string;
  offenses?: string;
  items_to_search?: string;
  items_to_seize?: string;
  limitations?: string;
  execution_window?: "daytime" | "anytime";
  night_execution_reason?: string;
  max_execution_days?: string;
  notice_delay?: string;
  special_instructions?: string;
  responsible_officer?: string;
  judge_name?: string;
  judge_title?: string;
  approval_city_state?: string;
  approved_at?: string;
  return_inventory?: string;
  observations?: string;
  confidentiality?: "public" | "internal" | "reserved" | "confidential";
};

export type WarrantTemplate = {
  key: WarrantTypeKey;
  label: string;
  title: string;
  prefix: string;
  subjectLabel: string;
  targetLabel: string;
  probableCauseLabel: string;
  scopeLabel: string;
  orderText: string;
  attachments: string[];
  conditionalFields: { name: keyof WarrantFormData; label: string; type?: "textarea" | "text" | "date" }[];
};

export const warrantTemplates: WarrantTemplate[] = [
  {
    key: "search_seizure",
    label: "Search and Seizure Warrant",
    title: "SEARCH AND SEIZURE WARRANT",
    prefix: "RP-SW",
    subjectLabel: "In the Matter of the Search of",
    targetLabel: "Lugar, persona o propiedad que será registrada",
    probableCauseLabel: "Declaración de probable cause",
    scopeLabel: "Elementos que pueden buscarse y decomisarse",
    orderText: "Upon review of the application and supporting statement, the Court finds probable cause to authorize a search of the described property and the seizure of the items identified in this warrant and its attachments.",
    attachments: ["Attachment A — Property to Be Searched", "Attachment B — Items to Be Seized", "Return and Inventory"],
    conditionalFields: [
      { name: "precise_location", label: "Descripción exacta de la ubicación", type: "textarea" },
      { name: "items_to_search", label: "Elementos que pueden buscarse", type: "textarea" },
      { name: "items_to_seize", label: "Elementos que pueden decomisarse", type: "textarea" },
    ],
  },
  {
    key: "arrest",
    label: "Arrest Warrant",
    title: "ARREST WARRANT",
    prefix: "RP-AW",
    subjectLabel: "In the Matter of the Arrest of",
    targetLabel: "Persona que será arrestada",
    probableCauseLabel: "Cargos, delito o disposición aplicable",
    scopeLabel: "Condiciones especiales de ejecución",
    orderText: "The Court finds probable cause to believe that the person identified below is subject to arrest under the stated charges or applicable provision. Authorized officers are ordered to arrest the person and bring the person before the Court without unnecessary delay.",
    attachments: ["Attachment A — Person to Be Arrested", "Attachment B — Charges and Conditions", "Return of Arrest Warrant"],
    conditionalFields: [
      { name: "person_name", label: "Nombre legal de la persona" },
      { name: "alias", label: "Alias" },
      { name: "date_of_birth", label: "Fecha de nacimiento", type: "date" },
      { name: "physical_description", label: "Descripción física", type: "textarea" },
      { name: "last_known_address", label: "Última dirección conocida", type: "textarea" },
      { name: "offenses", label: "Delito, cargos o disposición aplicable", type: "textarea" },
    ],
  },
  {
    key: "bench",
    label: "Bench Warrant",
    title: "BENCH WARRANT",
    prefix: "RP-BW",
    subjectLabel: "In the Matter of the Appearance of",
    targetLabel: "Persona requerida por el tribunal",
    probableCauseLabel: "Motivo de emisión",
    scopeLabel: "Condiciones para comparecencia o liberación",
    orderText: "The Court orders the person identified below to be brought before the Court because the record supports issuance of a bench warrant for failure to appear, contempt, or noncompliance with a court order.",
    attachments: ["Attachment A — Required Person", "Attachment B — Appearance Terms", "Return of Bench Warrant"],
    conditionalFields: [
      { name: "person_name", label: "Persona requerida" },
      { name: "offenses", label: "Incomparecencia, desacato u orden incumplida", type: "textarea" },
      { name: "special_instructions", label: "Condiciones para comparecencia o liberación", type: "textarea" },
    ],
  },
  {
    key: "electronic_data",
    label: "Electronic Data Search Warrant",
    title: "ELECTRONIC DATA SEARCH WARRANT",
    prefix: "RP-EDW",
    subjectLabel: "In the Matter of the Search of Electronic Data Associated With",
    targetLabel: "Dispositivo, cuenta o servicio",
    probableCauseLabel: "Hechos que sustentan la búsqueda de datos",
    scopeLabel: "Categorías de información y protocolo de minimización",
    orderText: "The Court finds probable cause to authorize the search and extraction of electronic data described below, subject to the limitations and minimization protocol stated in this warrant and its technical attachments.",
    attachments: ["Attachment A — Account or Device", "Attachment B — Data to Be Disclosed", "Attachment C — Minimization Protocol"],
    conditionalFields: [
      { name: "provider", label: "Proveedor o servicio" },
      { name: "account_identifier", label: "Correo, cuenta, teléfono o identificador" },
      { name: "device_identifier", label: "IMEI, número de serie o dirección IP" },
      { name: "data_period", label: "Periodo de datos solicitado" },
      { name: "items_to_seize", label: "Categorías de información", type: "textarea" },
      { name: "limitations", label: "Protocolo de minimización", type: "textarea" },
    ],
  },
  {
    key: "tracking_device",
    label: "Tracking Device Warrant",
    title: "TRACKING DEVICE WARRANT",
    prefix: "RP-TDW",
    subjectLabel: "In the Matter of the Installation and Monitoring of a Tracking Device On",
    targetLabel: "Persona, vehículo, objeto o ubicación",
    probableCauseLabel: "Fundamento para seguimiento",
    scopeLabel: "Instalación, duración, área geográfica y reglas de retiro",
    orderText: "The Court authorizes installation, use, monitoring, and removal of a tracking device according to the scope, duration, location, and agency responsibilities stated below.",
    attachments: ["Attachment A — Tracking Target", "Attachment B — Installation and Monitoring Terms", "Return and Monitoring Summary"],
    conditionalFields: [
      { name: "vehicle_description", label: "Vehículo, objeto o ubicación", type: "textarea" },
      { name: "precise_location", label: "Lugar autorizado para instalación", type: "textarea" },
      { name: "max_execution_days", label: "Duración máxima autorizada" },
      { name: "limitations", label: "Área geográfica y horarios", type: "textarea" },
    ],
  },
  {
    key: "stored_communications",
    label: "Stored Communications Warrant",
    title: "STORED COMMUNICATIONS WARRANT",
    prefix: "RP-SCW",
    subjectLabel: "In the Matter of Stored Communications Associated With",
    targetLabel: "Cuenta objetivo o proveedor de comunicaciones",
    probableCauseLabel: "Fundamento para divulgación de comunicaciones almacenadas",
    scopeLabel: "Contenido, registros y método seguro de entrega",
    orderText: "The Court orders the provider identified below to disclose the stored communications, subscriber records, connection records, and preserved information described in this warrant.",
    attachments: ["Attachment A — Target Account", "Attachment B — Records to Be Disclosed", "Attachment C — Provider Compliance Terms"],
    conditionalFields: [
      { name: "provider", label: "Proveedor del servicio" },
      { name: "account_identifier", label: "Cuenta objetivo e identificadores" },
      { name: "data_period", label: "Rango de fechas" },
      { name: "items_to_seize", label: "Contenido y registros solicitados", type: "textarea" },
      { name: "notice_delay", label: "Notificación inmediata o diferida" },
    ],
  },
  {
    key: "property_seizure",
    label: "Property Seizure Warrant",
    title: "PROPERTY SEIZURE WARRANT",
    prefix: "RP-PSW",
    subjectLabel: "In the Matter of the Seizure of",
    targetLabel: "Propiedad que será decomisada",
    probableCauseLabel: "Base para el decomiso",
    scopeLabel: "Custodia, agencia receptora e inventario",
    orderText: "The Court authorizes seizure of the property described below and directs that it be inventoried, preserved, and returned or held according to the terms stated in this warrant.",
    attachments: ["Attachment A — Property to Be Seized", "Attachment B — Custody and Inventory Terms", "Return and Inventory"],
    conditionalFields: [
      { name: "target_description", label: "Descripción detallada de la propiedad", type: "textarea" },
      { name: "precise_location", label: "Ubicación" },
      { name: "person_name", label: "Propietario o poseedor conocido" },
      { name: "limitations", label: "Método de custodia y agencia receptora", type: "textarea" },
    ],
  },
  {
    key: "inspection",
    label: "Inspection Warrant",
    title: "INSPECTION WARRANT",
    prefix: "RP-IW",
    subjectLabel: "In the Matter of the Inspection of",
    targetLabel: "Inmueble, negocio o instalación",
    probableCauseLabel: "Autoridad reguladora y disposiciones aplicables",
    scopeLabel: "Objeto, alcance, fecha y horario de inspección",
    orderText: "The Court authorizes the inspection described below within the stated scope, date, schedule, and regulatory authority.",
    attachments: ["Attachment A — Premises to Be Inspected", "Attachment B — Inspection Scope", "Return of Inspection"],
    conditionalFields: [
      { name: "precise_location", label: "Inmueble, negocio o instalación", type: "textarea" },
      { name: "applicant_agency", label: "Autoridad reguladora" },
      { name: "items_to_search", label: "Objeto de la inspección", type: "textarea" },
      { name: "limitations", label: "Alcance permitido", type: "textarea" },
    ],
  },
  {
    key: "material_witness",
    label: "Material Witness Warrant",
    title: "MATERIAL WITNESS WARRANT",
    prefix: "RP-MWW",
    subjectLabel: "In the Matter of the Appearance of Material Witness",
    targetLabel: "Testigo material",
    probableCauseLabel: "Importancia del testimonio",
    scopeLabel: "Tribunal, fecha requerida y condiciones aplicables",
    orderText: "The Court finds that the identified witness is material to the proceeding and that ordinary subpoena process is insufficient under the circumstances stated below.",
    attachments: ["Attachment A — Material Witness", "Attachment B — Appearance Conditions", "Return of Material Witness Warrant"],
    conditionalFields: [
      { name: "person_name", label: "Nombre del testigo" },
      { name: "account_identifier", label: "Información de contacto" },
      { name: "probable_cause", label: "Importancia del testimonio", type: "textarea" },
      { name: "limitations", label: "Motivo por el que subpoena no sería suficiente", type: "textarea" },
      { name: "special_instructions", label: "Condiciones aplicables", type: "textarea" },
    ],
  },
  {
    key: "custom",
    label: "Custom Warrant",
    title: "CUSTOM WARRANT",
    prefix: "RP-CW",
    subjectLabel: "In the Matter of",
    targetLabel: "Persona, lugar u objeto afectado",
    probableCauseLabel: "Fundamentos",
    scopeLabel: "Alcance, instrucciones y plazo",
    orderText: "The Court authorizes only the action described in this custom warrant, subject to review, applicable permissions, and the terms stated below.",
    attachments: ["Attachment A — Custom Target", "Attachment B — Authorized Scope", "Return of Custom Warrant"],
    conditionalFields: [
      { name: "warrant_title", label: "Título formal personalizado" },
      { name: "target_description", label: "Persona, lugar u objeto afectado", type: "textarea" },
      { name: "items_to_search", label: "Alcance", type: "textarea" },
      { name: "special_instructions", label: "Instrucciones", type: "textarea" },
    ],
  },
];

export function getWarrantTemplate(type: string | undefined | null) {
  return warrantTemplates.find((template) => template.key === type) ?? warrantTemplates[0];
}

export function normalizeWarrantData(raw: Partial<WarrantFormData> & Record<string, unknown>): WarrantFormData {
  const template = getWarrantTemplate(String(raw.warrant_type ?? "search_seizure"));
  return {
    warrant_type: template.key,
    warrant_number: stringValue(raw.warrant_number),
    warrant_title: stringValue(raw.warrant_title) || template.title,
    case_number: stringValue(raw.case_number),
    court: stringValue(raw.court) || "UNITED STATES DISTRICT COURT",
    district: stringValue(raw.district) || "District selected by the Court",
    division: stringValue(raw.division),
    city_state: stringValue(raw.city_state) || "Washington, D.C.",
    issued_at: stringValue(raw.issued_at),
    expires_at: stringValue(raw.expires_at),
    applicant_name: stringValue(raw.applicant_name),
    applicant_title: stringValue(raw.applicant_title),
    applicant_agency: stringValue(raw.applicant_agency),
    attorney_name: stringValue(raw.attorney_name),
    internal_reference: stringValue(raw.internal_reference),
    target_type: stringValue(raw.target_type),
    target_description: stringValue(raw.target_description),
    precise_location: stringValue(raw.precise_location),
    person_name: stringValue(raw.person_name),
    alias: stringValue(raw.alias),
    date_of_birth: stringValue(raw.date_of_birth),
    physical_description: stringValue(raw.physical_description),
    last_known_address: stringValue(raw.last_known_address),
    vehicle_description: stringValue(raw.vehicle_description),
    vin: stringValue(raw.vin),
    device_identifier: stringValue(raw.device_identifier),
    provider: stringValue(raw.provider),
    account_identifier: stringValue(raw.account_identifier),
    data_period: stringValue(raw.data_period),
    probable_cause: stringValue(raw.probable_cause),
    legal_basis: stringValue(raw.legal_basis),
    offenses: stringValue(raw.offenses),
    items_to_search: stringValue(raw.items_to_search),
    items_to_seize: stringValue(raw.items_to_seize),
    limitations: stringValue(raw.limitations),
    execution_window: raw.execution_window === "anytime" ? "anytime" : "daytime",
    night_execution_reason: stringValue(raw.night_execution_reason),
    max_execution_days: stringValue(raw.max_execution_days) || "14",
    notice_delay: stringValue(raw.notice_delay),
    special_instructions: stringValue(raw.special_instructions),
    responsible_officer: stringValue(raw.responsible_officer),
    judge_name: stringValue(raw.judge_name),
    judge_title: stringValue(raw.judge_title) || "United States Magistrate Judge",
    approval_city_state: stringValue(raw.approval_city_state),
    approved_at: stringValue(raw.approved_at),
    return_inventory: stringValue(raw.return_inventory),
    observations: stringValue(raw.observations),
    confidentiality: isConfidentiality(raw.confidentiality) ? raw.confidentiality : "internal",
  };
}

export function getWarrantTitle(data: WarrantFormData) {
  const template = getWarrantTemplate(data.warrant_type);
  return data.warrant_type === "custom" && data.warrant_title ? data.warrant_title.toUpperCase() : template.title;
}

export function buildWarrantSections(data: WarrantFormData) {
  const template = getWarrantTemplate(data.warrant_type);
  const target = data.target_description || data.person_name || data.precise_location || data.account_identifier || "Target pending completion";
  return [
    { title: template.targetLabel, body: target },
    { title: template.probableCauseLabel, body: data.probable_cause || data.offenses || data.legal_basis || data.observations || "Pending supporting facts." },
    { title: template.scopeLabel, body: [data.items_to_search, data.items_to_seize, data.limitations, data.special_instructions].filter(Boolean).join("\n\n") || "Scope pending completion." },
    { title: "Execution", body: buildExecutionText(data) },
    { title: "Return and Inventory", body: data.return_inventory || "The executing officer must prepare and return an inventory and receipt to the Court." },
  ];
}

export function buildExecutionText(data: WarrantFormData) {
  const windowText = data.execution_window === "anytime"
    ? `Execution at any time is authorized for good cause. ${data.night_execution_reason || ""}`.trim()
    : "Execution is authorized during daytime hours.";
  return [
    windowText,
    `The warrant must be executed within ${data.max_execution_days || "14"} days unless a shorter deadline is stated by the Court.`,
    data.notice_delay ? `Delayed notice: ${data.notice_delay}.` : "A copy of the warrant and receipt must be provided as required.",
    data.responsible_officer ? `Responsible officer: ${data.responsible_officer}.` : "",
  ].filter(Boolean).join(" ");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isConfidentiality(value: unknown): value is WarrantFormData["confidentiality"] {
  return value === "public" || value === "internal" || value === "reserved" || value === "confidential";
}
