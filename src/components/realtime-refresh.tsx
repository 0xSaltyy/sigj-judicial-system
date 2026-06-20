"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

export type RealtimeSubscription = {
  table: string;
  filter?: string;
  message?: string;
  messages?: Partial<Record<RealtimeEvent, string>>;
};

type RealtimeRefreshProps = {
  channel: string;
  subscriptions: readonly RealtimeSubscription[];
  mode?: "auto" | "prompt";
  debounceMs?: number;
  protectUnsavedForms?: boolean;
  promptMessage?: string;
};

type RefreshStatus = "idle" | "available" | "refreshing" | "updated" | "offline";

export function RealtimeRefresh({
  channel,
  subscriptions,
  mode = "auto",
  debounceMs = 500,
  protectUnsavedForms = true,
  promptMessage = "Hay cambios nuevos. Actualizar vista.",
}: RealtimeRefreshProps) {
  const router = useRouter();
  const instanceId = useId().replaceAll(":", "");
  const [supabase] = useState(createClient);
  const [status, setStatus] = useState<RefreshStatus>("idle");
  const [message, setMessage] = useState("Datos actualizados.");
  const [isPending, startTransition] = useTransition();
  const dirtyFormRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const indicatorTimerRef = useRef<number | null>(null);
  const subscriptionsKey = JSON.stringify(subscriptions);

  useEffect(() => {
    if (!protectUnsavedForms) return;
    const markFormAsDirty = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("form")) {
        dirtyFormRef.current = true;
      }
    };
    document.addEventListener("input", markFormAsDirty, true);
    document.addEventListener("change", markFormAsDirty, true);
    return () => {
      document.removeEventListener("input", markFormAsDirty, true);
      document.removeEventListener("change", markFormAsDirty, true);
    };
  }, [protectUnsavedForms]);

  useEffect(() => {
    if (!supabase) return;
    const parsed = JSON.parse(subscriptionsKey) as RealtimeSubscription[];
    const uniqueSubscriptions = Array.from(
      new Map(parsed.map((item) => [`${item.table}:${item.filter ?? ""}`, item])).values(),
    );
    if (!uniqueSubscriptions.length) return;

    let active = true;
    let connectedOnce = false;
    let disconnected = false;

    const clearTimer = (timer: { current: number | null }) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
    const finishRefresh = () => {
      if (!active) return;
      setStatus("updated");
      clearTimer(indicatorTimerRef);
      indicatorTimerRef.current = window.setTimeout(() => {
        if (active) setStatus("idle");
      }, 2400);
    };
    const refresh = () => {
      if (!active) return;
      setStatus("refreshing");
      startTransition(() => router.refresh());
      clearTimer(indicatorTimerRef);
      indicatorTimerRef.current = window.setTimeout(finishRefresh, 700);
    };
    const scheduleRefresh = (nextMessage: string) => {
      if (!active) return;
      setMessage(nextMessage);
      if (mode === "prompt" || (protectUnsavedForms && dirtyFormRef.current)) {
        setStatus("available");
        return;
      }
      clearTimer(debounceTimerRef);
      debounceTimerRef.current = window.setTimeout(refresh, debounceMs);
    };

    let realtimeChannel = supabase.channel(`sigj:${channel}:${instanceId}`);
    for (const subscription of uniqueSubscriptions) {
      realtimeChannel = realtimeChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: subscription.table,
          ...(subscription.filter ? { filter: subscription.filter } : {}),
        },
        (payload) => {
          // The change payload is deliberately never rendered or merged into UI
          // state. It is only a signal to refetch data through the existing
          // authenticated Server Components and their RLS-protected queries.
          const event = payload.eventType as RealtimeEvent;
          scheduleRefresh(
              subscription.messages?.[event] ??
              subscription.message ??
              promptMessage,
          );
        },
      );
    }

    realtimeChannel.subscribe((connectionStatus) => {
      if (!active) return;
      if (connectionStatus === "SUBSCRIBED") {
        if (connectedOnce && disconnected) {
          scheduleRefresh("Conexión restablecida. Datos sincronizados.");
        }
        connectedOnce = true;
        disconnected = false;
        setStatus((current) => (current === "offline" ? "idle" : current));
      } else if (
        connectionStatus === "CHANNEL_ERROR" ||
        connectionStatus === "TIMED_OUT"
      ) {
        disconnected = true;
        setStatus("offline");
      }
    });

    return () => {
      active = false;
      clearTimer(debounceTimerRef);
      clearTimer(indicatorTimerRef);
      void supabase.removeChannel(realtimeChannel);
    };
  }, [channel, debounceMs, instanceId, mode, promptMessage, protectUnsavedForms, router, subscriptionsKey, supabase]);

  const refreshNow = () => {
    setStatus("refreshing");
    startTransition(() => router.refresh());
    if (indicatorTimerRef.current !== null) {
      window.clearTimeout(indicatorTimerRef.current);
    }
    indicatorTimerRef.current = window.setTimeout(() => {
      setStatus("updated");
      indicatorTimerRef.current = window.setTimeout(() => setStatus("idle"), 2400);
    }, 700);
  };

  if (status === "idle") return null;

  return (
    <div
      className={`no-print fixed right-4 top-20 z-50 flex max-w-sm items-center gap-3 rounded-lg border px-4 py-3 text-xs shadow-lg ${
        status === "offline"
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-slate-200 bg-white text-slate-700"
      }`}
      role="status"
      aria-live="polite"
    >
      {status === "offline" ? (
        <WifiOff className="size-4 shrink-0" />
      ) : (
        <RefreshCw className={`size-4 shrink-0 ${status === "refreshing" || isPending ? "animate-spin" : ""}`} />
      )}
      <span>
        {status === "available"
          ? message || promptMessage
          : status === "offline"
            ? "Reconectando las actualizaciones en tiempo real…"
            : status === "refreshing" || isPending
              ? "Actualizando datos…"
              : message}
      </span>
      {status === "available" && (
        <Button type="button" size="sm" variant="outline" onClick={refreshNow} disabled={isPending}>
          Actualizar vista
        </Button>
      )}
    </div>
  );
}
