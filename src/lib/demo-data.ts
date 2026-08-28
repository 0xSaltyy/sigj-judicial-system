export const ROLEPLAY_NOTICE =
  "ROLEPLAY WEBSITE — This website is fictional and is not affiliated with the real United States Department of Justice.";

export type CaseRecord = {
  id: string;
  caseNumber: string;
  docketNumber: string | null;
  title: string;
  caseCaption: string;
  caseCategory: string;
  status: string;
  court: string;
  filedAt: string;
  confidentiality: "Public" | "Restricted" | "Sealed" | "Grand-jury restricted" | "Internal DOJ only";
  summary: string;
  publicVisibility: boolean;
};

export const cases: CaseRecord[] = [];
export const actions: Array<Record<string, string>> = [];
export const hearings: Array<Record<string, string | boolean>> = [];
export const notices: Array<Record<string, string | boolean>> = [];
export const proceedings: Array<Record<string, string>> = [];
export const warrants: Array<Record<string, string | boolean>> = [];
export const applications: Array<Record<string, string | number>> = [];

export const workAreas = [
  { title: "Criminal Division", description: "Federal criminal investigations, charging review, warrants and court coordination." },
  { title: "Civil Division", description: "Civil Cases, motions, filings, orders and hearings." },
  { title: "Warrants & Orders Unit", description: "Roleplay warrant requests with review and document controls." },
  { title: "Technology & Records Unit", description: "Public access, storage, audit and protected records." },
];

export const judicialStates: Array<Record<string, string | number>> = [];
export const dependencies = ["Office of the Attorney General", "Criminal Division", "Civil Division", "Warrants & Orders Unit", "Public Communications Office", "Technology & Records Unit", "Office of Professional Standards", "Human Resources"];

export const templates: Record<string, string> = {
  "Procedural Order": "# PROCEDURAL ORDER\n\n**Case Number:** {{case_number}}  \n**Federal Court:** {{court}}\n\n## Findings\n[Roleplay findings]\n\n## Order\n[Roleplay order]\n\nROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.",
  "Hearing Minutes": "# HEARING MINUTES\n\n**Date and time:** {{date}}  \n**Case Number:** {{case_number}}  \n**Courtroom / remote link:** {{courtroom}}\n\n## Appearances\n- [Name and role]\n\n## Proceedings\n[Record]\n\n## Rulings\n[Rulings]\n\nROLEPLAY DOCUMENT — NOT A REAL GOVERNMENT OR COURT ORDER.",
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
