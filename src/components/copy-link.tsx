"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyLink({ value, label = "Copiar enlace" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <Button type="button" variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copiado" : label}</Button>;
}
