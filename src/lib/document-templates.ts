export const TEMPLATE_STYLES = [
  "auto",
  "corte_suprema",
  "tribunal_superior",
  "juzgado",
  "blank",
] as const;

export type TemplateStyle = (typeof TEMPLATE_STYLES)[number];

export const TEMPLATE_STYLE_LABELS: Record<TemplateStyle, string> = {
  auto: "Automático según institución",
  corte_suprema: "Corte Suprema de Justicia",
  tribunal_superior: "Tribunal Superior",
  juzgado: "Juzgado / despacho general",
  blank: "Documento formal en blanco",
};

type TemplateSpec = {
  key: string;
  label: string;
  sections?: string[];
  closing?: string;
  content?: string;
  templateOnly?: boolean;
};

const GENERIC_SECTIONS = ["ANTECEDENTES", "CONSIDERACIONES", "RESUELVE"];

const TEMPLATE_SPECS: TemplateSpec[] = [
  { key: "blank", label: "Documento formal en blanco", sections: [] },
  {
    key: "corte_suprema_base",
    label: "Corte Suprema · Providencia base",
    templateOnly: true,
    content: "## VISTOS\n\n[Texto inicial]\n\n## CONSIDERANDO\n\n[Consideraciones]\n\n## RESUELVE\n\n**PRIMERO.** [Decisión]\n\n**SEGUNDO.** [Decisión]\n\n**TERCERO.** [Decisión]\n\n**Notifíquese, comuníquese y cúmplase.**",
  },
  { key: "avocacion", label: "Auto de avocación de conocimiento" },
  { key: "apertura_instruccion", label: "Auto de apertura de instrucción" },
  { key: "avocamiento_pruebas", label: "Auto de avocamiento, apertura de instrucción y decreto de pruebas", sections: ["I. ANTECEDENTES", "II. COMPETENCIA", "III. MARCO NORMATIVO", "IV. CONSIDERACIONES DEL DESPACHO", "RESUELVE"] },
  { key: "decreta_pruebas", label: "Auto que decreta pruebas" },
  { key: "niega_pruebas", label: "Auto que niega pruebas" },
  { key: "practica_pruebas", label: "Auto que ordena práctica de pruebas" },
  { key: "requiere_informe", label: "Auto que requiere informe" },
  { key: "ordena_traslado", label: "Auto que ordena traslado" },
  { key: "admisorio", label: "Auto admisorio" },
  { key: "inadmisorio", label: "Auto inadmisorio" },
  { key: "rechazo", label: "Auto de rechazo" },
  { key: "archivo", label: "Auto de archivo" },
  { key: "cierre_instruccion", label: "Auto de cierre de instrucción" },
  { key: "fija_audiencia", label: "Auto que fija audiencia" },
  { key: "reprograma_audiencia", label: "Auto que reprograma audiencia" },
  { key: "cancela_audiencia", label: "Auto que cancela audiencia" },
  { key: "resuelve_recurso", label: "Auto que resuelve recurso" },
  { key: "concede_recurso", label: "Auto que concede recurso" },
  { key: "niega_recurso", label: "Auto que niega recurso" },
  { key: "ordena_notificacion", label: "Auto que ordena notificación" },
  { key: "obedezcase", label: "Auto de obedézcase y cúmplase" },
  { key: "sentencia", label: "Sentencia", sections: ["I. ANTECEDENTES", "II. PROBLEMA JURÍDICO", "III. CONSIDERACIONES", "IV. CASO CONCRETO", "FALLA"] },
  { key: "fallo_disciplinario", label: "Fallo disciplinario", sections: ["I. ANTECEDENTES", "II. CARGOS", "III. CONSIDERACIONES", "IV. RESPONSABILIDAD", "FALLA"] },
  { key: "tramite", label: "Providencia de trámite" },
  { key: "constancia", label: "Constancia secretarial", sections: ["CONSTANCIA"] },
  { key: "acta", label: "Acta formal", sections: ["I. INSTALACIÓN", "II. INTERVINIENTES", "III. DESARROLLO", "IV. DECISIONES", "V. CIERRE"] },
  { key: "oficio", label: "Despacho comisorio / oficio", sections: ["ASUNTO", "DESTINATARIO", "CONTENIDO", "ANEXOS"], closing: "Atentamente," },
  { key: "medida_provisional", label: "Medida provisional" },
  { key: "nulidad", label: "Auto de nulidad" },
  { key: "aclaracion", label: "Auto que resuelve solicitud de aclaración" },
  { key: "correccion", label: "Auto que resuelve solicitud de corrección" },
  { key: "decreta_reserva", label: "Auto que decreta reserva" },
  { key: "levanta_reserva", label: "Auto que levanta reserva" },
  { key: "acumulacion", label: "Auto de acumulación" },
  { key: "desglose", label: "Auto de desglose" },
  { key: "reconoce_personeria", label: "Auto que reconoce personería" },
  { key: "vincula_partes", label: "Auto que vincula partes" },
  { key: "desvincula_partes", label: "Auto que desvincula partes" },
  { key: "conservacion_pruebas", label: "Auto que ordena conservación de pruebas" },
  { key: "oficia_autoridad", label: "Auto que oficia autoridad" },
  { key: "custom", label: "Otro / personalizado", sections: [] },
];

