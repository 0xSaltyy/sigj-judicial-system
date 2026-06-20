"use client";

import { useActionState } from "react";
import { updateUserPermissionOverrides } from "@/app/actions/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ACTION_LABELS, defaultRoleCan, PERMISSION_CATALOG, permissionKey } from "@/lib/permissions/catalog";
import type { AppRole } from "@/lib/user-management";

type Override = { resource: string; action: string; effect: "allow" | "deny"; reason: string | null };
type Rule = { role: AppRole; resource: string; action: string; allowed: boolean };

export function UserPermissionsEditor({ userId, role, overrides, roleRules }: { userId: string; role: AppRole; overrides: Override[]; roleRules: Rule[] }) {
  const [state, formAction, pending] = useActionState(updateUserPermissionOverrides, {});
  const overrideMap = new Map(overrides.map((item) => [`${item.resource}:${item.action}`, item.effect]));
  const roleRuleMap = new Map(roleRules.filter((item) => item.role === role).map((item) => [`${item.resource}:${item.action}`, item.allowed]));

  return <form action={formAction} className="space-y-5">
    <input type="hidden" name="target_id" value={userId} />
    {state.error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}. Las selecciones permanecen sin aplicar para que pueda corregirlas.</p>}
    <div className="grid gap-4 xl:grid-cols-2">{PERMISSION_CATALOG.map(({ resource, label, actions }) => <Card key={resource}><CardHeader className="pb-3"><CardTitle className="text-sm text-[#153553]">{label}</CardTitle></CardHeader><CardContent className="space-y-2">{actions.map((action) => {
      const key = permissionKey(resource, action);
      const override = overrideMap.get(key);
      const roleAllowed = roleRuleMap.get(key) ?? defaultRoleCan(role, resource, action);
      const origin = override === "allow" ? "Concesión personalizada" : override === "deny" ? "Denegación personalizada" : `Predeterminado del rol: ${roleAllowed ? "permitido" : "sin acceso"}`;
      return <label key={action} className="grid grid-cols-[1fr_190px] items-center gap-3 rounded border bg-slate-50 px-3 py-2 text-sm"><span>{ACTION_LABELS[action]}<Badge variant="outline" className="ml-2 text-[9px]">{origin}</Badge></span><select name={`permission__${resource}__${action}`} defaultValue={override ?? "default"} className="h-9 rounded-md border bg-white px-2 text-xs"><option value="default">Usar rol</option><option value="allow">Conceder extra</option><option value="deny">Denegar</option></select></label>;
    })}</CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="text-base">Confirmación</CardTitle></CardHeader><CardContent className="space-y-4"><Input name="reason" defaultValue={overrides.find((item) => item.reason)?.reason ?? ""} maxLength={500} placeholder="Motivo opcional del ajuste" aria-label="Motivo opcional del ajuste de permisos" /><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" value="true" required className="mt-1" /><span>Confirmo los permisos personalizados. Las denegaciones prevalecen sobre el rol y todos los cambios quedarán auditados.</span></label><Button type="submit" disabled={pending} className="bg-[#153b5c]">{pending ? "Guardando…" : "Guardar permisos personalizados"}</Button></CardContent></Card>
  </form>;
}
