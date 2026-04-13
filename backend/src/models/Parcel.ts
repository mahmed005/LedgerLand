import mongoose, { Schema } from "mongoose";

const ownershipEntrySchema = new Schema(
  {
    ownerCnic: { type: String, required: true },
    acquiredAt: { type: String, required: true },
    transferId: { type: String, default: null },
    note: { type: String, default: null },
  },
  { _id: false },
);

const parcelSchema = new Schema(
  {
    _id: { type: String, required: true },
    district: { type: String, required: true, index: true, trim: true },
    moza: { type: String, required: true, index: true, trim: true },
    plotNumber: { type: String, required: true, index: true, trim: true },
    khasra: { type: String, default: "", trim: true },
    currentOwnerCnic: { type: String, required: true, index: true },
    disputed: { type: Boolean, default: false },
    ownershipHistory: { type: [ownershipEntrySchema], default: [] },
    /** Relative path under {@link UPLOADS_DIR}, e.g. `<parcelId>/fard.txt`. */
    fardRelativePath: { type: String, default: null },
    registryRelativePath: { type: String, default: null },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
);

parcelSchema.index({ district: 1, moza: 1, plotNumber: 1 });

/**
 * Land parcel master record with ownership history and document pointers.
 */
export const ParcelModel = mongoose.model("Parcel", parcelSchema);
