import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IOwnershipEntry {
  ownerCnic: string;
  acquiredAt: Date;
  transferId: string | null;
  note: string;
}

export interface IParcel extends Document {
  id: string;
  district: string;
  moza: string;
  plotNumber: string;
  khasra: string;
  currentOwnerCnic: string;
  disputed: boolean;
  ownershipHistory: IOwnershipEntry[];
  hasFard: boolean;
  hasRegistry: boolean;
  hasMutation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ownershipEntrySchema = new Schema<IOwnershipEntry>(
  {
    ownerCnic: { type: String, required: true },
    acquiredAt: { type: Date, required: true },
    transferId: { type: String, default: null },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const parcelSchema = new Schema<IParcel>(
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _id: { type: String, default: uuidv4 } as any,
    district: { type: String, required: true },
    moza: { type: String, required: true },
    plotNumber: { type: String, required: true },
    khasra: { type: String, default: "" },
    currentOwnerCnic: { type: String, required: true, match: /^\d{13}$/ },
    disputed: { type: Boolean, default: false },
    ownershipHistory: { type: [ownershipEntrySchema], default: [] },
    hasFard: { type: Boolean, default: false },
    hasRegistry: { type: Boolean, default: false },
    hasMutation: { type: Boolean, default: false },
  },
  {
    timestamps: true,
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

// ── Indexes for search performance (KAN-25) ─────────────
parcelSchema.index({ district: 1, moza: 1, plotNumber: 1 });
parcelSchema.index({ currentOwnerCnic: 1 });

export const Parcel = mongoose.model<IParcel>("Parcel", parcelSchema);
