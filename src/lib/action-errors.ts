export function safeActionError(error: { message?: string; code?: string } | null | undefined, fallback: string) {
  const message = error?.message || "";
  if (/duplicate key|unique constraint/i.test(message) || error?.code === "23505") return "Ya existe un registro con ese código, identificador o ruta.";
  if (/foreign key|violates.*constraint/i.test(message) || error?.code === "23503") return "La operación está vinculada a otros registros y no puede completarse así.";
  if (/row-level security|permission denied|not authorized/i.test(message)) return "No tiene permiso para realizar esta acción dentro de su alcance.";
  if (/fuera de su institución|otra institución|alcance institucional|No puede editar|no está disponible|produciría un ciclo|No tiene permiso|Solo puede administrar/i.test(message)) return message;
  return fallback;
}
