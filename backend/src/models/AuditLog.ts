import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export type AuditAction =
  | "LOGIN"
  | "SIGNUP"
  | "SEARCH"
  | "PARCEL_VIEW"
  | "PARCEL_CREATE"
  | "PARCEL_UPDATE"
  | "DOCUMENT_DOWNLOAD"
  | "DOCUMENT_UPLOAD"
  | "TRANSFER_INITIATE"
  | "TRANSFER_APPROVE"
  | "TRANSFER_COMPLETE"
  | "TRANSFER_REJECT"
  | "JUDGE_CREATE";

export interface IAuditLog extends Document {
  id: string;
  action: AuditAction;
  actorUserId: string | null;
  actorCnic: string | null;
  targetResource: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _id: { type: String, default: uuidv4 } as any,
    action: {
      type: String,
      required: true,
      enum: [
        "LOGIN",
        "SIGNUP",
        "SEARCH",
        "PARCEL_VIEW",
        "PARCEL_CREATE",
        "PARCEL_UPDATE",
        "DOCUMENT_DOWNLOAD",
        "DOCUMENT_UPLOAD",
        "TRANSFER_INITIATE",
        "TRANSFER_APPROVE",
        "TRANSFER_COMPLETE",
        "TRANSFER_REJECT",
        "JUDGE_CREATE",
      ],
    },
    actorUserId: { type: String, default: null },
    actorCnic: { type: String, default: null },
    targetResource: { type: String, required: true },
    targetId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: () => new Date() },
  },
  {
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret["id"] = ret["_id"];
        delete ret["_id"];
        delete ret["__v"];
        return ret;
      },
    },
  }
);

// Index for efficient querying by action type and time range
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ actorUserId: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
