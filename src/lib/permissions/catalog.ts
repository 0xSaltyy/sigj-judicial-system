import type { AppRole } from "@/lib/user-management";

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "upload",
  "preview",
  "download",
  "archive",
  "restore",
  "hard_delete",
  "publish",
  "finalize",
  "reopen",
  "sign",
  "print",
  "share",
  "repartition",
  "assign_ponente",
  "reschedule",
  "cancel",
  "deactivate",
  "reactivate",
  "assign_role",
  "request",
  "revoke",
  "manage",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_CATALOG = [
  { resource: "expedientes", label: "Expedientes", actions: ["view", "create", "edit", "archive", "restore", "hard_delete", "share", "repartition", "assign_ponente"] },
  { resource: "providencias", label: "Providencias", actions: ["view", "create", "edit", "publish", "archive", "restore", "hard_delete", "sign", "share", "print"] },
  { resource: "actuaciones", label: "Actuaciones", actions: ["view", "create", "edit", "archive", "restore", "hard_delete"] },
  { resource: "audiencias", label: "Audiencias", actions: ["view", "create", "edit", "reschedule", "cancel", "archive", "restore", "hard_delete"] },
  { resource: "actas", label: "Actas", actions: ["view", "create", "edit", "finalize", "reopen", "sign", "print", "archive"] },
  { resource: "documentos", label: "Documentos / pruebas", actions: ["view", "upload", "preview", "download", "archive", "restore", "hard_delete", "share"] },
  { resource: "comunicados", label: "Comunicados", actions: ["view", "create", "edit", "publish", "archive", "restore", "hard_delete"] },
  { resource: "estados", label: "Estados judiciales", actions: ["view", "create", "edit", "publish", "archive", "restore", "hard_delete"] },
  { resource: "usuarios", label: "Usuarios", actions: ["view", "create", "edit", "deactivate", "reactivate", "assign_role"] },
  { resource: "roles", label: "Roles y permisos", actions: ["view", "manage"] },
  { resource: "firmas", label: "Firmas", actions: ["view", "request", "sign", "revoke"] },
  { resource: "enlaces", label: "Enlaces compartidos", actions: ["create", "view", "revoke"] },
  { resource: "auditoria", label: "Auditoría", actions: ["view"] },
  { resource: "configuracion", label: "Configuración", actions: ["view", "manage"] },
] as const satisfies readonly {
  resource: string;
  label: string;
  actions: readonly PermissionAction[];
}[];

export type PermissionResource = (typeof PERMISSION_CATALOG)[number]["resource"];
export type PermissionKey = `${PermissionResource}:${PermissionAction}`;

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  upload: "Subir archivos",
  preview: "Previsualizar",
  download: "Descargar",
  archive: "Archivar",
  restore: "Restaurar",
  hard_delete: "Eliminar definitivo",
  publish: "Publicar",
  finalize: "Finalizar",
  reopen: "Reabrir",
  sign: "Firmar",
  print: "Imprimir / exportar",
  share: "Compartir",
  repartition: "Cambiar dependencia / reparto",
  assign_ponente: "Asignar ponente",
  reschedule: "Reprogramar",
  cancel: "Cancelar",
  deactivate: "Desactivar",
  reactivate: "Reactivar",
  assign_role: "Asignar rol",
  request: "Solicitar",
  revoke: "Revocar",
  manage: "Administrar",
};

const allPermissionKeys = PERMISSION_CATALOG.flatMap(({ resource, actions }) =>
  actions.map((action) => `${resource}:${action}` as PermissionKey),
);

const judicialView = [
  "expedientes:view", "providencias:view", "actuaciones:view", "audiencias:view",
  "actas:view", "documentos:view", "documentos:preview", "documentos:download",
  "firmas:view", "enlaces:view",
] as PermissionKey[];
const adjudicatorWrite = [
  "providencias:create", "providencias:edit", "providencias:publish", "providencias:sign", "providencias:share", "providencias:print",
  "actuaciones:create", "audiencias:create", "audiencias:edit", "audiencias:reschedule", "audiencias:cancel",
  "actas:create", "actas:edit", "actas:finalize", "actas:reopen", "actas:sign", "actas:print",
  "documentos:upload", "documentos:share", "enlaces:create", "firmas:sign", "firmas:request", "firmas:revoke",
] as PermissionKey[];

