import { Router, type RequestHandler } from "express";
import type { TransferService } from "../services/transferService.js";
import type { AuditService } from "../services/auditService.js";
import type { NotificationService } from "../services/notificationService.js";
import { normalizeCnic } from "../utils/cnic.js";

export interface TransferRouterDeps {
  transfers: TransferService;
  requireAuth: RequestHandler;
  audit: AuditService;
  notifications: NotificationService;
}

/**
 * **Authenticated** transfer API under `/api/transfers`.
 * Seller opens a ticket; buyer **approves**; seller or buyer runs **simulated NADRA** and on-chain finalization.
 *
 * @param deps - Services and middleware.
 * @returns Express router mounted at `/api/transfers`.
 */
export function createTransferRouter(deps: TransferRouterDeps): Router {
  const { transfers, requireAuth, audit, notifications } = deps;
  const router = Router();
  router.use(requireAuth);

  /**
   * **`POST /api/transfers`**
   *
   * **Seller-initiated** transfer: body `{ parcelId, buyerCnic }`. Caller must be logged in as the
   * parcel’s **current owner**. Creates a `pending_nadra` ticket. Rejects disputed parcels, duplicate
   * pending transfers, invalid buyer CNIC, or self-transfer.
   */
  router.post("/", async (req, res) => {
    try {
      const parcelId = req.body?.parcelId;
      const buyerCnic = req.body?.buyerCnic;
      if (typeof parcelId !== "string" || typeof buyerCnic !== "string") {
        res.status(400).json({ error: "parcelId and buyerCnic are required strings" });
        return;
      }
      const sellerCnic = normalizeCnic(req.user!.cnic);
      const created = await transfers.createTransfer(parcelId, sellerCnic, buyerCnic);
      await audit.record({
        action: "transfer.created",
        actorUserId: req.user!.id,
        actorCnic: sellerCnic,
        metadata: { transferId: created.transferId, parcelId, buyerCnic: normalizeCnic(buyerCnic) },
      });
      await notifications.notifySellerTransferInitiated({
        sellerCnic,
        transferId: created.transferId,
        parcelId,
        buyerCnic: normalizeCnic(buyerCnic),
      });
      res.status(201).json(created);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UNKNOWN";
      if (msg === "PARCEL_NOT_FOUND") {
        res.status(404).json({ error: "Parcel not found" });
        return;
      }
      if (msg === "NOT_OWNER") {
        res.status(403).json({ error: "Only the current owner can initiate a transfer" });
        return;
      }
      if (msg === "DISPUTED") {
        res.status(409).json({ error: "Parcel is disputed; transfer is blocked" });
        return;
      }
      if (msg === "INVALID_BUYER_CNIC") {
        res.status(400).json({ error: "Buyer CNIC must be 13 digits" });
        return;
      }
      if (msg === "SELF_TRANSFER") {
        res.status(400).json({ error: "Buyer CNIC must differ from seller CNIC" });
        return;
      }
      if (msg === "TRANSFER_ALREADY_PENDING") {
        res.status(409).json({ error: "A transfer is already pending for this parcel" });
        return;
      }
      res.status(500).json({ error: "Failed to create transfer" });
    }
  });

  /**
   * **`GET /api/transfers/:transferId`**
   *
   * Returns ticket details when the caller is the **seller or buyer** (inspection before approval / NADRA).
   */
  router.get("/:transferId", async (req, res) => {
    try {
      const actor = normalizeCnic(req.user!.cnic);
      const transfer = await transfers.getTransferForParty(req.params.transferId, actor);
      res.json({ transfer });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UNKNOWN";
      if (msg === "TRANSFER_NOT_FOUND") {
        res.status(404).json({ error: "Transfer not found" });
        return;
      }
      if (msg === "NOT_PARTY") {
        res.status(403).json({ error: "Only seller or buyer can view this transfer" });
        return;
      }
      res.status(500).json({ error: "Failed to load transfer" });
    }
  });

  /**
   * **`POST /api/transfers/:transferId/buyer-approve`**
   *
   * **Buyer-only** explicit approval step before NADRA simulation. Idempotent if already approved.
   */
  router.post("/:transferId/buyer-approve", async (req, res) => {
    try {
      const buyer = normalizeCnic(req.user!.cnic);
      const transfer = await transfers.buyerApproveTransfer(req.params.transferId, buyer);
      await audit.record({
        action: "transfer.buyer_approved",
        actorUserId: req.user!.id,
        actorCnic: buyer,
        metadata: { transferId: transfer.transferId, parcelId: transfer.parcelId },
      });
      res.json({
        message: "Buyer approval recorded.",
        transfer,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UNKNOWN";
      if (msg === "TRANSFER_NOT_FOUND") {
        res.status(404).json({ error: "Transfer not found" });
        return;
      }
      if (msg === "NOT_BUYER") {
        res.status(403).json({ error: "Only the buyer can approve this transfer" });
        return;
      }
      if (msg === "NOT_PENDING") {
        res.status(409).json({ error: "Transfer is not awaiting buyer approval" });
        return;
      }
      if (msg === "DISPUTED" || msg === "PARCEL_NOT_FOUND") {
        res.status(409).json({ error: "Transfer can no longer be approved for this parcel" });
        return;
      }
      res.status(500).json({ error: "Failed to record buyer approval" });
    }
  });

  /**
   * **`POST /api/transfers/:transferId/simulate-nadra`**
   *
   * **MVP:** After buyer approval, pretends NADRA biometrics. Optional JSON body `{ "verified": true | false }`
   * (default `true`). When `verified` is `false`, the ticket ends in `nadra_failed` and **no** chain write occurs.
   */
  router.post("/:transferId/simulate-nadra", async (req, res) => {
    try {
      const actor = normalizeCnic(req.user!.cnic);
      const verified =
        req.body && Object.prototype.hasOwnProperty.call(req.body, "verified")
          ? Boolean(req.body.verified)
          : true;
      const result = await transfers.simulateNadraAndComplete(req.params.transferId, actor, {
        verified,
      });
      if (result.status === "completed") {
        await audit.record({
          action: "transfer.nadra_succeeded",
          actorUserId: req.user!.id,
          actorCnic: actor,
          metadata: {
            transferId: result.transferId,
            parcelId: result.parcelId,
            transactionHash: result.transactionHash,
          },
        });
        res.json({
          message: "NADRA verification simulated and transfer completed.",
          ...result,
        });
        return;
      }
      await audit.record({
        action: "transfer.nadra_failed",
        actorUserId: req.user!.id,
        actorCnic: actor,
        metadata: { transferId: result.transferId, parcelId: result.parcelId },
      });
      res.json({
        message: "NADRA verification failed; transfer was not completed.",
        ...result,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UNKNOWN";
      if (msg === "TRANSFER_NOT_FOUND") {
        res.status(404).json({ error: "Transfer not found" });
        return;
      }
      if (msg === "NOT_PARTY") {
        res.status(403).json({ error: "Only seller or buyer can complete verification" });
        return;
      }
      if (msg === "BUYER_NOT_APPROVED") {
        res.status(409).json({ error: "Buyer must approve the transfer before NADRA simulation" });
        return;
      }
      if (msg === "NOT_PENDING") {
        res.status(409).json({ error: "Transfer is not pending NADRA verification" });
        return;
      }
      if (msg === "DISPUTED" || msg === "OWNER_CHANGED" || msg === "PARCEL_NOT_FOUND") {
        res.status(409).json({ error: "Transfer can no longer be completed for this parcel" });
        return;
      }
      res.status(500).json({ error: "Failed to simulate NADRA / complete transfer" });
    }
  });

  return router;
}
