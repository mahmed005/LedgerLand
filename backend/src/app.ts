import express from "express";
import type { EthLedgerService } from "./ledger/ethLedgerService.js";
import { createAuthMiddleware } from "./auth/authMiddleware.js";
import { createAuthRouter } from "./auth/authRoutes.js";
import type { AuthService } from "./auth/authService.js";
import { createBlockchainRouter } from "./routes/blockchainRoutes.js";
import { createParcelRouter } from "./routes/parcelRoutes.js";
import { createTransferRouter } from "./routes/transferRoutes.js";
import { createAdminRouter } from "./routes/adminRoutes.js";
import type { ParcelService } from "./services/parcelService.js";
import type { TransferService } from "./services/transferService.js";

export interface AppDependencies {
  ledger: EthLedgerService;
  authService: AuthService;
  parcelService: ParcelService;
  transferService: TransferService;
}

/**
 * Builds the HTTP application with JSON parsing and API routers mounted.
 *
 * Mounted prefixes:
 * - `/health` — liveness
 * - `/api/auth` — CNIC signup, login, `me`
 * - `/api/parcels` — public search, detail, document downloads
 * - `/api/transfers` — authenticated transfer + simulated NADRA completion
 * - `/api/admin` — admin-only parcel creation
 * - `/api/blockchain` — ledger summary, full chain read, optional generic append
 *
 * @param deps - Shared singletons (ledger, auth, parcels, transfers).
 */
export function createApp(deps: AppDependencies) {
  const app = express();
  app.use(express.json());

  const requireAuth = createAuthMiddleware(deps.authService);

  /**
   * **`GET /health`** — Process liveness check only; does not query MongoDB or the chain.
   */
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", createAuthRouter(deps.authService, requireAuth));
  app.use("/api/parcels", createParcelRouter(deps.parcelService));
  app.use("/api/transfers", createTransferRouter(deps.transferService, requireAuth));
  app.use("/api/admin", createAdminRouter(deps.parcelService, requireAuth));
  app.use("/api/blockchain", createBlockchainRouter(deps.ledger, requireAuth));

  return app;
}
