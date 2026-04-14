import mongoose, { Schema } from "mongoose";

const transferSchema = new Schema(
  {
    _id: { type: String, required: true },
    parcelId: { type: String, required: true, index: true },
    sellerCnic: { type: String, required: true },
    buyerCnic: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending_nadra", "completed", "cancelled", "nadra_failed"],
      default: "pending_nadra",
    },
    /** ISO timestamp set when the buyer explicitly approves the pending transfer. */
    buyerApprovedAt: { type: String, default: null },
    sellerNadraVerified: { type: Boolean, default: false },
    buyerNadraVerified: { type: Boolean, default: false },
    createdAt: { type: String, required: true },
    completedAt: { type: String, default: null },
    transactionHash: { type: String, default: null },
  },
);

/**
 * Land transfer ticket (NADRA simulation + on-chain anchoring in the MVP).
 */
export const TransferModel = mongoose.model("Transfer", transferSchema);
