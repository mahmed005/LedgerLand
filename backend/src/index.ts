import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import app from "./app.js";
import * as ethLedger from "./services/ethLedgerService.js";
import { bootstrapAdmin, bootstrapJudge } from "./services/authService.js";
import { initNotifications } from "./services/notificationService.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ledgerland";
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

// Default Hardhat account #0 private key (local dev only, never use in production)
const DEFAULT_HARDHAT_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SIGNER_KEY = process.env.LEDGER_SIGNER_PRIVATE_KEY || DEFAULT_HARDHAT_KEY;

async function main() {
  // ── MongoDB ──────────────────────────────────────────
  console.log(`[mongo] Connecting to ${MONGODB_URI} …`);
  await mongoose.connect(MONGODB_URI);
  console.log("[mongo] Connected.");

  // ── Blockchain ───────────────────────────────────────
  const contractAddress = ethLedger.loadContractAddress();
  if (contractAddress) {
    ethLedger.init(RPC_URL, contractAddress, SIGNER_KEY);
    console.log(`[chain] LandLedger at ${contractAddress} (RPC: ${RPC_URL})`);
  } else {
    console.warn(
      "[chain] No contract address found. Blockchain routes will fail until you deploy. " +
        "Run: npm run node:chain   then   npm run deploy:local"
    );
  }

  // ── Notifications (KAN-22) ──────────────────────────
  await initNotifications();

  // ── Bootstrap admin ──────────────────────────────────
  const adminCnic = process.env.ADMIN_BOOTSTRAP_CNIC;
  const adminPwd = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (adminCnic && adminPwd) {
    await bootstrapAdmin(adminCnic, adminPwd);
  }

  // ── Bootstrap judge (KAN-16) ────────────────────────
  const judgeCnic = process.env.JUDGE_BOOTSTRAP_CNIC;
  const judgePwd = process.env.JUDGE_BOOTSTRAP_PASSWORD;
  if (judgeCnic && judgePwd) {
    await bootstrapJudge(judgeCnic, judgePwd);
  }

  // ── Start HTTP ───────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`[http] LedgerLand API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

// Trigger reload
