"use client";

import { useActionState, useState } from "react";
import { CheckCheck, RotateCcw, XCircle } from "lucide-react";
import { updateUserPermissionOverrides } from "@/app/actions/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ACTION_LABELS, defaultRoleCan, MANAGEABLE_PERMISSION_CATALOG, permissionKey } from "@/lib/permissions/catalog";
import type { AppRole } from "@/lib/user-management";

type Override = { resource: string; action: string; effect: "allow" | "deny"; reason: string | null };
type Rule = { role: AppRole; resource: string; action: string; allowed: boolean };
type Selection = "default" | "allow" | "deny";

const permissionKeys = MANAGEABLE_PERMISSION_CATALOG.flatMap(({ resource, actions }) =>
  actions.map((action) => permissionKey(resource, action)),
);

export function UserPermissionsEditor({ userId, role, overrides, roleRules }: { userId: string; role: AppRole; overrides: Override[]; roleRules: Rule[] }) {
  const [state, formAction, pending] = useActionState(updateUserPermissionOverrides, {});
  const overrideMap = new Map(overrides.map((item) => [`${item.resource}:${item.action}`, item.effect]));
  const roleRuleMap = new Map(roleRules.filter((item) => item.role === role).map((item) => [`${item.resource}:${item.action}`, item.allowed]));
  const [selections, setSelections] = useState<Record<string, Selection>>(() =>
    Object.fromEntries(permissionKeys.map((key) => [key, overrideMap.get(key) ?? "default"])),
  );

  function applyToAll(value: Selection) {
    if (value === "allow" && !window.confirm("¿Permitir todas las acciones visibles para este usuario? Los cambios se aplicarán al guardar.")) return;
    if (value === "deny" && !window.confirm("¿Negar todas las acciones visibles para este usuario? Los cambios se aplicarán al guardar.")) return;
    setSelections(Object.fromEntries(permissionKeys.map((key) => [key, value])));
  }

  return <form action={formAction} className="space-y-5">
    <input type="hidden" name="target_id" value={userId} />
    {state.error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}. Las selecciones permanecen sin aplicar para que pueda corregirlas.</p>}
    <Card>
      <CardHeader><CardTitle className="text-base">Aplicar a toda la matriz</CardTitle></CardHeader>
      <CardContent><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => applyToAll("allow")}><CheckCheck className="size-4" /> Permitir todo</Button><Button type="button" variant="outline" onClick={() => applyToAll("deny")}><XCircle className="size-4" /> Negar todo</Button><Button type="button" variant="outline" onClick={() => applyToAll("default")}><RotateCcw className="size-4" /> Usar rol para todo</Button></div><p className="mt-3 text-xs text-muted-foreground">Estos botones preparan la matriz; los cambios solo se aplican después de confirmar y guardar.</p></CardContent>
    </Card>
    <div className="grid gap-4 xl:grid-cols-2">{MANAGEABLE_PERMISSION_CATALOG.map(({ resource, label, actions }) => <Card key={resource}><CardHeader className="pb-3"><CardTitle className="text-sm text-[#153553]">{label}</CardTitle></CardHeader><CardContent className="space-y-2">{actions.map((action) => {
      const key = permissionKey(resource, action);
      const roleAllowed = roleRuleMap.get(key) ?? defaultRoleCan(role, resource, action);
      const selection = selections[key] ?? "default";
      const customLabel = selection === "allow" ? "Personalizado: permitido" : selection === "deny" ? "Personalizado: negado" : "Según rol";
      return <label key={action} className="grid grid-cols-[1fr_190px] items-center gap-3 rounded border bg-slate-50 px-3 py-2 text-sm"><span><span className="font-medium">{ACTION_LABELS[action]}</span><span className="mt-1 block text-[11px] text-muted-foreground">Por rol: {roleAllowed ? "Permitido" : "No permitido"}</span><Badge variant="outline" className={`mt-1 text-[9px] ${selection === "allow" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : selection === "deny" ? "border-red-200 bg-red-50 text-red-800" : ""}`}>{customLabel}</Badge></span><select name={`permission__${resource}__${action}`} value={selection} onChange={(event) => setSelections((current) => ({ ...current, [key]: event.target.value as Selection }))} className="h-9 rounded-md border bg-white px-2 text-xs" aria-label={`${ACTION_LABELS[action]} en ${label}`}><option value="default">Usar rol</option><option value="allow">Permitir</option><option value="deny">Negar</option></select></label>;
    })}</CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="text-base">Confirmación</CardTitle></CardHeader><CardContent className="space-y-4"><Input name="reason" defaultValue={overrides.find((item) => item.reason)?.reason ?? ""} maxLength={500} placeholder="Motivo opcional del ajuste" aria-label="Motivo opcional del ajuste de permisos" /><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" value="true" required className="mt-1" /><span>Confirmo los permisos personalizados. Las denegaciones prevalecen sobre el rol y todos los cambios quedarán auditados.</span></label><Button type="submit" disabled={pending} className="bg-[#153b5c]">{pending ? "Guardando…" : "Guardar permisos personalizados"}</Button></CardContent></Card>
  </form>;
}
