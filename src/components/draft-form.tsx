"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FormAction = (formData: FormData) => void | Promise<void>;
type StoredDraft = {
  savedAt: number;
  values: Record<string, string | boolean>;
};

export function DraftForm({
  action,
  storageKey,
  className,
  children,
}: {
  action: FormAction;
  storageKey: string;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("success")) {
      sessionStorage.removeItem(storageKey);
      return;
    }
    const raw = sessionStorage.getItem(storageKey);
    if (!raw || !formRef.current) return;
    try {
      const draft = JSON.parse(raw) as StoredDraft;
      if (Date.now() - draft.savedAt > 2 * 60 * 60 * 1000) {
        sessionStorage.removeItem(storageKey);
        return;
      }
      Object.entries(draft.values).forEach(([name, value]) => {
        const field = formRef.current?.elements.namedItem(name);
        if (field instanceof HTMLInputElement && field.type === "checkbox")
          field.checked = Boolean(value);
        else if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement ||
          field instanceof HTMLSelectElement
        )
          field.value = String(value);
        if (field instanceof HTMLElement)
          field.dispatchEvent(new Event("input", { bubbles: true }));
      });
      setSavedAt(draft.savedAt);
      setRestored(true);
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  function saveDraft() {
    if (!formRef.current) return;
    const values: Record<string, string | boolean> = {};
    for (const field of Array.from(formRef.current.elements)) {
      if (
        !(
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement ||
          field instanceof HTMLSelectElement
        )
      )
        continue;
      if (
        !field.name ||
        (field instanceof HTMLInputElement &&
          ["file", "password", "hidden", "submit"].includes(field.type))
      )
        continue;
      values[field.name] =
        field instanceof HTMLInputElement && field.type === "checkbox"
          ? field.checked
          : field.value;
    }
    const now = Date.now();
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ savedAt: now, values } satisfies StoredDraft),
    );
    setSavedAt(now);
  }

  function clearDraft() {
    sessionStorage.removeItem(storageKey);
    window.location.reload();
  }

  return (
    <form
      ref={formRef}
      action={action}
      onInput={saveDraft}
      onChange={saveDraft}
      className={cn(className)}
    >
      <div className="col-span-full mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-950">
        <span className="flex items-center gap-2">
          <Save className="size-4" />{" "}
          {restored
            ? "Borrador local restaurado."
            : savedAt
              ? "Cambios guardados localmente en esta pestaña."
              : "Este formulario conserva sus datos si ocurre un error."}{" "}
          Los archivos deben seleccionarse nuevamente.
        </span>
        {(restored || savedAt) && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 bg-white"
            onClick={clearDraft}
          >
            <RotateCcw className="size-3.5" /> Descartar borrador
          </Button>
        )}
      </div>
      {children}
    </form>
  );
}
