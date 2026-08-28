export type RecordContext =
  | "matter"
  | "criminal_investigation"
  | "federal_case"
  | "existing_case_proceeding"
  | "appeal"
  | "warrant_request"
  | "administrative_request";

export type FederalCaseCategory =
  | "Civil"
  | "Criminal"
  | "Magistrate Judge proceeding"
  | "Miscellaneous"
  | "Bankruptcy"
  | "Adversary proceeding"
  | "Appeal"
  | "Supreme Court proceeding"
  | "Specialized federal proceeding";

export type FederalCourtOption = {
  id: string;
  courtSystem: string;
  courtLevel: string;
  officialName: string;
  abbreviation: string;
  circuit?: string | null;
  district?: string | null;
  stateOrTerritory?: string | null;
  acceptedCaseCategories: FederalCaseCategory[];
};

export type CourtDivisionOption = {
  id: string;
  courtId: string;
  name: string;
  city?: string | null;
  courthouseName?: string | null;
  clerkOffice?: string | null;
};

export type NatureOfSuitOption = {
  code: string;
  officialLabel: string;
  displayLabelEs: string;
  category: string;
};

export const recordContextOptions: Array<{ value: RecordContext; label: string; description: string; kind: "matter" | "case" }> = [
  { value: "matter", label: "Asunto interno del DOJ (Matter)", description: "Trabajo interno antes o fuera de una presentación judicial.", kind: "matter" },
  { value: "criminal_investigation", label: "Investigación penal federal", description: "Investigación interna; no recibe Docket Number hasta que exista presentación judicial.", kind: "matter" },
  { value: "federal_case", label: "Caso judicial federal", description: "Procedimiento presentado ante un tribunal federal.", kind: "case" },
  { value: "existing_case_proceeding", label: "Procedimiento relacionado con un caso existente", description: "Incidente, trámite o asunto accesorio vinculado a un Case.", kind: "case" },
  { value: "appeal", label: "Apelación", description: "Revisión ante Court of Appeals o Supreme Court, con record de origen.", kind: "case" },
  { value: "warrant_request", label: "Solicitud de warrant", description: "Puede originarse en un Matter y no requiere un criminal Case ya presentado.", kind: "matter" },
  { value: "administrative_request", label: "Solicitud o trámite administrativo", description: "Trámite interno o administrativo no judicial.", kind: "matter" },
];

export const fallbackFederalCourts: FederalCourtOption[] = [
  {
    id: "81000000-0000-0000-0000-000000000005",
    courtSystem: "United States District Court",
    courtLevel: "district",
    officialName: "United States District Court for the District of Columbia",
    abbreviation: "D.D.C.",
    district: "District of Columbia",
    stateOrTerritory: "District of Columbia",
    acceptedCaseCategories: ["Civil", "Criminal", "Magistrate Judge proceeding", "Miscellaneous"],
  },
  {
    id: "81000000-0000-0000-0000-000000000006",
    courtSystem: "United States District Court",
    courtLevel: "district",
    officialName: "United States District Court for the Southern District of New York",
    abbreviation: "S.D.N.Y.",
    district: "Southern District of New York",
    stateOrTerritory: "New York",
    acceptedCaseCategories: ["Civil", "Criminal", "Magistrate Judge proceeding", "Miscellaneous"],
  },
  {
    id: "81000000-0000-0000-0000-000000000007",
    courtSystem: "United States District Court",
    courtLevel: "district",
    officialName: "United States District Court for the District of New Jersey",
    abbreviation: "D.N.J.",
    district: "District of New Jersey",
    stateOrTerritory: "New Jersey",
    acceptedCaseCategories: ["Civil", "Criminal", "Magistrate Judge proceeding", "Miscellaneous"],
  },
  {
    id: "81000000-0000-0000-0000-000000000002",
    courtSystem: "United States Court of Appeals",
    courtLevel: "appellate",
    officialName: "United States Court of Appeals for the District of Columbia Circuit",
    abbreviation: "D.C. Cir.",
    circuit: "District of Columbia Circuit",
    stateOrTerritory: "District of Columbia",
    acceptedCaseCategories: ["Appeal", "Specialized federal proceeding"],
  },
  {
    id: "81000000-0000-0000-0000-000000000001",
    courtSystem: "Supreme Court of the United States",
    courtLevel: "supreme",
    officialName: "Supreme Court of the United States",
    abbreviation: "SCOTUS",
    stateOrTerritory: "District of Columbia",
    acceptedCaseCategories: ["Supreme Court proceeding", "Appeal"],
  },
];

export const caseCategoryOptions: FederalCaseCategory[] = [
  "Civil",
  "Criminal",
  "Magistrate Judge proceeding",
  "Miscellaneous",
  "Bankruptcy",
  "Adversary proceeding",
  "Appeal",
  "Supreme Court proceeding",
  "Specialized federal proceeding",
];

export const matterTypeOptions = [
  "Preliminary inquiry",
  "Federal criminal investigation",
  "Civil investigation",
  "Defensive civil matter",
  "Affirmative civil enforcement matter",
  "Legal advice matter",
  "Appellate review",
  "Regulatory or administrative matter",
  "Civil rights review",
  "Internal professional-responsibility matter",
  "Asset forfeiture investigation",
  "FOIA or Privacy Act matter",
  "Referral evaluation",
  "International assistance matter",
];

export const matterStatusOptions = [
  "Intake",
  "Conflict check",
  "Preliminary review",
  "Open investigation",
  "Grand jury investigation",
  "Enforcement evaluation",
  "Prosecution memorandum pending",
  "Authorization pending",
  "Active litigation support",
  "Referred to another component",
  "Declined",
  "Closed",
  "Reopened",
  "Archived",
];

