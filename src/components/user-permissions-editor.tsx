"use client";

import { useActionState, useState } from "react";
import { CheckCheck, LoaderCircle, RotateCcw, XCircle } from "lucide-react";
import { updateUserPermissionOverrides } from "@/app/actions/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ACTION_LABELS, defaultRoleCan, MANAGEABLE_PERMISSION_CATALOG, permissionKey, PERMISSION_GROUP_DESCRIPTIONS, USER_PERMISSION_DESCRIPTIONS } from "@/lib/permissions/catalog";
import type { AppRole } from "@/lib/user-management";
import { judicialResponsibilityLabel } from "@/lib/institutional-language";

type Override = { resource: string; action: string; effect: "allow" | "deny"; reason: string | null };
type Rule = { role: AppRole; resource: string; action: string; allowed: boolean };
type Selection = "default" | "allow" | "deny";

const permissionKeys = MANAGEABLE_PERMISSION_CATALOG.flatMap(({ resource, actions }) =>
  actions.map((action) => permissionKey(resource, action)),
);

export function UserPermissionsEditor({ userId, role, overrides, roleRules, scope }: { userId: string; role: AppRole; overrides: Override[]; roleRules: Rule[]; scope: { institution: string; dependency: string; position: string; isLeader: boolean } }) {
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

  const effective=MANAGEABLE_PERMISSION_CATALOG.flatMap(({resource,label,actions})=>actions.map((action)=>{
    const key=permissionKey(resource,action);const selection=selections[key]??"default";const roleAllowed=roleRuleMap.get(key)??defaultRoleCan(role,resource,action);
    return {key,label,action,allowed:selection==="allow"||(selection==="default"&&roleAllowed),source:selection==="default"?"Rol":selection==="allow"?"Personalizado: Permitir":"Personalizado: Negar"};
  }));
  const allowedSummary=effective.filter((item)=>item.allowed).slice(0,8);
  const deniedSummary=effective.filter((item)=>!item.allowed&&["hard_delete","publish","sign","assign_role","manage","assign_leader"].includes(item.action)).slice(0,6);

  return <form action={formAction} className="space-y-5">
    <input type="hidden" name="target_id" value={userId} />
    {state.error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}. Las selecciones permanecen sin aplicar para que pueda corregirlas.</p>}
    <Card className="border-emerald-200"><CardHeader><CardTitle className="text-base">Qué puede hacer este usuario</CardTitle><p className="text-xs text-muted-foreground">Resumen calculado con el rol y las selecciones personalizadas actuales. El alcance institucional continúa aplicándose.</p></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-800">Este usuario puede</p><ul className="space-y-2 text-sm">{allowedSummary.map((item)=><li key={item.key} className="flex gap-2"><CheckCheck className="mt-0.5 size-4 shrink-0 text-emerald-700"/><span className="min-w-0 break-words">{plainPermission(item.label,item.action)} <small className="block text-muted-foreground">Fuente: {item.source}</small></span></li>)}{!allowedSummary.length&&<li className="text-muted-foreground">No hay acciones habilitadas en la selección actual.</li>}</ul></div><div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-800">Este usuario no puede</p><ul className="space-y-2 text-sm">{deniedSummary.map((item)=><li key={item.key} className="flex gap-2"><XCircle className="mt-0.5 size-4 shrink-0 text-red-700"/><span className="min-w-0 break-words">{plainPermission(item.label,item.action)} <small className="block text-muted-foreground">Fuente: {item.source}</small></span></li>)}{!deniedSummary.length&&<li className="text-muted-foreground">No hay restricciones críticas en la selección actual.</li>}</ul></div></CardContent></Card>
    <Card className="border-blue-200 bg-blue-50"><CardHeader><CardTitle className="text-base">Alcance efectivo</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex flex-wrap gap-2"><Badge variant="outline">Institución: {scope.institution}</Badge><Badge variant="outline">Dependencia: {scope.dependency}</Badge><Badge variant="outline">Cargo: {scope.position}</Badge><Badge variant="outline">{scope.isLeader ? judicialResponsibilityLabel(role) : "Sin responsabilidad de despacho asignada"}</Badge></div><p><strong>Mi dependencia</strong> = despacho, juzgado, sala u oficina asignada. <strong>Mi institución</strong> = corporación superior. <strong>Global</strong> = toda la estructura autorizada.</p><p className="text-xs text-muted-foreground">Crear usuarios requiere “Crear usuarios” y el permiso de alcance correspondiente. Los jueces o magistrados asignados al despacho pueden crear personal de su propio despacho si tienen el permiso correspondiente. El responsable de oficina puede crear personal de su oficina bajo la misma regla.</p></CardContent></Card>
    <Card>
      <CardHeader><CardTitle className="text-base">Aplicar a toda la matriz</CardTitle></CardHeader>
      <CardContent><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => applyToAll("allow")}><CheckCheck className="size-4" /> Permitir todo</Button><Button type="button" variant="outline" onClick={() => applyToAll("deny")}><XCircle className="size-4" /> Negar todo</Button><Button type="button" variant="outline" onClick={() => applyToAll("default")}><RotateCcw className="size-4" /> Usar rol para todo</Button></div><p className="mt-3 text-xs text-muted-foreground">Estos botones preparan la matriz; los cambios solo se aplican después de confirmar y guardar.</p></CardContent>
    </Card>
    <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold text-[#153553]">Ver detalles técnicos y editar permisos individuales</summary><p className="mt-2 text-xs text-muted-foreground">Use esta matriz cuando necesite modificar una acción específica. “Usar rol” elimina el override individual.</p><div className="mt-4 grid gap-4 xl:grid-cols-2">{MANAGEABLE_PERMISSION_CATALOG.map(({ resource, label, actions }) => <Card key={resource}><CardHeader className="pb-3"><CardTitle className="text-sm text-[#153553]">{label}</CardTitle><p className="text-xs leading-5 text-muted-foreground">{PERMISSION_GROUP_DESCRIPTIONS[resource]}</p></CardHeader><CardContent className="space-y-2">{actions.map((action) => {
      const key = permissionKey(resource, action);
      const roleAllowed = roleRuleMap.get(key) ?? defaultRoleCan(role, resource, action);
      const selection = selections[key] ?? "default";
      const customLabel = selection === "allow" ? "Personalizado: permitido" : selection === "deny" ? "Personalizado: negado" : "Según rol";
      const actionName = action as string;
      const subgroup = resource === "usuarios" ? ((["view","view_dependency","view_all"] as string[]).includes(actionName) ? "Acceso" : (["create","create_in_dependency","create_in_institution"] as string[]).includes(actionName) ? "Creación" : "Administración") : null;
      const previousAction = actions[(actions as readonly string[]).indexOf(action)-1];
      const previousSubgroup = resource === "usuarios" && previousAction ? ((["view","view_dependency","view_all"] as string[]).includes(previousAction) ? "Acceso" : (["create","create_in_dependency","create_in_institution"] as string[]).includes(previousAction) ? "Creación" : "Administración") : null;
      const finalAllowed=selection==="allow"||(selection==="default"&&roleAllowed);
      return <div key={action}>{subgroup && subgroup !== previousSubgroup && <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-[#153553] first:mt-0">{subgroup}</p>}<label className="grid min-w-0 grid-cols-1 items-center gap-3 rounded border bg-slate-50 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_150px]"><span className="min-w-0"><span className="font-medium">{ACTION_LABELS[action]}</span>{resource === "usuarios" && USER_PERMISSION_DESCRIPTIONS[action] && <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{USER_PERMISSION_DESCRIPTIONS[action]}</span>}<span className="mt-1 block text-[11px] text-muted-foreground">Por rol: {roleAllowed ? "Permitido" : "No permitido"}</span><span className={`mt-1 block text-[11px] font-semibold ${finalAllowed?"text-emerald-700":"text-red-700"}`}>Efectivo: {finalAllowed?"Permitido":"No permitido"}</span><Badge variant="outline" className={`mt-1 text-[9px] ${selection === "allow" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : selection === "deny" ? "border-red-200 bg-red-50 text-red-800" : ""}`}>{customLabel}</Badge></span><select name={`permission__${resource}__${action}`} value={selection} onChange={(event) => setSelections((current) => ({ ...current, [key]: event.target.value as Selection }))} className="h-9 w-full min-w-0 rounded-md border bg-white px-2 text-xs" aria-label={`${ACTION_LABELS[action]} en ${label}`}><option value="default">Usar rol</option><option value="allow">Permitir</option><option value="deny">Negar</option></select></label></div>;
    })}</CardContent></Card>)}</div></details>
    <Card><CardHeader><CardTitle className="text-base">Confirmación</CardTitle></CardHeader><CardContent className="space-y-4"><Input name="reason" defaultValue={overrides.find((item) => item.reason)?.reason ?? ""} maxLength={500} placeholder="Motivo opcional del ajuste" aria-label="Motivo opcional del ajuste de permisos" /><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" value="true" required className="mt-1" /><span>Confirmo los permisos personalizados. Las denegaciones prevalecen sobre el rol y todos los cambios quedarán auditados.</span></label><Button type="submit" disabled={pending} className="bg-[#153b5c]">{pending&&<LoaderCircle className="size-4 animate-spin"/>}{pending ? "Guardando…" : "Guardar permisos personalizados"}</Button></CardContent></Card>
  </form>;
}

function plainPermission(group:string,action:string){const verbs:Record<string,string>={view:"Ver",create:"Crear",edit:"Editar",upload:"Subir archivos en",preview:"Previsualizar",download:"Descargar",archive:"Archivar",restore:"Restaurar",hard_delete:"Eliminar definitivamente",publish:"Publicar",sign:"Firmar",print:"Imprimir",manage:"Administrar",assign_role:"Asignar roles en",assign_dependency:"Asignar dependencias en",assign_leader:"Asignar responsables en",create_in_dependency:"Crear usuarios en su despacho mediante",create_in_institution:"Crear usuarios en su institución mediante"};return `${verbs[action]??ACTION_LABELS[action as keyof typeof ACTION_LABELS]} ${group.toLocaleLowerCase("es")}`;}
