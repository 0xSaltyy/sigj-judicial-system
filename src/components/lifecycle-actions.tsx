"use client";

import { ArchiveRestore, ArchiveX, Trash2 } from "lucide-react";
import { manageLifecycle } from "@/app/actions/lifecycle";
import { Button } from "@/components/ui/button";

export function LifecycleActions({ resource, id, archived = false, compact = false }: { resource: string; id: string; archived?: boolean; compact?: boolean }) {
  const size = compact ? "sm" : "default";
  return (
    <div className="flex flex-wrap gap-2">
      <form action={manageLifecycle} onSubmit={(event) => { if (!window.confirm(archived ? "¿Restaurar este registro?" : "¿Archivar este registro?")) event.preventDefault(); }}>
        <input type="hidden" name="resource" value={resource} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="operation" value={archived ? "restore" : "archive"} />
        <Button type="submit" size={size} variant="outline" className="gap-2 rounded-none">
          {archived ? <ArchiveRestore className="size-4" /> : <ArchiveX className="size-4" />}
          {archived ? "Restaurar" : "Archivar"}
        </Button>
      </form>
      <form action={manageLifecycle} onSubmit={(event) => { if (!window.confirm("Esta acción eliminará definitivamente el registro. ¿Continuar?")) event.preventDefault(); }}>
        <input type="hidden" name="resource" value={resource} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="operation" value="delete" />
        <input type="hidden" name="confirmation" value="ELIMINAR DEFINITIVAMENTE" />
        <Button type="submit" size={size} variant="outline" className="gap-2 rounded-none border-red-200 text-red-800 hover:bg-red-50">
          <Trash2 className="size-4" /> Eliminar
        </Button>
      </form>
    </div>
  );
}