export const federalAccessLevels = [
  "Public",
  "Restricted",
  "Sealed",
  "Grand-jury restricted",
  "Internal DOJ only",
] as const;

export const basisOfJurisdictionOptions = [
  "U.S. Government Plaintiff",
  "U.S. Government Defendant",
  "Federal Question",
  "Diversity",
];

export const civilOriginOptions = [
  { value: "1", label: "1 — Original Proceeding" },
  { value: "2", label: "2 — Removed from State Court" },
  { value: "3", label: "3 — Remanded from Appellate Court" },
  { value: "4", label: "4 — Reinstated or Reopened" },
  { value: "5", label: "5 — Transferred from Another District" },
  { value: "6", label: "6 — Multidistrict Litigation Transfer" },
  { value: "8", label: "8 — Multidistrict Litigation Direct File" },
];

export const chargingInstrumentOptions = [
  "Criminal Complaint",
  "Indictment",
  "Superseding Indictment",
  "Information",
  "Superseding Information",
  "Citation or Violation Notice",
];

export const offenseLevelOptions = [
  "Felony",
  "Class A misdemeanor",
  "Class B misdemeanor",
  "Class C misdemeanor",
  "Infraction/petty offense",
];

export const civilParticipantRoles = [
  ["plaintiff", "Plaintiff"],
  ["defendant_civil", "Defendant"],
  ["petitioner", "Petitioner"],
  ["respondent", "Respondent"],
  ["claimant", "Claimant"],
  ["intervenor", "Intervenor"],
  ["third_party_plaintiff", "Third-Party Plaintiff"],
  ["third_party_defendant", "Third-Party Defendant"],
  ["united_states", "United States"],
  ["agency", "Agency"],
  ["interested_party", "Interested Party"],
] as const;

export const criminalParticipantRoles = [
  ["united_states", "United States"],
  ["criminal_defendant", "Defendant"],
  ["ausa", "AUSA / Government Counsel"],
  ["defense_counsel", "Defense Counsel"],
  ["victim", "Victim"],
  ["witness", "Witness"],
  ["material_witness", "Material Witness"],
  ["case_agent", "Investigating Agent"],
  ["probation_officer", "Probation Officer"],
  ["pretrial_services", "Pretrial Services Officer"],
  ["surety", "Surety"],
  ["interested_party", "Interested Party"],
] as const;

export const appealParticipantRoles = [
  ["appellant", "Appellant"],
  ["appellee", "Appellee"],
  ["petitioner", "Petitioner"],
  ["respondent", "Respondent"],
  ["amicus", "Amicus Curiae"],
  ["united_states", "United States"],
  ["agency", "Agency"],
  ["interested_party", "Interested Party"],
] as const;

export const matterParticipantRoles = [
  ["subject", "Subject"],
  ["target", "Target"],
  ["witness", "Witness"],
  ["victim", "Victim"],
  ["complainant", "Complainant"],
  ["referring_agency", "Referring agency"],
  ["investigating_agency", "Investigating agency"],
  ["responsible_attorney", "Responsible attorney"],
  ["related_entity", "Related entity"],
] as const;

export const fallbackNatureOfSuit: NatureOfSuitOption[] = [
  { code: "110", officialLabel: "Insurance", displayLabelEs: "Insurance", category: "Contract" },
  { code: "190", officialLabel: "Other Contract", displayLabelEs: "Other Contract", category: "Contract" },
  { code: "440", officialLabel: "Other Civil Rights", displayLabelEs: "Other Civil Rights", category: "Civil Rights" },
  { code: "442", officialLabel: "Employment", displayLabelEs: "Employment", category: "Civil Rights" },
  { code: "625", officialLabel: "Drug Related Seizure of Property 21 USC 881", displayLabelEs: "Drug Related Seizure of Property 21 USC 881", category: "Forfeiture/Penalty" },
  { code: "710", officialLabel: "Fair Labor Standards Act", displayLabelEs: "Fair Labor Standards Act", category: "Labor" },
  { code: "820", officialLabel: "Copyrights", displayLabelEs: "Copyrights", category: "Property Rights" },
  { code: "830", officialLabel: "Patent", displayLabelEs: "Patent", category: "Property Rights" },
  { code: "870", officialLabel: "Taxes (U.S. Plaintiff or Defendant)", displayLabelEs: "Taxes (U.S. Plaintiff or Defendant)", category: "Federal Tax Suits" },
  { code: "895", officialLabel: "Freedom of Information Act", displayLabelEs: "Freedom of Information Act", category: "Other Statutes" },
  { code: "899", officialLabel: "Administrative Procedure Act/Review or Appeal of Agency Decision", displayLabelEs: "APA / Agency Review", category: "Other Statutes" },
];

export function isMatterContext(context: RecordContext) {
  return ["matter", "criminal_investigation", "warrant_request", "administrative_request"].includes(context);
}

export function categoryFromContext(context: RecordContext, selected: FederalCaseCategory): FederalCaseCategory {
  if (context === "appeal") return "Appeal";
  if (context === "warrant_request") return "Magistrate Judge proceeding";
  if (context === "existing_case_proceeding") return "Miscellaneous";
  return selected;
}

export function caseNumberPrefix(category: string) {
  if (/criminal|magistrate/i.test(category)) return "CR";
  if (/appeal|supreme/i.test(category)) return "AP";
  if (/bankruptcy|adversary/i.test(category)) return "BK";
  if (/civil/i.test(category)) return "CV";
  return "MC";
}
