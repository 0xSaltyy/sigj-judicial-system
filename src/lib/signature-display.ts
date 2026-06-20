const protectedAccountLabels = new Set([
  "propietario del sistema",
  "administracion palacio judicial",
  "administración palacio judicial",
  "owner",
  "super admin",
  "super_admin",
  "administrador del sistema",
  "administradora del sistema",
]);

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

export function isProtectedAccountLabel(value?: string | null) {
  return value ? protectedAccountLabels.has(normalize(value)) : false;
}

export function formalSignerName(value?: string | null) {
  if (!value || isProtectedAccountLabel(value) || value.includes("@")) return "";
  return value.trim();
}

export function formalSignerTitle(value?: string | null) {
  if (!value || isProtectedAccountLabel(value)) return "";
  return value.trim();
}

