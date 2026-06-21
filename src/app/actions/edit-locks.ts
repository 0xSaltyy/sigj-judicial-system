"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireInternalUser } from "@/lib/auth/authorization";
import { dbUuid } from "@/lib/validation";

const lockType = z.enum(["proceeding", "hearing_minute", "case", "case_action", "document"]);
const lockInput = z.object({ recordType: lockType, recordId: dbUuid });

export type EditLockState = {
  acquired: boolean;
  lockedBy?: string;
  lockedAt?: string;
  expiresAt?: string;
  error?: string;
};

export async function acquireEditLock(recordType: string, recordId: string, force = false): Promise<EditLockState> {
  const parsed = lockInput.safeParse({ recordType, recordId });
  if (!parsed.success) return { acquired: false, error: "Registro de edición no válido" };
  const { supabase } = await requireInternalUser();
  const { data, error } = await supabase.rpc("acquire_edit_lock", {
    p_record_type: parsed.data.recordType,
    p_record_id: parsed.data.recordId,
    p_force: force,
  });
  if (error) return { acquired: false, error: error.message };
  const row = data?.[0];
  return row ? {
    acquired: Boolean(row.acquired),
    lockedBy: row.locked_by_name ?? "Otro usuario",
    lockedAt: row.locked_at,
    expiresAt: row.expires_at,
  } : { acquired: false, error: "No fue posible establecer el bloqueo" };
}

export async function heartbeatEditLock(recordType: string, recordId: string) {
  const parsed = lockInput.safeParse({ recordType, recordId });
  if (!parsed.success) return false;
  const { supabase } = await requireInternalUser();
  const { data } = await supabase.rpc("heartbeat_edit_lock", { p_record_type: parsed.data.recordType, p_record_id: parsed.data.recordId });
  return Boolean(data);
}

export async function releaseEditLock(recordType: string, recordId: string, refreshPath?: string) {
  const parsed = lockInput.safeParse({ recordType, recordId });
  if (!parsed.success) return false;
  const { supabase } = await requireInternalUser();
  const { data } = await supabase.rpc("release_edit_lock", { p_record_type: parsed.data.recordType, p_record_id: parsed.data.recordId });
  if (refreshPath?.startsWith("/admin/")) revalidatePath(refreshPath);
  return Boolean(data);
}
