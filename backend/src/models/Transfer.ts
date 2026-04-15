import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface ITransfer extends Document {
  id: string;
  parcelId: string;
  sellerCnic: string;
  buyerCnic: string;
  status: "pending_buyer" | "pending_nadra" | "completed" | "rejected";
  transactionHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const transferSchema = new Schema<ITransfer>(
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _id: { type: String, default: uuidv4 } as any,
    parcelId: { type: String, required: true },
    sellerCnic: { type: String, required: true },
    buyerCnic: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending_buyer", "pending_nadra", "completed", "rejected"],
      default: "pending_buyer",
    },
    transactionHash: { type: String, default: null },
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

export const Transfer = mongoose.model<ITransfer>("Transfer", transferSchema);
