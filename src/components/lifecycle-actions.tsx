"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { manageRecordLifecycle } from "@/app/actions/records";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Resource = "cases" | "radications" | "case_actions" | "documents" | "hearings" | "proceedings" | "public_notices" | "judicial_states" | "hearing_minutes" | "dependencies";
type Operation = "archive" | "restore" | "delete";

type Props = {
  resource: Resource;
  recordId: string;
  recordLabel: string;
  destination: string;
  archived: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canHardDelete: boolean;
  compact?: boolean;
};

export function LifecycleActions(props: Props) {
  const [operation, setOperation] = useState<Operation>(props.archived ? "restore" : "archive");
  const [confirmation, setConfirmation] = useState("");
  const hardDelete = operation === "delete";
  const allowed = hardDelete ? props.canHardDelete : operation === "restore" ? props.canRestore : props.canArchive;
  const copy = hardDelete
    ? `Esta acción elimina definitivamente “${props.recordLabel}” y puede fallar si conserva relaciones judiciales. No se puede deshacer.`
    : operation === "restore"
      ? `“${props.recordLabel}” volverá a su estado anterior y podrá gestionarse nuevamente.`
      : `“${props.recordLabel}” quedará en solo lectura y dejará de aparecer en vistas públicas.`;

  return <div className="flex flex-wrap gap-2">
    <Dialog onOpenChange={(open) => { if (!open) setConfirmation(""); }}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size={props.compact ? "sm" : "default"}
          variant="outline"
          disabled={props.archived ? !props.canRestore : !props.canArchive}
          title={props.archived ? (props.canRestore ? "Restaurar registro" : "No tiene permiso para restaurar este registro") : (props.canArchive ? "Archivar registro" : "No tiene permiso para archivar este registro")}
          onClick={() => setOperation(props.archived ? "restore" : "archive")}
        >
          {props.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          {props.archived ? "Restaurar" : "Archivar"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{operation === "restore" ? "Restaurar registro" : "Archivar registro"}</DialogTitle><DialogDescription>{copy}</DialogDescription></DialogHeader>
        <form action={manageRecordLifecycle}>
          <LifecycleFields {...props} operation={operation} confirmation={confirmation} />
          <DialogFooter className="mt-4"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit" disabled={!allowed}>{operation === "restore" ? "Restaurar" : "Archivar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {props.canHardDelete && <Dialog onOpenChange={(open) => { if (!open) setConfirmation(""); }}>
      <DialogTrigger asChild><Button type="button" size={props.compact ? "sm" : "default"} variant="destructive" onClick={() => setOperation("delete")}><Trash2 className="size-4" /> Eliminar definitivamente</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Eliminación definitiva restringida</DialogTitle><DialogDescription>{copy}</DialogDescription></DialogHeader>
        <form action={manageRecordLifecycle} className="space-y-4">
          <LifecycleFields {...props} operation="delete" confirmation={confirmation} />
          <div><label htmlFor={`confirmation-${props.recordId}`} className="text-xs font-semibold">Escriba ELIMINAR DEFINITIVAMENTE</label><Input id={`confirmation-${props.recordId}`} name="confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="mt-2" /></div>
          <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit" variant="destructive" disabled={confirmation !== "ELIMINAR DEFINITIVAMENTE"}>Eliminar definitivamente</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>}
  </div>;
}

function LifecycleFields({ resource, recordId, destination, operation }: Props & { operation: Operation; confirmation: string }) {
  return <><input type="hidden" name="resource" value={resource} /><input type="hidden" name="record_id" value={recordId} /><input type="hidden" name="operation" value={operation} /><input type="hidden" name="destination" value={destination} /></>;
}
