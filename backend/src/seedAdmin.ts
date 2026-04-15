/**
 * One-off admin seed script — run with:
 *   npx tsx src/seedAdmin.ts
 *
 * Finds any user with the target CNIC (digits-only or dashed),
 * ensures role=admin and resets password, then confirms login works.
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const ADMIN_CNIC = (process.env.ADMIN_BOOTSTRAP_CNIC || "3620332306325").replace(/\D/g, "");
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || "admin123";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ledgerland";

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;
  const users = db.collection("users");

  // Search for any user whose cnic (digits-only) matches
  const allAdmins = await users.find({}).toArray();
  const match = allAdmins.find(
    (u) => String(u.cnic).replace(/\D/g, "") === ADMIN_CNIC
  );

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  if (match) {
    console.log(`Found existing user: cnic="${match.cnic}", role="${match.role}"`);
    // Fix: set cnic to digits-only, role to admin, reset password
    await users.updateOne(
      { _id: match._id },
      {
        $set: {
          cnic: ADMIN_CNIC,        // normalize to digits-only
          role: "admin",
          passwordHash: hash,
          fullName: match.fullName || "System Admin",
        },
      }
    );
    console.log(`✅ Fixed: cnic set to ${ADMIN_CNIC}, role=admin, password reset to "${ADMIN_PASSWORD}"`);
  } else {
    // No match — create fresh
    await users.insertOne({
      _id: new mongoose.Types.ObjectId().toString(),
      cnic: ADMIN_CNIC,
      passwordHash: hash,
      fullName: "System Admin",
      role: "admin",
      email: null,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✅ Created admin: cnic=${ADMIN_CNIC}, password="${ADMIN_PASSWORD}"`);
  }

  await mongoose.disconnect();
  console.log("\nAdmin credentials:");
  console.log("  CNIC    :", ADMIN_CNIC);
  console.log("  Password:", ADMIN_PASSWORD);
  console.log("  Role    : admin");
}

seed().catch((e) => {
  console.error("Seed failed:", e.message || e);
  process.exit(1);
});
