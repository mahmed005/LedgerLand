import { AuditLog, AuditAction } from "../models/AuditLog.js";

/**
 * Log an auditable action to the AuditLog collection.
 * Fire-and-forget — never throws to the caller.
 */
export async function logAction(
  action: AuditAction,
  actorUserId: string | null,
  actorCnic: string | null,
  targetResource: string,
  targetId: string | null = null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await AuditLog.create({
      action,
      actorUserId,
      actorCnic,
      targetResource,
      targetId,
      metadata,
    });
  } catch (err) {
    // Audit logging must never break the main flow
    console.error("[audit] Failed to write audit log:", err);
  }
}

/**
 * Retrieve audit logs with optional filtering.
 */
export async function getAuditLogs(filters: {
  action?: AuditAction;
  actorUserId?: string;
  limit?: number;
}) {
  const query: Record<string, unknown> = {};
  if (filters.action) query.action = filters.action;
  if (filters.actorUserId) query.actorUserId = filters.actorUserId;

  return AuditLog.find(query)
    .sort({ timestamp: -1 })
    .limit(filters.limit || 100)
    .lean();
}
