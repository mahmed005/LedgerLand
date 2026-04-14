import fs from "node:fs";
import path from "node:path";
import { normalizeCnic } from "../utils/cnic.js";

/**
 * Port the HTTP server listens on (defaults to `3000`).
 */
export const PORT = Number(process.env.PORT) || 3000;

/**
 * Secret used to sign and verify JWT access tokens.
 * Override with `JWT_SECRET` in production.
 */
export const JWT_SECRET = process.env.JWT_SECRET ?? "ledgerland-dev-secret-change-me";

/**
 * Access token lifetime in seconds (default 24 hours).
 */
export const JWT_EXPIRES_SEC = Number(process.env.JWT_EXPIRES_SEC) || 86400;

/**
 * MongoDB connection string for citizen accounts.
 */
export const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/ledgerland";

/**
 * JSON-RPC URL for the EVM node (Hardhat: `http://127.0.0.1:8545`).
 */
export const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

/**
 * Well-known Hardhat test account #0 — only safe for local development chains.
 */
const DEFAULT_LOCAL_SIGNER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/**
 * Private key (hex) used to sign `appendRecord` transactions (relayer wallet).
 */
export const LEDGER_SIGNER_PRIVATE_KEY =
  process.env.LEDGER_SIGNER_PRIVATE_KEY?.trim() || DEFAULT_LOCAL_SIGNER_KEY;

/**
 * Reads `deployments/localhost.json` written by `npm run deploy:local` when env is unset.
 */
function readDeployedLandLedgerAddress(): string {
  try {
    const file = path.join(process.cwd(), "deployments", "localhost.json");
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as { address?: string };
    if (typeof parsed.address === "string" && parsed.address.startsWith("0x")) {
      return parsed.address;
    }
  } catch {
    /* file missing or invalid */
  }
  return "";
}

/**
 * Deployed `LandLedger` contract address (`LEDGER_CONTRACT_ADDRESS` or `deployments/localhost.json`).
 */
export const LEDGER_CONTRACT_ADDRESS =
  process.env.LEDGER_CONTRACT_ADDRESS?.trim() || readDeployedLandLedgerAddress();

/**
 * Absolute directory for parcel document files (Fard / registry text files).
 */
export const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), "uploads"),
);

/**
 * Optional bootstrap: creates an admin user on startup when set (local dev / demos only).
 * Format: 13-digit CNIC without dashes, plus password in env `ADMIN_BOOTSTRAP_PASSWORD`.
 */
export const ADMIN_BOOTSTRAP_CNIC = process.env.ADMIN_BOOTSTRAP_CNIC?.trim()
  ? normalizeCnic(process.env.ADMIN_BOOTSTRAP_CNIC.trim())
  : "";

/**
 * Password paired with {@link ADMIN_BOOTSTRAP_CNIC} for first-run admin creation.
 */
export const ADMIN_BOOTSTRAP_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";

/**
 * Optional bootstrap: creates a **judge** user for **`/api/court/*`** read APIs when set.
 */
export const JUDGE_BOOTSTRAP_CNIC = process.env.JUDGE_BOOTSTRAP_CNIC?.trim()
  ? normalizeCnic(process.env.JUDGE_BOOTSTRAP_CNIC.trim())
  : "";

/**
 * Password paired with {@link JUDGE_BOOTSTRAP_CNIC}.
 */
export const JUDGE_BOOTSTRAP_PASSWORD = process.env.JUDGE_BOOTSTRAP_PASSWORD ?? "";
