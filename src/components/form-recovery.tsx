"use client";

import { useEffect, useState } from "react";

type FormRecoveryProps = {
  formId: string;
  storageKey: string;
  clearSignal?: string;
};

export function FormRecovery({ formId, storageKey, clearSignal }: FormRecoveryProps) {
  const [status, setStatus] = useState("Restaurando borrador…");

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const key = `doj-form-recovery:${storageKey}`;
    if (clearSignal) localStorage.removeItem(key);

    const restore = () => {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setStatus("Autosave listo");
        return;
      }
      try {
        const values = JSON.parse(raw) as Record<string, string | boolean>;
        for (const [name, value] of Object.entries(values)) {
          const fields = Array.from(form.elements).filter((element) => "name" in element && element.name === name) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
          for (const field of fields) {
            if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = Boolean(value);
            else if (field instanceof HTMLInputElement && field.type === "file") continue;
            else field.value = String(value ?? "");
          }
        }
        setStatus("Borrador restaurado");
      } catch {
        setStatus("Autosave listo");
      }
    };

    const save = () => {
      const values: Record<string, string | boolean> = {};
      const data = new FormData(form);
      for (const [name, value] of data.entries()) {
        if (value instanceof File) continue;
        values[name] = String(value);
      }
      for (const element of Array.from(form.elements)) {
        if (element instanceof HTMLInputElement && element.type === "checkbox" && element.name) values[element.name] = element.checked;
      }
      localStorage.setItem(key, JSON.stringify(values));
      setStatus(navigator.onLine ? "Borrador guardado" : "Sin conexión · borrador local guardado");
    };

    let timer: number | null = null;
    const scheduleSave = () => {
      if (timer) window.clearTimeout(timer);
      setStatus("Guardando borrador…");
      timer = window.setTimeout(save, 450);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      save();
      event.preventDefault();
    };
    const onOnline = () => setStatus("En línea · borrador local disponible");
    const onOffline = () => setStatus("Sin conexión · se conserva borrador local");

    restore();
    form.addEventListener("input", scheduleSave);
    form.addEventListener("change", scheduleSave);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      if (timer) window.clearTimeout(timer);
      form.removeEventListener("input", scheduleSave);
      form.removeEventListener("change", scheduleSave);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [clearSignal, formId, storageKey]);

  return <p className="text-xs text-slate-500" aria-live="polite">{status}</p>;
}
