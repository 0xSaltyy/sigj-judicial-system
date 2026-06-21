import Link from "next/link";
import { Bell, CheckCheck, Send } from "lucide-react";
import {
  createAssignedNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import { ActionMessage } from "@/components/action-message";
import { AdminPageHeader } from "@/components/admin-page";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ supabase, user, profile }, query] = await Promise.all([
    requirePermission(PERMISSIONS.notificationsView),
    searchParams,
  ]);
  const [{ data, error }, canManage] = await Promise.all([
    supabase
      .from("internal_notifications")
      .select("id,title,message,type,link_url,read_at,priority,created_at")
      .eq("recipient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    can(profile, "manage", "notificaciones", { supabase }),
  ]);
  const admin = canManage ? createAdminClient() : null;
  const { data: recipientRows } = admin
    ? await admin
        .from("profiles")
      .select("id,full_name,position_title,institution_id,dependency_id,is_owner")
        .eq("is_active", true)
        .neq("role", "CONSULTA_PUBLICA")
        .order("full_name")
    : { data: [] };
  const recipients = (recipientRows ?? []).filter(
    (item) =>
      profile.is_owner ||
      (profile.role === "ADMIN_INSTITUCIONAL" && Boolean(profile.institution_id && item.institution_id === profile.institution_id)) ||
      item.dependency_id === profile.dependency_id,
  );
  return (
    <>
      <RealtimeRefresh
        channel={`notifications-${user.id}`}
        subscriptions={[
          {
            table: "internal_notifications",
            filter: `recipient_user_id=eq.${user.id}`,
            message: "Tiene una nueva notificación interna.",
          },
        ]}
      />
      <AdminPageHeader
        title="Notificaciones internas"
        description="Avisos asignables, seguros y vinculados a registros autorizados."
        action={
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="outline">
              <CheckCheck className="size-4" /> Marcar todas como leídas
            </Button>
          </form>
        }
      />
      <ActionMessage
        error={
          query.error ??
          (error ? "No fue posible consultar las notificaciones" : undefined)
        }
        success={query.success}
      />
      {canManage ? (
        <details className="mb-5 rounded-xl border bg-white p-5">
          <summary className="cursor-pointer font-semibold text-[#153553]">
            <Send className="mr-2 inline size-4" /> Notificar / asignar
            destinatario
          </summary>
          <form
            action={createAssignedNotification}
            className="mt-4 grid gap-3 md:grid-cols-2"
          >
            <label className="grid gap-1 text-sm font-medium">
              Destinatario
              <select
                name="recipient_user_id"
                required
                className="h-9 min-w-0 rounded-md border px-3 text-sm font-normal"
              >
                <option value="">Seleccione un usuario…</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.is_owner ? "Lilith D'Amico" : r.full_name}
                    {r.position_title ? ` · ${r.position_title}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Prioridad
              <select
                name="priority"
                defaultValue="normal"
                className="h-9 min-w-0 rounded-md border px-3 text-sm font-normal"
              >
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Título
              <Input name="title" maxLength={120} required placeholder="Asunto del aviso" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Enlace interno (opcional)
              <Input name="link_url" placeholder="/admin/expedientes/…" />
            </label>
            <label className="grid gap-1 text-sm font-medium md:col-span-2">
              Mensaje
              <Textarea
                name="message"
                maxLength={500}
                required
                placeholder="Mensaje sin contenido reservado"
              />
            </label>
            <p className="text-xs text-muted-foreground md:col-span-2">
              El enlace se vuelve a autorizar al abrirse; la notificación no
              concede acceso al registro.
            </p>
            <div className="md:col-span-2">
              <SubmitButton pendingLabel="Asignando…">Notificar</SubmitButton>
            </div>
          </form>
        </details>
      ) : (
        <p className="mb-5 rounded border bg-white p-4 text-sm text-muted-foreground">
          Puede recibir y abrir notificaciones. No tiene permiso para asignar
          destinatarios.
        </p>
      )}
      <div className="space-y-3">
        {(data ?? []).map((item) => (
          <article
            key={item.id}
            className={`rounded-xl border p-5 ${item.read_at ? "bg-white" : "border-amber-300 bg-amber-50"}`}
          >
            <div className="flex items-start gap-3">
              <Bell className="mt-1 size-5 text-[#9a752f]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="font-semibold text-[#153553]">{item.title}</h2>
                  <time className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.created_at))}
                  </time>
                </div>
                <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {item.type} · prioridad {item.priority}
                </p>
                <div className="mt-3 flex gap-2">
                  {item.link_url && (
                    <Button asChild size="sm">
                      <Link href={item.link_url}>Abrir registro</Link>
                    </Button>
                  )}
                  {!item.read_at && (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Marcar como leída
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
        {!data?.length && !error && (
          <p className="rounded-xl border bg-white p-10 text-center text-sm text-muted-foreground">
            No tiene notificaciones internas.
          </p>
        )}
      </div>
    </>
  );
}
