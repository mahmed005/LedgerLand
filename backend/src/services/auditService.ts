import { AuditLogModel } from "../models/AuditLog.js";

export interface AuditRecordInput {
  /** Stable action key, e.g. `auth.login`, `transfer.created`. */
  action: string;
  actorUserId?: string | null;
  actorCnic?: string | null;
  /** Small JSON-safe payload (ids, paths); avoid secrets. */
  metadata?: Record<string, unknown>;
}

/**
 * Persists application-level audit events to MongoDB for compliance and debugging.
 */
export class AuditService {
  /**
   * Writes one audit row with an ISO timestamp.
   *
   * @param input - Action name and optional actor identifiers.
   */
  async record(input: AuditRecordInput): Promise<void> {
    await AuditLogModel.create({
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      actorCnic: input.actorCnic ?? null,
      recordedAt: new Date().toISOString(),
      metadata: input.metadata ?? {},
    });
  }
}
