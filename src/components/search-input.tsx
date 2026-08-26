"use client";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchInput({ placeholder = "Buscar…", value, onChange }: { placeholder?: string; value?: string; onChange?: (value: string) => void }) {
  return <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} className="h-10 pl-9 pr-9" />{value && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-10" onClick={() => onChange?.("")} aria-label="Limpiar búsqueda"><X className="size-4" /></Button>}</div>;
}
