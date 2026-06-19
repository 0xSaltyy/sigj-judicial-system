"use client";

import { useState } from "react";
import { Check, Copy, Link2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DocumentShareButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function createLink() {
    setLoading(true); setError("");
    const response = await fetch(`/api/admin/documents/${documentId}/share`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 900 }) });
    const result = await response.json() as { url?: string; error?: string };
    setLoading(false);
    if (!response.ok || !result.url) { setError(result.error ?? "No fue posible generar el enlace"); return; }
    setUrl(result.url);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <div className="flex flex-wrap items-center gap-2">{url ? <Button type="button" size="sm" variant="outline" onClick={copyLink}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copiado" : "Copiar enlace (15 min)"}</Button> : <Button type="button" size="sm" variant="outline" onClick={createLink} disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Link2 className="size-4" />} Compartir 15 min</Button>}{error && <span role="alert" className="text-xs text-red-700">{error}</span>}</div>;
}
