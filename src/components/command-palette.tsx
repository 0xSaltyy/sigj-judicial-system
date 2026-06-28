"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CommandPaletteItem = {
  label: string;
  href: string;
  description?: string;
  keywords?: string;
};

export function CommandPalette({ items }: { items: CommandPaletteItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return items.slice(0, 10);
    return items
      .filter((item) =>
        `${item.label} ${item.description ?? ""} ${item.keywords ?? ""}`
          .toLocaleLowerCase("es")
          .includes(normalized),
      )
      .slice(0, 12);
  }, [items, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-md border bg-white/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition hover:bg-white md:flex"
      >
        <Search className="size-3.5" />
        Buscar
        <span className="rounded border bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/35 p-4 backdrop-blur-sm"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className={cn(
              "command-palette-enter mx-auto mt-[10vh] max-w-2xl overflow-hidden rounded-2xl border bg-white shadow-2xl",
            )}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar rutas y acciones…"
                className="h-10 flex-1 bg-transparent text-sm outline-none"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="max-h-[55vh] overflow-auto p-2">
              {filtered.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3 transition hover:bg-slate-50"
                >
                  <span className="font-medium text-[#153553]">{item.label}</span>
                  {item.description && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </Link>
              ))}
              {!filtered.length && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No hay comandos disponibles para esta búsqueda.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
