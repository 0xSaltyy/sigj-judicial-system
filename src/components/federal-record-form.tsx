"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, FileUp, Plus, Save, Trash2 } from "lucide-react";
import { createFederalRecord } from "@/app/actions/cases";
import {
  appealParticipantRoles,
  basisOfJurisdictionOptions,
  caseCategoryOptions,
  chargingInstrumentOptions,
  civilOriginOptions,
  civilParticipantRoles,
  criminalParticipantRoles,
  federalAccessLevels,
  fallbackFederalCourts,
  fallbackNatureOfSuit,
  isMatterContext,
  matterParticipantRoles,
  matterStatusOptions,
  matterTypeOptions,
  recordContextOptions,
  type FederalCaseCategory,
  type CourtDivisionOption,
  type FederalCourtOption,
  type NatureOfSuitOption,
  type RecordContext,
} from "@/lib/federal-model";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ParticipantDraft = {
  legal_name: string;
  display_name: string;
  person_or_organization: "person" | "organization" | "agency";
  role_code: string;
  side: string;
  counsel: string;
  government_agency: string;
  sealed: boolean;
  minor: boolean;
  pseudonym: boolean;
  notes: string;
};

type FormDraft = {
  recordContext: RecordContext;
  caseCategory: FederalCaseCategory;
  courtId: string;
  accessLevel: string;
};

type Props = {
  courts: FederalCourtOption[];
  divisions: CourtDivisionOption[];
  natureOfSuit: NatureOfSuitOption[];
  error?: string;
};

const storageKey = "doj-federal-record-form-draft";
const defaultParticipant = (roleCode: string): ParticipantDraft => ({
  legal_name: "",
  display_name: "",
  person_or_organization: "person",
  role_code: roleCode,
  side: "",
  counsel: "",
  government_agency: "",
  sealed: false,
  minor: false,
  pseudonym: false,
  notes: "",
});

