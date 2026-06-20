"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CatalogSelect({
  label,
  name,
  options,
  required = true,
}: {
  label: string;
  name: string;
  options: string[];
  required?: boolean;
}) {
  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");
  return (
    <div className="space-y-2">
      <Label htmlFor={`${name}_choice`}>{label} {required && <span className="text-red-600">*</span>}</Label>
      <select
        id={`${name}_choice`}
        name={`${name}_choice`}
        value={choice}
        onChange={(event) => setChoice(event.target.value)}
        onInput={(event) => setChoice(event.currentTarget.value)}
        required={required}
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      >
        <option value="">Seleccione…</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
        <option value="__other">Otro</option>
      </select>
      <input type="hidden" name={name} value={choice === "__other" ? custom : choice} />
      {choice === "__other" && (
        <Input
          name={`${name}_custom`}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="Especifique otro…"
          required
        />
      )}
    </div>
  );
}