export const DEFAULT_ROLE_PERMISSION_KEYS: Record<AppRole, readonly PermissionKey[]> = {
  SUPER_ADMIN: allPermissionKeys,
  ADMIN_INSTITUCIONAL: [...judicialView, "expedientes:edit", "expedientes:repartition", "expedientes:assign_ponente", "documentos:upload", "enlaces:create"],
  MAGISTRADO_CORTE_SUPREMA: [...judicialView, ...adjudicatorWrite],
  MAGISTRADO_TRIBUNAL: [...judicialView, ...adjudicatorWrite],
  JUEZ_CIRCUITO: [...judicialView, ...adjudicatorWrite],
  JUEZ_MUNICIPAL: [...judicialView, ...adjudicatorWrite],
  SECRETARIO_GENERAL: [
    ...judicialView, "expedientes:create", "expedientes:edit", "expedientes:repartition", "expedientes:assign_ponente",
    "actuaciones:create", "audiencias:create", "audiencias:edit", "audiencias:reschedule", "audiencias:cancel",
    "actas:create", "actas:edit", "actas:finalize", "actas:reopen", "actas:sign", "actas:print",
    "documentos:upload", "documentos:share", "comunicados:view", "comunicados:create", "comunicados:edit", "comunicados:publish",
    "estados:view", "estados:create", "estados:edit", "estados:publish", "enlaces:create", "firmas:sign", "firmas:request", "firmas:revoke",
  ],
  SECRETARIO_DESPACHO: [
    ...judicialView, "expedientes:edit", "providencias:create", "providencias:edit", "providencias:print", "actuaciones:create",
    "audiencias:create", "audiencias:edit", "audiencias:reschedule", "audiencias:cancel",
    "actas:create", "actas:edit", "actas:finalize", "actas:reopen", "actas:sign", "actas:print",
    "documentos:upload", "documentos:share", "estados:view", "estados:create", "estados:edit", "estados:publish",
    "enlaces:create", "firmas:sign", "firmas:request", "firmas:revoke",
  ],
  OFICIAL_MAYOR: [...judicialView, "providencias:create", "providencias:edit", "providencias:print", "actuaciones:create", "documentos:upload", "documentos:share"],
  RADICADOR: ["expedientes:view", "expedientes:create", "expedientes:edit", "documentos:view", "documentos:upload", "documentos:preview", "documentos:download"],
  REPARTO: ["expedientes:view", "expedientes:edit", "expedientes:repartition", "expedientes:assign_ponente", "documentos:view", "documentos:preview", "documentos:download"],
  ARCHIVO: ["expedientes:view", "expedientes:archive", "documentos:view", "documentos:preview", "documentos:download", "documentos:archive", "actuaciones:view", "audiencias:view", "providencias:view", "providencias:print"],
  GOBERNACION_COMUNICACIONES: ["comunicados:view", "comunicados:create", "comunicados:edit", "comunicados:publish"],
  CONSULTA_PUBLICA: [],
};

export const SENSITIVE_PERMISSION_KEYS = new Set<PermissionKey>([
  "expedientes:hard_delete",
  "expedientes:repartition",
  "expedientes:assign_ponente",
  "providencias:hard_delete",
  "actuaciones:hard_delete",
  "audiencias:hard_delete",
  "documentos:hard_delete",
  "comunicados:hard_delete",
  "estados:hard_delete",
  "usuarios:deactivate",
  "usuarios:assign_role",
  "roles:manage",
  "configuracion:manage",
]);

export function permissionKey(resource: PermissionResource, action: PermissionAction) {
  return `${resource}:${action}` as PermissionKey;
}

export function defaultRoleCan(role: AppRole, resource: PermissionResource, action: PermissionAction) {
  return DEFAULT_ROLE_PERMISSION_KEYS[role]?.includes(
    permissionKey(resource, action),
  ) ?? false;
}
