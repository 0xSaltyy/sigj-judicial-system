"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { RefreshCw, Search, UserPlus } from "lucide-react";
import { addGrandJuryMemberAction, createAndAssignGrandJuryJurorAccountAction, removeGrandJuryMemberAction } from "@/app/actions/matter-workflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export type GrandJuryAssignableProfile = {
  id: string;
  full_name: string;
  email: string | null;
  institutional_email: string | null;
  role: string;
  position_title: string | null;
  is_active: boolean;
  suspended_at: string | null;
  exclusion_reasons: string[];
};

export type GrandJuryMemberListItem = {
  id: string;
  juror_user_id: string | null;
  juror_participant_number: string;
  display_name: string | null;
  seat_sequence: number | null;
  member_type: string;
  status: string;
  attendance_status: string;
  is_foreperson: boolean;
  is_deputy_foreperson: boolean;
  removed_at: string | null;
  created_at: string | null;
  assigned_by_name: string | null;
};

const serviceStatuses = ["Summoned", "Selected", "Impaneled", "Active", "Excused", "Recused", "Replaced", "Discharged"];

function displayEmail(profile: GrandJuryAssignableProfile) {
  return profile.institutional_email || profile.email || "Sin correo interno";
}

function statusLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "juror") return "Juror";
  if (normalized === "alternate") return "Alternate Juror";
  return value || "Sin registrar";
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" }).format(new Date(value));
}

function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      className="gap-2 rounded-none bg-[#153b5c]"
    >
      <UserPlus className="size-4" /> {pending ? "Procesando…" : children}
    </Button>
  );
}