export function FederalRecordForm({ courts, divisions, natureOfSuit, error }: Props) {
  const safeCourts = courts.length ? courts : fallbackFederalCourts;
  const safeNatureOfSuit = natureOfSuit.length ? natureOfSuit : fallbackNatureOfSuit;
  const [recordContext, setRecordContext] = useState<RecordContext>("matter");
  const [caseCategory, setCaseCategory] = useState<FederalCaseCategory>("Civil");
  const [courtId, setCourtId] = useState(safeCourts[0]?.id ?? "");
  const [accessLevel, setAccessLevel] = useState<(typeof federalAccessLevels)[number]>("Internal DOJ only");
  const [step, setStep] = useState(1);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([defaultParticipant("subject")]);
  const [isPending, startTransition] = useTransition();
  const selectedCourt = safeCourts.find((court) => court.id === courtId) ?? safeCourts[0];
  const courtDivisions = divisions.filter((division) => division.courtId === selectedCourt?.id);
  const matter = isMatterContext(recordContext);
  const effectiveCategory: FederalCaseCategory =
    recordContext === "appeal" ? "Appeal" :
    recordContext === "warrant_request" ? "Magistrate Judge proceeding" :
    recordContext === "existing_case_proceeding" ? "Miscellaneous" :
    caseCategory;
  const allowedCategories = useMemo(() => {
    const acceptedCategories = selectedCourt?.acceptedCaseCategories?.length ? selectedCourt.acceptedCaseCategories : caseCategoryOptions;
    return caseCategoryOptions.filter((category) => acceptedCategories.includes(category));
  }, [selectedCourt]);
  const roleOptions = useMemo(() => {
    if (matter) return matterParticipantRoles;
    if (effectiveCategory === "Criminal" || effectiveCategory === "Magistrate Judge proceeding") return criminalParticipantRoles;
    if (effectiveCategory === "Appeal" || effectiveCategory === "Supreme Court proceeding") return appealParticipantRoles;
    return civilParticipantRoles;
  }, [effectiveCategory, matter]);
  const visibleSteps = matter ? ["Contexto", "Matter", "Participantes", "Acceso", "Revisión"] : ["Contexto", "Foro", "Clasificación", "Participantes", "Acceso", "Revisión"];

  useEffect(() => {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Partial<FormDraft> & { participants?: ParticipantDraft[] };
      if (draft.recordContext) setRecordContext(draft.recordContext);
      if (draft.caseCategory) setCaseCategory(draft.caseCategory);
      if (draft.courtId) setCourtId(draft.courtId);
      if (draft.accessLevel && federalAccessLevels.includes(draft.accessLevel as (typeof federalAccessLevels)[number])) setAccessLevel(draft.accessLevel as (typeof federalAccessLevels)[number]);
      if (Array.isArray(draft.participants) && draft.participants.length) setParticipants(draft.participants);
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify({ recordContext, caseCategory, courtId, accessLevel, participants }));
  }, [recordContext, caseCategory, courtId, accessLevel, participants]);

  useEffect(() => {
    if (matter) return;
    if (!allowedCategories.includes(caseCategory)) setCaseCategory(allowedCategories[0] ?? "Civil");
  }, [allowedCategories, caseCategory, matter]);

  useEffect(() => {
    if (!matter) return;
    setAccessLevel((current) => current === "Public" ? "Internal DOJ only" : current);
    setParticipants((current) => current.length ? current.map((participant, index) => ({ ...participant, role_code: participant.role_code || (index === 0 ? "subject" : "witness") })) : [defaultParticipant("subject")]);
  }, [matter]);

  function updateParticipant(index: number, update: Partial<ParticipantDraft>) {
    setParticipants((current) => current.map((participant, currentIndex) => currentIndex === index ? { ...participant, ...update } : participant));
  }

  function addParticipant() {
    const defaultRole = matter ? "witness" : effectiveCategory === "Criminal" ? "criminal_defendant" : effectiveCategory === "Appeal" ? "appellant" : "defendant_civil";
    setParticipants((current) => [...current, defaultParticipant(defaultRole)]);
  }

  function removeParticipant(index: number) {
    setParticipants((current) => current.length <= 1 ? current : current.filter((_, currentIndex) => currentIndex !== index));
  }

  function submit(formData: FormData) {
    sessionStorage.removeItem(storageKey);
    startTransition(() => {
      void createFederalRecord(formData);
    });
  }

  return (
    <form action={submit} className="space-y-5">
      <input type="hidden" name="record_context" value={recordContext} />
      <input type="hidden" name="case_category" value={effectiveCategory} />
      <input type="hidden" name="federal_access_level" value={accessLevel} />
      <input type="hidden" name="participants_json" value={JSON.stringify(participants.filter((participant) => participant.legal_name.trim()))} />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-[#f7f9fb]">
          <CardTitle className="text-base text-[#153553]">Secuencia guiada de apertura</CardTitle>
          <p className="text-sm text-muted-foreground">Primero se distingue si está abriendo un Matter interno del DOJ o un Case presentado ante un tribunal federal.</p>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSteps.map((label, index) => (
            <button
              type="button"
              key={label}
              onClick={() => setStep(index + 1)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition ${step === index + 1 ? "border-[#1a4480] bg-[#eff6fb] text-[#112f4e]" : "bg-white hover:bg-slate-50"}`}
            >
              <span className="grid size-7 place-items-center rounded-full bg-[#112f4e] text-xs font-semibold text-white">{index + 1}</span>
              <span>{label}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className={step === 1 ? "block" : "hidden"}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">1. ¿Qué desea abrir?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {recordContextOptions.map((option) => (
              <label key={option.value} className={`cursor-pointer rounded-lg border p-4 transition ${recordContext === option.value ? "border-[#005ea8] bg-[#eff6fb]" : "bg-white hover:bg-slate-50"}`}>
                <input
                  className="sr-only"
                  type="radio"
                  name="context_picker"
                  checked={recordContext === option.value}
                  onChange={() => {
                    setRecordContext(option.value);
                    setStep(2);
                  }}
                />
                <span className="text-sm font-semibold text-[#153553]">{option.label}</span>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">{option.description}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      {matter && (
        <div className={step === 2 ? "block" : "hidden"}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">2. Información del Matter</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <TextField label="Matter title" name="title" required />
            <SelectField label="Matter type" name="matter_type" options={matterTypeOptions} />
            <SelectField label="Status" name="matter_status" options={matterStatusOptions} />
            <TextField label="Lead DOJ component" name="lead_component" placeholder="Office of the Attorney General" />
            <TextField label="Participating components" name="participating_components" placeholder="Criminal Division; Civil Division" />
            <TextField label="Investigating agency" name="investigating_agency" placeholder="FBI, DEA, U.S. Marshals, etc." />
            <TextField label="Referring agency" name="referring_agency" />
            <TextField label="Referral date" name="referral_date" type="date" />
            <TextField label="Open date" name="filed_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            <TextField label="Jurisdiction" name="jurisdiction" placeholder="United States / District" />
            <TextField label="Investigative district" name="investigative_district" placeholder="District of Columbia" />
            <TextField label="Statutes under review" name="statutes_under_review" placeholder="18 U.S.C. § 1343; 18 U.S.C. § 371" />
            <div className="md:col-span-2"><TextAreaField label="Matter summary" name="summary" required /></div>
            <div className="md:col-span-2"><TextAreaField label="Access restrictions / handling instructions" name="access_restrictions" /></div>
            <div className="md:col-span-2"><TextField label="Limitation or deadline dates" name="limitation_deadlines" placeholder="List dates or notes separated by semicolons" /></div>
          </CardContent>
        </Card>
        </div>
      )}

      {!matter && (
        <div className={step === 2 ? "block" : "hidden"}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">2. Federal forum</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="court_id">Federal court <span className="text-red-600">*</span></Label>
              <select id="court_id" name="court_id" required value={courtId} onChange={(event) => setCourtId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30">
                {safeCourts.map((court) => (
                  <option key={court.id} value={court.id}>{court.officialName} ({court.abbreviation})</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">El Docket Number se registra solo si ya fue asignado por Clerk’s Office.</p>
            </div>
            <TextField label="Case title" name="title" required />
            <TextField label="Case caption" name="case_caption" placeholder="United States v. Doe / Smith v. Agency" />
            <TextField label="Open / filing date" name="filed_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            {courtDivisions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="court_division_id">Geographic division / Clerk’s Office</Label>
                <select id="court_division_id" name="court_division_id" className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30">
                  <option value="">Select division if applicable…</option>
                  {courtDivisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}{division.city ? ` — ${division.city}` : ""}{division.courthouseName ? ` · ${division.courthouseName}` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Only shown when the selected court uses configured divisions.</p>
              </div>
            )}
            <TextField label="Docket Number, if assigned" name="docket_number" placeholder="1:26-cv-12345" />
            <TextField label="Originating court or agency" name="originating_court_or_agency" />
            <TextField label="Originating Case Number" name="originating_case_number" />
            <TextField label="Originating Docket Number" name="originating_docket_number" />
            <TextField label="Appellate Docket Number" name="appellate_docket_number" />
            <div className="md:col-span-2"><TextAreaField label="Case summary" name="summary" required /></div>
            <div className="md:col-span-2"><TextAreaField label="Requested relief / charging summary / appellate issue" name="requested_relief" /></div>
          </CardContent>
        </Card>
        </div>
      )}

      {!matter && (
        <div className={step === 3 ? "block" : "hidden"}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">3. Case Category y clasificación condicional</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category_picker">Case Category</Label>
              <select
                id="category_picker"
                disabled={recordContext === "appeal" || recordContext === "warrant_request" || recordContext === "existing_case_proceeding"}
                value={effectiveCategory}
                onChange={(event) => setCaseCategory(event.target.value as FederalCaseCategory)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:bg-slate-100"
              >
                {allowedCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>

            {effectiveCategory === "Civil" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nature_of_suit_code">Nature of Suit</Label>
                  <select id="nature_of_suit_code" name="nature_of_suit_code" className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30">
                    <option value="">Select JS 44 code…</option>
                    {safeNatureOfSuit.map((item) => <option key={item.code} value={item.code}>{item.code} — {item.officialLabel} ({item.category})</option>)}
                  </select>
                </div>
                <SelectField label="Basis of Jurisdiction" name="basis_of_jurisdiction" options={basisOfJurisdictionOptions} />
                <SelectField label="Origin" name="origin_code" options={civilOriginOptions.map((item) => item.value)} optionLabels={Object.fromEntries(civilOriginOptions.map((item) => [item.value, item.label]))} />
                <TextField label="Cause of Action" name="cause_of_action" placeholder="42 U.S.C. § 1983" />
                <TextField label="Plaintiff citizenship, if diversity" name="plaintiff_citizenship" />
                <TextField label="Defendant citizenship, if diversity" name="defendant_citizenship" />
                <TextField label="Amount in controversy" name="amount_in_controversy" type="number" />
                <TextField label="County of residence, if required locally" name="county_of_residence" />
                <CheckField label="Jury demand" name="jury_demand" />
                <CheckField label="Class action" name="class_action" />
                <CheckField label="Related case" name="related_case_indicator" />
                <CheckField label="Multidistrict litigation" name="multidistrict_litigation_indicator" />
                <CheckField label="Summons requested" name="summons_requested" />
                <CheckField label="In forma pauperis request" name="ifp_requested" />
                <TextField label="Filing fee status" name="filing_fee_status" />
              </>
            )}

            {(effectiveCategory === "Criminal" || effectiveCategory === "Magistrate Judge proceeding") && (
              <>
                <SelectField label="Charging instrument" name="charging_instrument" options={chargingInstrumentOptions} />
                <TextField label="Complaint number, if applicable" name="complaint_number" />
                <TextField label="Indictment / Information number" name="indictment_number" />
                <TextField label="Offense statutes" name="offense_statutes" placeholder="18 U.S.C. § 1343; 18 U.S.C. § 371" />
                <TextField label="Counts" name="counts" placeholder="Count One — Wire fraud; Count Two — Conspiracy" />
                <SelectField label="Offense level" name="offense_level" options={["", "Felony", "Class A misdemeanor", "Class B misdemeanor", "Class C misdemeanor", "Infraction/petty offense"]} />
                <TextField label="Arrest status" name="arrest_status" />
                <TextField label="Custody status" name="custody_status" />
                <TextField label="Grand-jury status" name="grand_jury_status" />
                <TextField label="Prosecuting office" name="prosecuting_office" />
                <TextField label="Lead AUSA" name="lead_ausa" />
                <div className="md:col-span-2"><TextAreaField label="Offense description" name="offense_description" /></div>
              </>
            )}

            {effectiveCategory === "Appeal" && (
              <>
                <TextField label="Notice of Appeal date" name="notice_of_appeal_date" type="date" />
                <TextField label="Appellate basis" name="appellate_basis" placeholder="Final judgment / agency review / interlocutory appeal" />
                <TextField label="Supreme Court petition status" name="supreme_court_petition_status" />
                <CheckField label="Cross-appeal" name="cross_appeal" />
                <CheckField label="Agency review" name="agency_review" />
              </>
            )}

            {!["Civil", "Criminal", "Magistrate Judge proceeding", "Appeal"].includes(effectiveCategory) && (
              <Alert className="md:col-span-2 border-amber-200 bg-amber-50">
                <AlertCircle className="size-4 text-amber-800" />
                <AlertDescription className="text-amber-900">Esta categoría queda sujeta a configuración OWNER por tribunal: identificadores requeridos, tipos de filing, roles y workflow.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      <div className={step === (matter ? 3 : 4) ? "block" : "hidden"}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">Participantes estructurados</CardTitle>
            <p className="text-sm text-muted-foreground">Use roles federales precisos. Subject/Target no implica culpabilidad; Plaintiff/Defendant civil no se usa en Criminal Cases.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {participants.map((participant, index) => (
              <div key={index} className="grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2 xl:col-span-2">
                  <Label>Legal name</Label>
                  <Input value={participant.legal_name} onChange={(event) => updateParticipant(index, { legal_name: event.target.value })} placeholder="Name or organization" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select value={participant.role_code} onChange={(event) => updateParticipant(index, { role_code: event.target.value })} className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm">
                    {roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Kind</Label>
                  <select value={participant.person_or_organization} onChange={(event) => updateParticipant(index, { person_or_organization: event.target.value as ParticipantDraft["person_or_organization"] })} className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm">
                    <option value="person">Person</option>
                    <option value="organization">Organization</option>
                    <option value="agency">Agency</option>
                  </select>
                </div>
                <Input value={participant.display_name} onChange={(event) => updateParticipant(index, { display_name: event.target.value })} placeholder="Display name" />
                <Input value={participant.side} onChange={(event) => updateParticipant(index, { side: event.target.value })} placeholder="Side / alignment" />
                <Input value={participant.counsel} onChange={(event) => updateParticipant(index, { counsel: event.target.value })} placeholder="Counsel" />
                <Input value={participant.government_agency} onChange={(event) => updateParticipant(index, { government_agency: event.target.value })} placeholder="Agency" />
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={participant.sealed} onChange={(event) => updateParticipant(index, { sealed: event.target.checked })} /> Sealed</label>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={participant.minor} onChange={(event) => updateParticipant(index, { minor: event.target.checked })} /> Minor</label>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={participant.pseudonym} onChange={(event) => updateParticipant(index, { pseudonym: event.target.checked })} /> Pseudonym</label>
                <div className="flex justify-end xl:col-span-1"><Button type="button" variant="outline" size="sm" onClick={() => removeParticipant(index)} className="gap-2"><Trash2 className="size-3.5" /> Quitar</Button></div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addParticipant} className="gap-2"><Plus className="size-4" /> Agregar participante</Button>
          </CardContent>
        </Card>
      </div>

      <div className={step === (matter ? 4 : 5) ? "block" : "hidden"}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">Acceso, sealed y grand-jury</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="access_level_picker">Access level</Label>
              <select id="access_level_picker" value={accessLevel} onChange={(event) => setAccessLevel(event.target.value as (typeof federalAccessLevels)[number])} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                {federalAccessLevels.map((level) => <option key={level}>{level}</option>)}
              </select>
            </div>
            {!matter && accessLevel === "Public" && <CheckField label="Mark as public-safe Case" name="public_visibility" />}
            <CheckField label="Sealed record" name="sealed" />
            <CheckField label="Grand-jury restricted" name="grand_jury_restricted" />
            <div className="md:col-span-2"><TextAreaField label="Access restrictions / handling instructions" name="access_restrictions" /></div>
            <label htmlFor="attachment" className="md:col-span-2 flex cursor-pointer flex-col items-center rounded-lg border border-dashed p-8 text-center hover:bg-slate-50">
              <FileUp className="size-7 text-[#416786]" />
              <span className="mt-3 text-sm font-semibold text-[#153553]">Attach initial document</span>
              <span className="mt-1 text-xs text-muted-foreground">Stored in protected storage; internal filings are not published as court docket entries.</span>
              <Input id="attachment" name="attachment" type="file" className="mt-4 max-w-sm" />
            </label>
          </CardContent>
        </Card>
      </div>

      <div className={step === (matter ? 5 : 6) ? "block" : "hidden"}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#153553]">Revisión final</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_.8fr]">
            <div className="rounded-lg border bg-slate-50 p-5 text-sm leading-6">
              <p className="font-semibold text-[#153553]">{matter ? "Se abrirá un Matter interno" : "Se abrirá un Case judicial federal"}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Matter Number y Case Number se generan en el servidor y no se reutilizan.</li>
                <li>Docket Number es independiente y solo representa el identificador del tribunal.</li>
                <li>Los participantes sealed, menores o con pseudónimo no se exponen en vistas públicas.</li>
                <li>Las actividades internas del DOJ no se publican como docket entries.</li>
              </ul>
            </div>
            <div className="rounded-lg border p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#153553]"><CheckCircle2 className="size-4 text-emerald-700" /> Validación previa</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">El servidor volverá a validar tribunal, categoría, roles, sealed/grand-jury, Nature of Suit, charging instrument y origen de apelaciones antes de escribir datos.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 border bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Borrador temporal guardado en esta pestaña. No sustituye la persistencia en Supabase.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={step <= 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>Atrás</Button>
          <Button type="button" variant="outline" disabled={step >= visibleSteps.length} onClick={() => setStep((current) => Math.min(visibleSteps.length, current + 1))}>Continuar</Button>
          <Button type="submit" disabled={isPending} className="gap-2 bg-[#153b5c]"><Save className="size-4" /> {isPending ? "Creando…" : matter ? "Crear Matter" : "Crear Case"}</Button>
        </div>
      </div>
    </form>
  );
}

function TextField({ label, name, type = "text", required, defaultValue, placeholder }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}{required && <span className="text-red-600"> *</span>}</Label><Input id={name} name={name} type={type} aria-required={required} defaultValue={defaultValue} placeholder={placeholder} /></div>;
}

function TextAreaField({ label, name, required }: { label: string; name: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}{required && <span className="text-red-600"> *</span>}</Label><Textarea id={name} name={name} aria-required={required} className="min-h-28" /></div>;
}

function SelectField({ label, name, options, optionLabels }: { label: string; name: string; options: string[]; optionLabels?: Record<string, string> }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30">
        <option value="">Select…</option>
        {options.filter((option) => option !== "").map((option) => <option key={option} value={option}>{optionLabels?.[option] ?? option}</option>)}
      </select>
    </div>
  );
}

function CheckField({ label, name }: { label: string; name: string }) {
  return <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm"><input name={name} type="checkbox" className="size-4" /> {label}</label>;
}
