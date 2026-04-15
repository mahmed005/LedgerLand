import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User.js";
import { normalizeCnic, isValidCnic } from "../utils/cnic.js";

const JWT_SECRET = process.env.JWT_SECRET || "ledgerland-dev-secret";
const JWT_EXPIRES_SEC = parseInt(process.env.JWT_EXPIRES_SEC || "86400", 10);

/** Public user shape (never expose passwordHash). */
export function toPublicUser(user: IUser) {
  return {
    id: user._id,
    cnic: user.cnic,
    email: user.email ?? null,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/**
 * Register a new user.
 * @throws {Object} `{ status, error }` on validation or duplicate CNIC.
 */
export async function signup(
  cnic: string,
  password: string,
  fullName: string,
  email?: string
) {
  if (!cnic) {
    throw { status: 400, error: "CNIC must be 13 digits." };
  }
  const normalized = normalizeCnic(cnic);
  if (!isValidCnic(normalized)) {
    throw { status: 400, error: "CNIC must be 13 digits." };
  }
  if (!password || password.length < 6) {
    throw { status: 400, error: "Password must be at least 6 characters." };
  }
  if (!fullName || !fullName.trim()) {
    throw { status: 400, error: "Full name is required." };
  }

  const existingByCnic = await User.findOne({ cnic: normalized }).lean();
  if (existingByCnic) {
    throw { status: 409, error: "CNIC is already registered." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    cnic: normalized,
    passwordHash,
    fullName: fullName.trim(),
    email: email?.trim() || null,
  });

  return toPublicUser(user);
}

/**
 * Authenticate and return a JWT + public user.
 * @throws {Object} `{ status, error }` on bad credentials.
 */
export async function login(cnic: string, password: string) {
  if (!cnic) {
    throw { status: 400, error: "CNIC must be 13 digits." };
  }
  const normalized = normalizeCnic(cnic);
  if (!isValidCnic(normalized)) {
    throw { status: 400, error: "CNIC must be 13 digits." };
  }

  const user = await User.findOne({ cnic: normalized });
  if (!user) {
    throw { status: 401, error: "Invalid CNIC or password." };
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw { status: 401, error: "Invalid CNIC or password." };
  }

  // Include role in JWT payload so middleware can check without DB lookup
  const token = jwt.sign(
    { userId: user._id, cnic: user.cnic, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_SEC }
  );

  return { token, user: toPublicUser(user) };
}

/**
 * Verify a JWT and return its decoded payload.
 */
export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string; cnic: string; role?: string };
}

/**
 * Create an admin user if the CNIC doesn't already exist.
 * Used for bootstrap on startup.
 */
export async function bootstrapAdmin(cnic: string, password: string) {
  const normalized = normalizeCnic(cnic);
  if (!isValidCnic(cnic)) return;

  const existing = await User.findOne({ cnic: normalized });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    cnic: normalized,
    passwordHash,
    fullName: "System Admin",
    role: "admin",
  });
  console.log(`[bootstrap] Admin created for CNIC ${normalized}`);
}

/**
 * Create a judge account. Admin-only action (KAN-16).
 * @throws {Object} `{ status, error }` on validation or duplicate.
 */
export async function createJudge(
  cnic: string,
  password: string,
  fullName: string,
  email?: string
) {
  if (!cnic) {
    throw { status: 400, error: "CNIC must be 13 digits." };
  }
  const normalized = normalizeCnic(cnic);
  if (!isValidCnic(normalized)) {
    throw { status: 400, error: "CNIC must be 13 digits." };
  }
  if (!password || password.length < 6) {
    throw { status: 400, error: "Password must be at least 6 characters." };
  }
  if (!fullName || !fullName.trim()) {
    throw { status: 400, error: "Full name is required." };
  }

  const existingByCnic = await User.findOne({ cnic: normalized }).lean();
  if (existingByCnic) {
    throw { status: 409, error: "CNIC is already registered." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    cnic: normalized,
    passwordHash,
    fullName: fullName.trim(),
    email: email?.trim() || null,
    role: "judge",
  });

  return toPublicUser(user);
}

/**
 * Create a judge user if the CNIC doesn't already exist.
 * Used for bootstrap on startup (KAN-16).
 */
export async function bootstrapJudge(cnic: string, password: string) {
  const normalized = normalizeCnic(cnic);
  if (!isValidCnic(normalized)) return;

  const existing = await User.findOne({ cnic: normalized });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    cnic: normalized,
    passwordHash,
    fullName: "System Judge",
    role: "judge",
  });
  console.log(`[bootstrap] Judge created for CNIC ${normalized}`);
}