function buildTemplate(spec: TemplateSpec) {
  if (spec.content) return spec.content;
  if (!spec.sections?.length) {
    return spec.key === "blank" || spec.key === "custom"
      ? "[Redacte aquí el contenido del documento.]"
      : buildSections(GENERIC_SECTIONS, spec.closing);
  }
  return buildSections(spec.sections, spec.closing);
}

function buildSections(sections: string[], closing = "Notifíquese, comuníquese y cúmplase.") {
  return `${sections
    .map((section) => {
      if (section === "RESUELVE" || section === "FALLA") {
        return `## ${section}\n\n**PRIMERO.** [Redacte la primera decisión.]\n\n**SEGUNDO.** [Redacte la segunda decisión.]`;
      }
      return `## ${section}\n\n[Redacte el contenido de esta sección.]`;
    })
    .join("\n\n")}\n\n**${closing}**`;
}

export const DOCUMENT_TEMPLATES = TEMPLATE_SPECS.map((spec) => ({
  ...spec,
  content: buildTemplate(spec),
}));

export const PROVIDENCE_TYPES = TEMPLATE_SPECS.filter(
  (item) => !item.templateOnly && !["blank", "custom"].includes(item.key),
).map((item) => item.label);

export type DocumentMetadata = {
  customTemplateName?: string;
  documentCode?: string;
  actNumber?: string;
  city?: string;
  roomName?: string;
  rapporteurName?: string;
  secretaryName?: string;
  claimantName?: string;
  defendantName?: string;
  linkedPartyName?: string;
  subject?: string;
  footnotes?: string;
};

export type PlaceholderContext = DocumentMetadata & {
  judicialNumber?: string | null;
  internalNumber?: string | null;
  providenceDate?: string | null;
  year?: string | number | null;
  chamber?: string | null;
  dependency?: string | null;
  documentType?: string | null;
  title?: string | null;
  verificationCode?: string | null;
};

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function writtenDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return `${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

export function renderDocumentPlaceholders(content: string, context: PlaceholderContext) {
  const date = context.providenceDate?.slice(0, 10) || "";
  const values: Record<string, string> = {
    RADICADO: context.judicialNumber || context.internalNumber || "—",
    FECHA: date || "—",
    "FECHA ESCRITA": writtenDate(date),
    AÑO: String(context.year || (date ? new Date(`${date}T12:00:00Z`).getUTCFullYear() : "—")),
    CIUDAD: context.city || "Bogotá, D.C.",
    SALA: context.roomName || context.chamber || "—",
    DESPACHO: context.dependency || context.chamber || "—",
    "MAGISTRADO/A": context.rapporteurName || "—",
    "MAGISTRADO/A PONENTE": context.rapporteurName || "—",
    "SECRETARIO/A": context.secretaryName || "—",
    ACCIONANTE: context.claimantName || "—",
    ACCIONADO: context.defendantName || "—",
    "PRESUNTA VINCULADA": context.linkedPartyName || "—",
    ASUNTO: context.subject || context.title || "—",
    "TIPO DE PROVIDENCIA": context.documentType || "—",
    "TÍTULO": context.title || "—",
    "CÓDIGO DE VERIFICACIÓN": context.verificationCode || "—",
  };
  const aliases: Record<string, string> = {
    RADICADO: "radicado", FECHA: "fecha", "FECHA ESCRITA": "fecha_escrita", AÑO: "ano",
    CIUDAD: "ciudad", SALA: "sala", DESPACHO: "despacho", "MAGISTRADO/A": "magistrado",
    "MAGISTRADO/A PONENTE": "ponente", "SECRETARIO/A": "secretario", ACCIONANTE: "accionante",
    ACCIONADO: "accionado", "PRESUNTA VINCULADA": "presunta_vinculada", ASUNTO: "asunto",
    "TIPO DE PROVIDENCIA": "tipo_de_providencia", TÍTULO: "titulo", "CÓDIGO DE VERIFICACIÓN": "codigo_de_verificacion",
  };
  return Object.entries(values).reduce((result, [key, value]) => {
    return result
      .replaceAll(`[${key}]`, value)
      .replaceAll(`{{${aliases[key]}}}`, value);
  }, content)
    .replaceAll("[RESUELVE]", "## RESUELVE")
    .replaceAll("[CUERPO]", "")
    .replaceAll("[FIRMAS]", "");
}

export function inferTemplateStyle(hints: Array<string | null | undefined>): Exclude<TemplateStyle, "auto"> {
  const value = hints.filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/corte suprema|sala de casacion|casacion|sala plena/.test(value)) return "corte_suprema";
  if (/tribunal superior/.test(value)) return "tribunal_superior";
  return "juzgado";
}

export function resolveTemplateStyle(style: string | null | undefined, hints: Array<string | null | undefined>) {
  if (style && style !== "auto" && TEMPLATE_STYLES.includes(style as TemplateStyle)) {
    return style as Exclude<TemplateStyle, "auto">;
  }
  return inferTemplateStyle(hints);
}