export function GrandJuryMemberAssignment({
  grandJuryId,
  matterId,
  members,
  candidates,
  selectedPanelSize,
  canChangeMembers,
  canManageMembers,
  nextJurorNumber,
  nextSeatNumber,
}: {
  grandJuryId: string;
  matterId: string;
  members: GrandJuryMemberListItem[];
  candidates: GrandJuryAssignableProfile[];
  selectedPanelSize: number;
  canChangeMembers: boolean;
  canManageMembers: boolean;
  nextJurorNumber: string;
  nextSeatNumber: number;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [memberType, setMemberType] = useState("juror");
  const [jurorNumber, setJurorNumber] = useState(nextJurorNumber);
  const [seatNumber, setSeatNumber] = useState(String(nextSeatNumber));
  const [serviceStatus, setServiceStatus] = useState("Selected");
  const [eligibilityConfirmed, setEligibilityConfirmed] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [createError, setCreateError] = useState("");

  const activeJurors = members.filter((member) => !member.removed_at && member.member_type === "juror" && !["excused", "recused", "replaced", "discharged"].includes(member.status.toLowerCase()));
  const alternates = members.filter((member) => !member.removed_at && member.member_type === "alternate");
  const present = members.filter((member) => !member.removed_at && ["present", "active", "impaneled", "selected"].includes(member.attendance_status.toLowerCase())).length;
  const foreperson = members.some((member) => member.is_foreperson && !member.removed_at);
  const quorumSatisfied = activeJurors.length >= Math.ceil(selectedPanelSize * 2 / 3);
  const panelComplete = activeJurors.length >= selectedPanelSize;

  const filteredCandidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? candidates.filter((profile) => [profile.full_name, profile.email, profile.institutional_email, profile.role, profile.position_title].filter(Boolean).join(" ").toLowerCase().includes(needle))
      : candidates;
    return list.slice(0, 50);
  }, [candidates, query]);

  const selectedProfile = candidates.find((profile) => profile.id === selectedId);
  const selectedAssignable = Boolean(selectedProfile && selectedProfile.exclusion_reasons.length === 0);
  const showNoEligible = candidates.every((profile) => profile.exclusion_reasons.length > 0);

  function validateAssign(event: React.FormEvent<HTMLFormElement>) {
    if (!selectedId) {
      event.preventDefault();
      setInlineError("Seleccione una cuenta/persona antes de asignar al panel.");
      return;
    }
    if (!selectedAssignable) {
      event.preventDefault();
      setInlineError("La cuenta seleccionada no está disponible para este Grand Jury. Revise la razón de exclusión.");
      return;
    }
    if (!eligibilityConfirmed) {
      event.preventDefault();
      setInlineError("Confirme que la persona es elegible y no tiene conflicto incompatible en este Matter.");
      return;
    }
    setInlineError("");
  }

  function validateCreate(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "");
    const password = String(data.get("temporary_password") || "");
    const confirm = String(data.get("confirm_password") || "");
    const accountStatus = String(data.get("account_status") || "active");
    if (!email.endsWith(".test")) {
      event.preventDefault();
      setCreateError("Use un correo ficticio terminado en .test.");
      return;
    }
    if (accountStatus !== "active") {
      event.preventDefault();
      setCreateError("Para asignar el jurado inmediatamente, la cuenta debe crearse activa.");
      return;
    }
    if (password.length < 12 || password !== confirm) {
      event.preventDefault();
      setCreateError("La contraseña temporal debe tener al menos 12 caracteres y coincidir con la confirmación.");
      return;
    }
    setCreateError("");
  }

  return (
    <div className="mt-4 rounded border bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-600">Jury Members</p>
          <p className="mt-1 text-xs text-slate-600">
            {Math.min(activeJurors.length, selectedPanelSize)} of {selectedPanelSize} seats filled{panelComplete ? " — Panel complete" : ""} · {alternates.length} alternates · {present} present · quorum {quorumSatisfied ? "satisfied" : "pending"} · foreperson {foreperson ? "designated" : "pending"}
          </p>
        </div>
        <Badge className={panelComplete ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}>
          {panelComplete ? "Panel complete" : "Panel incomplete"}
        </Badge>
      </div>

      {members.length === 0 ? (
        <div className="mt-3 rounded border border-dashed bg-white p-4">
          <p className="text-sm font-semibold text-[#153553]">No members assigned yet.</p>
          {showNoEligible ? <p className="mt-1 text-sm text-slate-600">No eligible juror accounts are available.</p> : <p className="mt-1 text-sm text-slate-600">Search an active internal account or create a juror account for this panel.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <CreateJurorDialog
              grandJuryId={grandJuryId}
              matterId={matterId}
              nextJurorNumber={jurorNumber}
              nextSeatNumber={seatNumber}
              memberType={memberType}
              serviceStatus={serviceStatus}
              disabled={!canManageMembers || !canChangeMembers}
              createError={createError}
              onValidate={validateCreate}
            />
            <Button asChild variant="outline" className="rounded-none"><Link href="/admin/usuarios">Review existing users</Link></Button>
            <Button type="button" variant="outline" className="gap-2 rounded-none" onClick={() => window.location.reload()}><RefreshCw className="size-4" /> Refresh list</Button>
          </div>
        </div>
      ) : (
        <Table className="mt-3 bg-white">
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead>Juror Number</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Seat</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Foreperson</TableHead>
              <TableHead>Date assigned</TableHead>
              <TableHead>Assigned by</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id} className={member.removed_at ? "opacity-60" : ""}>
                <TableCell className="font-mono text-xs font-semibold">{member.juror_participant_number}</TableCell>
                <TableCell>{member.display_name || "Unnamed juror"}</TableCell>
                <TableCell>{member.seat_sequence ?? "—"}</TableCell>
                <TableCell>{statusLabel(member.member_type)}</TableCell>
                <TableCell>{member.status}{member.removed_at ? " · removed" : ""}</TableCell>
                <TableCell>{member.attendance_status}</TableCell>
                <TableCell>{member.is_foreperson ? "Foreperson" : member.is_deputy_foreperson ? "Deputy foreperson" : "—"}</TableCell>
                <TableCell>{formatDate(member.created_at)}</TableCell>
                <TableCell>{member.assigned_by_name || "System"}</TableCell>
                <TableCell>
                  {!member.removed_at && canChangeMembers ? (
                    <form action={removeGrandJuryMemberAction} className="flex gap-1">
                      <input type="hidden" name="member_id" value={member.id} />
                      <input type="hidden" name="return_to" value={`/admin/matters/${matterId}`} />
                      <input type="hidden" name="status" value="discharged" />
                      <input type="hidden" name="reason" value="Removed before impaneling/vote" />
                      <Button variant="outline" size="sm" className="rounded-none">Remove before impanelment</Button>
                    </form>
                  ) : <span className="text-xs text-muted-foreground">History retained</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {canChangeMembers ? (
        <div className="mt-4 rounded border bg-white p-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <div className="space-y-2">
              <Label htmlFor={`juror-search-${grandJuryId}`}>Person or account</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input id={`juror-search-${grandJuryId}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, username, email or role…" className="pl-9" />
              </div>
              <div className="max-h-64 overflow-auto rounded border">
                {filteredCandidates.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No eligible juror accounts are available.</p>
                ) : filteredCandidates.map((profile) => {
                  const disabled = profile.exclusion_reasons.length > 0;
                  return (
                    <button
                      type="button"
                      key={profile.id}
                      disabled={disabled}
                      onClick={() => { setSelectedId(profile.id); setInlineError(""); }}
                      className={`w-full border-b p-3 text-left text-sm last:border-b-0 ${selectedId === profile.id ? "bg-blue-50" : "bg-white hover:bg-slate-50"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <span className="block font-semibold text-[#153553]">{profile.full_name}</span>
                      <span className="block text-xs text-slate-600">{displayEmail(profile)} · {profile.position_title || profile.role} · {profile.role}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className={profile.is_active && !profile.suspended_at ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}>{profile.is_active && !profile.suspended_at ? "Active" : "Suspended/Inactive"}</Badge>
                        <Badge variant="outline">{profile.role === "GRAND_JUROR" ? "Grand Jury eligible role" : "Panel-specific eligibility required"}</Badge>
                        {profile.exclusion_reasons.length > 0 ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">{profile.exclusion_reasons.join(", ")}</Badge> : <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-900">Available for assignment</Badge>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <form action={addGrandJuryMemberAction} onSubmit={validateAssign} className="grid gap-3">
              <input type="hidden" name="grand_jury_id" value={grandJuryId} />
              <input type="hidden" name="return_to" value={`/admin/matters/${matterId}`} />
              <input type="hidden" name="juror_user_id" value={selectedId} />
              <input type="hidden" name="eligibility_confirmed" value={eligibilityConfirmed ? "true" : ""} />
              <div>
                <Label htmlFor={`member-type-${grandJuryId}`}>Jury position</Label>
                <select id={`member-type-${grandJuryId}`} name="member_type" value={memberType} onChange={(event) => setMemberType(event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm">
                  <option value="juror">Juror</option>
                  <option value="alternate">Alternate Juror</option>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor={`juror-number-${grandJuryId}`}>Juror number</Label><Input id={`juror-number-${grandJuryId}`} name="juror_participant_number" value={jurorNumber} onChange={(event) => setJurorNumber(event.target.value)} /></div>
                <div><Label htmlFor={`seat-${grandJuryId}`}>Seat number</Label><Input id={`seat-${grandJuryId}`} name="seat_sequence" type="number" min="1" value={seatNumber} onChange={(event) => setSeatNumber(event.target.value)} /></div>
              </div>
              <div>
                <Label htmlFor={`status-${grandJuryId}`}>Service status</Label>
                <select id={`status-${grandJuryId}`} name="status" value={serviceStatus} onChange={(event) => setServiceStatus(event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm">
                  {serviceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <label className="flex gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                <input type="checkbox" checked={eligibilityConfirmed} onChange={(event) => setEligibilityConfirmed(event.target.checked)} />
                I confirm this person is eligible for this Grand Jury and has no incompatible role in this Matter.
              </label>
              {inlineError ? <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{inlineError}</p> : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-none" onClick={() => { setSelectedId(""); setInlineError(""); }}>Cancel</Button>
                <CreateJurorDialog
                  grandJuryId={grandJuryId}
                  matterId={matterId}
                  nextJurorNumber={jurorNumber}
                  nextSeatNumber={seatNumber}
                  memberType={memberType}
                  serviceStatus={serviceStatus}
                  disabled={!canManageMembers}
                  createError={createError}
                  onValidate={validateCreate}
                />
                <SubmitButton disabled={!selectedId || !selectedAssignable || !canManageMembers}>Add selected member</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Members are locked after the first voting round opens. Alternates require a formal replacement record.</p>
      )}
    </div>
  );
}

function CreateJurorDialog({
  grandJuryId,
  matterId,
  nextJurorNumber,
  nextSeatNumber,
  memberType,
  serviceStatus,
  disabled,
  createError,
  onValidate,
}: {
  grandJuryId: string;
  matterId: string;
  nextJurorNumber: string;
  nextSeatNumber: string;
  memberType: string;
  serviceStatus: string;
  disabled: boolean;
  createError: string;
  onValidate: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="gap-2 rounded-none"><UserPlus className="size-4" /> Create juror account</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create juror account</DialogTitle>
          <DialogDescription>Create a confirmed `.test` authentication account and assign it to this Grand Jury without sending email.</DialogDescription>
        </DialogHeader>
        <form action={createAndAssignGrandJuryJurorAccountAction} onSubmit={onValidate} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="grand_jury_id" value={grandJuryId} />
          <input type="hidden" name="return_to" value={`/admin/matters/${matterId}`} />
          <input type="hidden" name="member_type" value={memberType} />
          <input type="hidden" name="status" value={serviceStatus} />
          <input type="hidden" name="juror_participant_number" value={nextJurorNumber} />
          <input type="hidden" name="seat_sequence" value={nextSeatNumber} />
          <div className="space-y-2"><Label htmlFor="juror-full-name">Full name</Label><Input id="juror-full-name" name="full_name" required /></div>
          <div className="space-y-2"><Label htmlFor="juror-display-name">Display name</Label><Input id="juror-display-name" name="display_name" /></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="juror-email">Fictional authentication email</Label><Input id="juror-email" name="email" type="email" required placeholder="juror01@doj-roleplay.test" /><p className="text-xs text-muted-foreground">Must end in <code>.test</code>; no mailbox is required and no invitation email is sent.</p></div>
          <div className="space-y-2"><Label htmlFor="juror-password">Temporary password</Label><Input id="juror-password" name="temporary_password" type="password" required minLength={12} /></div>
          <div className="space-y-2"><Label htmlFor="juror-confirm">Confirm password</Label><Input id="juror-confirm" name="confirm_password" type="password" required minLength={12} /></div>
          <div className="space-y-2"><Label htmlFor="juror-type">Juror type</Label><select id="juror-type" name="juror_type" className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="GRAND_JUROR">Grand Juror</option><option value="TRIAL_JUROR">Trial Juror</option></select></div>
          <div className="space-y-2"><Label htmlFor="account-status">Account status</Label><select id="account-status" name="account_status" className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="active">Active</option><option value="suspended">Suspended</option></select><p className="text-xs text-muted-foreground">Immediate panel assignment requires an active account.</p></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="juror-notes">Optional notes</Label><Textarea id="juror-notes" name="notes" /></div>
          <label className="flex gap-2 text-xs md:col-span-2"><input type="checkbox" name="must_change_password" defaultChecked /> Require password change on first login</label>
          {createError ? <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 md:col-span-2">{createError}</p> : null}
          <DialogFooter className="md:col-span-2">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <SubmitButton>Create and assign</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
