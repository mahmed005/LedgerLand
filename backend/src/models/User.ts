import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IUser extends Document {
  id: string;
  cnic: string;
  passwordHash: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: "citizen" | "admin" | "judge";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _id: { type: String, default: uuidv4 } as any,
    cnic: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{13}$/,
    },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    role: {
      type: String,
      enum: ["citizen", "admin", "judge"],
      default: "citizen",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret["id"] = ret["_id"];
        delete ret["_id"];
        delete ret["__v"];
        delete ret["passwordHash"];
        return ret;
      },
    },
  }
);

// Partial unique index on email — only enforced when email is not null
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);

export const User = mongoose.model<IUser>("User", userSchema);
