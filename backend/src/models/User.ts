import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    _id: { type: String, required: true },
    cnic: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: false, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    role: { type: String, enum: ["citizen", "admin"], default: "citizen" },
    createdAt: { type: String, required: true },
  },
);

/**
 * Unique email only when the field is present (multiple users may omit email).
 */
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true, $type: "string" } },
  },
);

/**
 * Mongoose model for citizen and admin accounts.
 */
export const UserModel = mongoose.model("User", userSchema);
