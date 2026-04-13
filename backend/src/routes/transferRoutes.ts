import { Router, type RequestHandler } from "express";
import type { TransferService } from "../services/transferService.js";
import { normalizeCnic } from "../utils/cnic.js";

/**
 * **Authenticated** transfer API under `/api/transfers`.
 * Seller opens a ticket; seller or buyer completes **simulated NADRA** and on-chain finalization.
 *
 * @param transfers - Transfer orchestration service.
 * @param requireAuth - JWT middleware applied to all routes in this router.
 * @returns Express router mounted at `/api/transfers`.
 */
export function createTransferRouter(transfers: TransferService, requireAuth: RequestHandler): Router {
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
   * **`POST /api/transfers/:transferId/simulate-nadra`**
   *
   * **MVP:** Pretends both seller and buyer passed NADRA biometrics, then **writes `LAND_TRANSFER`**
   * to the smart contract**, updates Mongo **owner** and **history**, and marks the ticket completed.
   * Caller must be **seller or buyer** on the ticket.
   */
  router.post("/:transferId/simulate-nadra", async (req, res) => {
    try {
      const actor = normalizeCnic(req.user!.cnic);
      const result = await transfers.simulateNadraAndComplete(req.params.transferId, actor);
      res.json({
        message: "NADRA verification simulated and transfer completed.",
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
