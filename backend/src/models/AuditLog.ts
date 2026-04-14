import mongoose, { Schema } from "mongoose";

const auditLogSchema = new Schema(
  {
    action: { type: String, required: true, index: true },
    actorUserId: { type: String, default: null, index: true },
    actorCnic: { type: String, default: null, index: true },
    recordedAt: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { collection: "audit_logs" },
);

auditLogSchema.index({ action: 1, recordedAt: -1 });

/**
 * Append-only application audit events (login, transfers, admin actions, etc.).
 */
export const AuditLogModel = mongoose.model("AuditLog", auditLogSchema);
