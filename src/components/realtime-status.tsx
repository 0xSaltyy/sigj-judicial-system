"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

type Status = "online" | "reconnecting" | "offline";

export function RealtimeStatus() {
  const [status, setStatus] = useState<Status>("online");

  useEffect(() => {
    const sync = () => setStatus(navigator.onLine ? "online" : "offline");
    const reconnecting = () => {
      setStatus("reconnecting");
      window.setTimeout(sync, 900);
    };
    sync();
    window.addEventListener("online", reconnecting);
    window.addEventListener("offline", sync);
    window.addEventListener("storage", reconnecting);
    return () => {
      window.removeEventListener("online", reconnecting);
      window.removeEventListener("offline", sync);
      window.removeEventListener("storage", reconnecting);
    };
  }, []);

  const label = status === "online" ? "En línea" : status === "reconnecting" ? "Reconectando" : "Sin conexión";
  const tone = status === "online" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : status === "reconnecting" ? "text-amber-800 bg-amber-50 border-amber-200" : "text-red-800 bg-red-50 border-red-200";
  const Icon = status === "offline" ? WifiOff : Wifi;

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${tone}`} aria-live="polite">
      <span className={`size-2 rounded-full ${status === "online" ? "sync-dot bg-emerald-500" : status === "reconnecting" ? "sync-dot bg-amber-500" : "bg-red-500"}`} />
      <Icon className="size-3.5" />
      {label}
    </div>
  );
}
