"use client";

import { useActionState, useMemo, useState } from "react";
import { updateRolePermissions } from "@/app/actions/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACTION_LABELS,
  defaultRoleCan,
  MANAGEABLE_PERMISSION_CATALOG,
  permissionKey,
  SENSITIVE_PERMISSION_KEYS,
} from "@/lib/permissions/catalog";
import { APP_ROLES, ROLE_DESCRIPTIONS, type AppRole } from "@/lib/user-management";

type Rule = { role: AppRole; resource: string; action: string; allowed: boolean };

export function RolePermissionsEditor({ rules }: { rules: Rule[] }) {
  const [role, setRole] = useState<AppRole>("SUPER_ADMIN");
  const [state, formAction, pending] = useActionState(updateRolePermissions, {});
  const ruleMap = useMemo(
    () => new Map(rules.map((rule) => [`${rule.role}:${rule.resource}:${rule.action}`, rule.allowed])),
    [rules],
  );

  return <form action={formAction} className="space-y-5">
    {state.error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}. Sus selecciones permanecen sin aplicar para que pueda corregirlas.</p>}
    <Card>
      <CardHeader><CardTitle className="text-base">Rol que desea configurar</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[minmax(260px,420px)_1fr] md:items-center">
        <select name="role" value={role} onChange={(event) => setRole(event.target.value as AppRole)} aria-label="Rol que desea configurar" className="h-10 rounded-md border bg-white px-3 text-sm">
          {APP_ROLES.map((value) => <option key={value} value={value}>{ROLE_DESCRIPTIONS[value].label} · {value}</option>)}
        </select>
        <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role].scope}</p>
      </CardContent>
    </Card>

    <div className="grid gap-4 xl:grid-cols-2">
      {MANAGEABLE_PERMISSION_CATALOG.map(({ resource, label, actions }) => <Card key={resource}>
        <CardHeader className="pb-3"><CardTitle className="text-sm text-[#153553]">{label}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {actions.map((action) => {
            const key = permissionKey(resource, action);
            const configured = ruleMap.get(`${role}:${resource}:${action}`) ?? defaultRoleCan(role, resource, action);
            const ownerLock = role === "SUPER_ADMIN" && resource === "roles" && action === "manage";
            return <label key={action} className="grid grid-cols-[1fr_180px] items-center gap-3 rounded border bg-slate-50 px-3 py-2 text-sm">
              <span>{ACTION_LABELS[action]}{SENSITIVE_PERMISSION_KEYS.has(key) && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-red-700">Sensible</span>}</span>
              <select
                key={`${role}:${resource}:${action}:${configured}`}
                name={`permission__${resource}__${action}`}
                defaultValue={ownerLock || configured ? "allow" : "deny"}
                disabled={ownerLock}
                className="h-9 rounded-md border bg-white px-2 text-xs"
                aria-label={`${ACTION_LABELS[action]} en ${label}`}
              >
                <option value="deny">Sin acceso</option>
                <option value="allow">Permitido</option>
              </select>
              {ownerLock && <input type="hidden" name={`permission__${resource}__${action}`} value="allow" />}
            </label>;
          })}
        </CardContent>
      </Card>)}
    </div>

    <div className="sticky bottom-4 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-lg">
      <label className="flex items-start gap-3 text-sm text-amber-950"><input type="checkbox" name="confirmed" value="true" required className="mt-1" /><span>Confirmo que revisé los cambios. Las concesiones sensibles y denegaciones se aplicarán a todas las cuentas con este rol y quedarán auditadas.</span></label>
      <Button type="submit" disabled={pending} className="mt-4 bg-[#153b5c]">{pending ? "Guardando…" : "Guardar matriz del rol"}</Button>
    </div>
  </form>;
}
