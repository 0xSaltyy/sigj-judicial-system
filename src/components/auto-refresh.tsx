"use client";

import { useEffect, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 45000, label = "Actualización automática activa" }: { intervalMs?: number; label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    const timer = window.setInterval(() => {
      startTransition(() => router.refresh());
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, router]);
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80" aria-live="polite">
      <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
      {label}
    </div>
  );
}
