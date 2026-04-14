import express from "express";
import type { EthLedgerService } from "./ledger/ethLedgerService.js";
import { createAuthMiddleware, createOptionalAuthMiddleware } from "./auth/authMiddleware.js";
import { createAuthRouter } from "./auth/authRoutes.js";
import type { AuthService } from "./auth/authService.js";
import { MongoUserRepository } from "./auth/userRepository.js";
import { createBlockchainRouter } from "./routes/blockchainRoutes.js";
import { createParcelRouter } from "./routes/parcelRoutes.js";
import { createTransferRouter } from "./routes/transferRoutes.js";
import { createAdminRouter } from "./routes/adminRoutes.js";
import { createCitizenParcelRouter } from "./routes/citizenParcelRoutes.js";
import { createCourtRouter } from "./routes/courtRoutes.js";
import type { ParcelService } from "./services/parcelService.js";
import type { TransferService } from "./services/transferService.js";
import { AuditService } from "./services/auditService.js";
import { NotificationService } from "./services/notificationService.js";

export interface AppDependencies {
  ledger: EthLedgerService;
  authService: AuthService;
  parcelService: ParcelService;
  transferService: TransferService;
  /** When omitted, a default {@link AuditService} and {@link NotificationService} are constructed. */
  auditService?: AuditService;
  notificationService?: NotificationService;
}

/**
 * Builds the HTTP application with JSON parsing and API routers mounted.
 *
 * Mounted prefixes:
 * - `/health` — liveness
 * - `/api/auth` — CNIC signup, login, `me`
 * - `/api/parcels` — RBAC-aware search & detail (optional JWT); document downloads require JWT
 * - `/api/citizen/parcels` — owner document uploads (JWT)
 * - `/api/court/parcels` — judge/admin mirror of parcel reads & downloads (JWT)
 * - `/api/transfers` — authenticated transfer + buyer approval + simulated NADRA completion
 * - `/api/admin` — admin-only parcel creation and updates
 * - `/api/blockchain` — ledger summary, full chain read, optional generic append
 *
 * @param deps - Shared singletons (ledger, auth, parcels, transfers).
 */
export function createApp(deps: AppDependencies) {
  const app = express();
  app.use(express.json());

  const requireAuth = createAuthMiddleware(deps.authService);
  const optionalAuth = createOptionalAuthMiddleware(deps.authService);
  const userRepository = new MongoUserRepository();
  const audit = deps.auditService ?? new AuditService();
  const notifications = deps.notificationService ?? new NotificationService(userRepository);

  /**
   * **`GET /health`** — Process liveness check only; does not query MongoDB or the chain.
   */
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", createAuthRouter(deps.authService, requireAuth, audit));
  app.use("/api/parcels", createParcelRouter(deps.parcelService, optionalAuth, requireAuth));
  app.use(
    "/api/citizen/parcels",
    createCitizenParcelRouter(deps.parcelService, requireAuth, audit),
  );
  app.use("/api/court/parcels", createCourtRouter(deps.parcelService, requireAuth));
  app.use(
    "/api/transfers",
    createTransferRouter({
      transfers: deps.transferService,
      requireAuth,
      audit,
      notifications,
    }),
  );
  app.use("/api/admin", createAdminRouter(deps.parcelService, requireAuth, audit));
  app.use("/api/blockchain", createBlockchainRouter(deps.ledger, requireAuth));

  return app;
}
