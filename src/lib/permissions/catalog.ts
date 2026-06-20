import type { AppRole } from "@/lib/user-management";

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "archive",
  "restore",
  "hard_delete",
  "publish",
  "sign",
  "share",
  "manage",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_CATALOG = [
  { resource: "expedientes", label: "Expedientes", actions: ["view", "create", "edit", "archive", "restore", "hard_delete", "share"] },
  { resource: "providencias", label: "Providencias", actions: ["view", "create", "edit", "archive", "restore", "hard_delete", "publish", "sign", "share"] },
  { resource: "actuaciones", label: "Actuaciones", actions: ["view", "create", "edit", "archive", "restore", "hard_delete"] },
  { resource: "audiencias", label: "Audiencias", actions: ["view", "create", "edit", "archive", "restore", "hard_delete"] },
  { resource: "actas", label: "Actas", actions: ["view", "create", "edit", "publish", "sign"] },
  { resource: "documentos", label: "Documentos / pruebas", actions: ["view", "create", "edit", "archive", "restore", "hard_delete", "share"] },
  { resource: "comunicados", label: "Comunicados", actions: ["view", "create", "edit", "archive", "restore", "hard_delete", "publish"] },
  { resource: "estados", label: "Estados judiciales", actions: ["view", "create", "edit", "archive", "restore", "hard_delete", "publish"] },
  { resource: "usuarios", label: "Usuarios", actions: ["view", "create", "edit", "manage"] },
  { resource: "roles", label: "Roles y permisos", actions: ["view", "manage"] },
  { resource: "auditoria", label: "Auditoría", actions: ["view"] },
  { resource: "enlaces", label: "Compartir enlaces", actions: ["view", "share", "manage"] },
  { resource: "firmas", label: "Firmas", actions: ["view", "sign", "manage"] },
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
  archive: "Archivar",
  restore: "Restaurar",
  hard_delete: "Eliminar definitivo",
  publish: "Publicar",
  sign: "Firmar",
  share: "Compartir",
  manage: "Administrar",
};

const allPermissionKeys = PERMISSION_CATALOG.flatMap(({ resource, actions }) =>
  actions.map((action) => `${resource}:${action}` as PermissionKey),
);

const judicialView = [
  "expedientes:view", "providencias:view", "actuaciones:view", "audiencias:view",
  "actas:view", "documentos:view", "firmas:view", "enlaces:view",
] as PermissionKey[];
const adjudicatorWrite = [
  "providencias:create", "providencias:edit", "providencias:publish", "providencias:sign", "providencias:share",
  "actuaciones:create", "audiencias:create", "audiencias:edit", "actas:create", "actas:edit", "actas:publish",
  "documentos:create", "documentos:edit", "documentos:share", "enlaces:share", "firmas:sign", "firmas:manage",
] as PermissionKey[];

export const DEFAULT_ROLE_PERMISSION_KEYS: Record<AppRole, readonly PermissionKey[]> = {
  SUPER_ADMIN: allPermissionKeys,
  ADMIN_INSTITUCIONAL: [...judicialView, "expedientes:edit", "documentos:create", "documentos:edit", "enlaces:share"],
  MAGISTRADO_CORTE_SUPREMA: [...judicialView, ...adjudicatorWrite],
  MAGISTRADO_TRIBUNAL: [...judicialView, ...adjudicatorWrite],
  JUEZ_CIRCUITO: [...judicialView, ...adjudicatorWrite],
  JUEZ_MUNICIPAL: [...judicialView, ...adjudicatorWrite],
  SECRETARIO_GENERAL: [
    ...judicialView, "expedientes:create", "expedientes:edit", "actuaciones:create", "audiencias:create", "audiencias:edit",
    "actas:create", "actas:edit", "actas:publish", "documentos:create", "documentos:edit", "documentos:share",
    "comunicados:view", "comunicados:create", "comunicados:edit", "comunicados:publish",
    "estados:view", "estados:create", "estados:edit", "estados:publish", "enlaces:share", "firmas:manage",
  ],
  SECRETARIO_DESPACHO: [
    ...judicialView, "expedientes:edit", "providencias:create", "providencias:edit", "actuaciones:create",
    "audiencias:create", "audiencias:edit", "actas:create", "actas:edit", "actas:publish",
    "documentos:create", "documentos:edit", "documentos:share", "estados:view", "estados:create", "estados:edit", "estados:publish",
    "enlaces:share", "firmas:manage",
  ],
  OFICIAL_MAYOR: [...judicialView, "providencias:create", "providencias:edit", "actuaciones:create", "documentos:create", "documentos:edit", "documentos:share"],
  RADICADOR: ["expedientes:view", "expedientes:create", "expedientes:edit", "documentos:view", "documentos:create", "documentos:edit"],
  REPARTO: ["expedientes:view", "expedientes:edit", "documentos:view"],
  ARCHIVO: ["expedientes:view", "expedientes:archive", "documentos:view", "documentos:archive", "actuaciones:view", "audiencias:view", "providencias:view"],
  GOBERNACION_COMUNICACIONES: ["comunicados:view", "comunicados:create", "comunicados:edit", "comunicados:publish"],
  CONSULTA_PUBLICA: [],
};

export const SENSITIVE_PERMISSION_KEYS = new Set<PermissionKey>([
  "expedientes:hard_delete",
  "providencias:hard_delete",
  "actuaciones:hard_delete",
  "audiencias:hard_delete",
  "documentos:hard_delete",
  "comunicados:hard_delete",
  "estados:hard_delete",
  "usuarios:manage",
  "roles:manage",
  "configuracion:manage",
]);

export function permissionKey(resource: PermissionResource, action: PermissionAction) {
  return `${resource}:${action}` as PermissionKey;
}

export function defaultRoleCan(role: AppRole, resource: PermissionResource, action: PermissionAction) {
  return DEFAULT_ROLE_PERMISSION_KEYS[role].includes(permissionKey(resource, action));
}
