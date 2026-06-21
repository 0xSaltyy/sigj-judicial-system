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
  "take_control",
  "send",
  "register_session",
  "register_vote",
  "approve",
  "return",
  "create_in_institution",
  "create_in_dependency",
  "assign_dependency",
  "view_all",
  "view_dependency",
  "assign_leader",
  "export",
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
  { resource: "estados", label: "Estados judiciales", actions: ["view", "create", "edit", "publish", "archive", "restore", "hard_delete"], visible: false },
  { resource: "usuarios", label: "Usuarios", actions: ["view", "view_dependency", "view_all", "create", "create_in_dependency", "create_in_institution", "edit", "deactivate", "reactivate", "assign_role", "assign_dependency"] },
  { resource: "roles", label: "Roles y permisos", actions: ["view", "manage"] },
  { resource: "firmas", label: "Firmas", actions: ["view", "request", "sign", "revoke"] },
  { resource: "enlaces", label: "Enlaces compartidos", actions: ["create", "view", "revoke"] },
  { resource: "auditoria", label: "Auditoría", actions: ["view", "export"] },
  { resource: "instituciones", label: "Instituciones", actions: ["view", "manage"] },
  { resource: "dependencias", label: "Dependencias y despachos", actions: ["view", "manage", "assign_leader"] },
  { resource: "configuracion", label: "Configuración", actions: ["view", "manage"] },
  { resource: "edicion", label: "Edición colaborativa", actions: ["take_control"] },
  { resource: "votos", label: "Votos particulares", actions: ["view", "create", "edit", "sign", "publish", "archive", "print"] },
  { resource: "sala", label: "Modo Sala", actions: ["view", "send", "register_session", "register_vote", "approve", "return", "publish"] },
  { resource: "notificaciones", label: "Notificaciones internas", actions: ["view", "manage"] },
] as const satisfies readonly {
  resource: string;
  label: string;
  actions: readonly PermissionAction[];
  visible?: boolean;
}[];

export const MANAGEABLE_PERMISSION_CATALOG = PERMISSION_CATALOG.filter(
  (item) => !("visible" in item) || item.visible !== false,
);

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
  take_control: "Tomar control de edición",
  send: "Enviar a Sala",
  register_session: "Registrar sesión",
  register_vote: "Registrar votación",
  approve: "Aprobar",
  return: "Devolver a ponente",
  create_in_institution: "Crear en su institución",
  create_in_dependency: "Crear en su dependencia",
  assign_dependency: "Asignar dependencia",
  view_all: "Ver todos los usuarios",
  view_dependency: "Ver usuarios de mi dependencia/despacho",
  assign_leader: "Asignar juez, magistrado/a o responsable",
  export: "Exportar",
};

export const USER_PERMISSION_DESCRIPTIONS: Partial<Record<PermissionAction, string>> = {
  view: "Permite abrir el módulo de usuarios, según el alcance permitido.",
  view_dependency: "Permite ver usuarios asignados a la misma dependencia, despacho, juzgado, sala u oficina.",
  view_all: "Permite ver usuarios de todas las instituciones y dependencias autorizadas.",
  create: "Permite crear usuarios; el destino depende del alcance institucional o de dependencia.",
  create_in_dependency: "Permite crear personal únicamente en la dependencia o despacho asignado al usuario.",
  create_in_institution: "Permite crear usuarios dentro de la misma institución o corporación.",
  assign_dependency: "Permite asignar o cambiar el despacho dentro del alcance autorizado.",
  assign_role: "Permite asignar roles autorizados; nunca permite crear OWNER ni evadir cuentas protegidas.",
  edit: "Permite modificar usuarios que estén dentro del alcance autorizado.",
  deactivate: "Permite desactivar usuarios dentro del alcance, salvo cuentas protegidas.",
  reactivate: "Permite reactivar usuarios dentro del alcance autorizado.",
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
  ADMIN_INSTITUCIONAL: [...judicialView, "expedientes:edit", "expedientes:repartition", "expedientes:assign_ponente", "documentos:upload", "enlaces:create", "usuarios:view", "usuarios:view_dependency", "usuarios:create", "usuarios:create_in_institution", "usuarios:create_in_dependency", "usuarios:edit", "usuarios:deactivate", "usuarios:reactivate", "usuarios:assign_role", "usuarios:assign_dependency", "instituciones:view", "dependencias:view"],
  MAGISTRADO_CORTE_SUPREMA: [...judicialView, ...adjudicatorWrite, "edicion:take_control", "votos:view", "votos:create", "votos:edit", "votos:sign", "votos:publish", "votos:archive", "votos:print", "sala:view", "sala:send", "sala:register_session", "sala:register_vote", "sala:approve", "sala:return", "sala:publish", "notificaciones:view"],
  MAGISTRADO_TRIBUNAL: [...judicialView, ...adjudicatorWrite, "edicion:take_control", "votos:view", "votos:create", "votos:edit", "votos:sign", "votos:publish", "votos:archive", "votos:print", "sala:view", "sala:send", "sala:register_session", "sala:register_vote", "sala:approve", "sala:return", "sala:publish", "notificaciones:view"],
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
