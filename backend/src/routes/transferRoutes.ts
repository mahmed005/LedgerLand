import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import * as transferService from "../services/transferService.js";

const router = Router();

/**
 * GET /api/transfers/my
 * List all transfers where the authenticated user is seller or buyer (KAN-7).
 */
router.get("/my", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const transfers = await transferService.getTransfersByUser(req.user!.userId);
    res.json({ transfers });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: string };
    res.status(e.status || 500).json({ error: e.error || "Internal error." });
  }
});

/**
 * GET /api/transfers/:transferId
 * Get a single transfer by ID (KAN-7). Only visible to seller, buyer, or admin.
 */
router.get("/:transferId", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const transfer = await transferService.getTransferById(
      req.params.transferId,
      req.user!.userId
    );
    res.json({ transfer });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: string };
    res.status(e.status || 500).json({ error: e.error || "Internal error." });
  }
});

/**
 * POST /api/transfers
 * Seller (logged-in, current owner) initiates a transfer ticket.
 */
router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { parcelId, buyerCnic } = req.body;
    const result = await transferService.initiateTransfer(
      req.user!.userId,
      parcelId,
      buyerCnic
    );
    res.status(201).json(result);
  } catch (err: unknown) {
    const e = err as { status?: number; error?: string };
    res.status(e.status || 500).json({ error: e.error || "Internal error." });
  }
});

/**
 * POST /api/transfers/:transferId/approve
 * Buyer explicitly approves the transfer (KAN-7).
 * Moves status from pending_buyer → pending_nadra.
 */
router.post(
  "/:transferId/approve",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await transferService.buyerApproveTransfer(
        req.params.transferId,
        req.user!.userId
      );
      res.json(result);
    } catch (err: unknown) {
      const e = err as { status?: number; error?: string };
      res.status(e.status || 500).json({ error: e.error || "Internal error." });
    }
  }
);

/**
 * POST /api/transfers/:transferId/simulate-nadra
 * MVP substitute for NADRA biometric verification. Seller or buyer may call.
 * KAN-8: Accepts optional `simulateFailure` body param for rejection path.
 */
router.post(
  "/:transferId/simulate-nadra",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const simulateFailure = req.body.simulateFailure === true;
      const result = await transferService.simulateNadra(
        req.params.transferId,
        req.user!.userId,
        simulateFailure
      );
      res.json(result);
    } catch (err: unknown) {
      const e = err as { status?: number; error?: string };
      res.status(e.status || 500).json({ error: e.error || "Internal error." });
    }
  }
);

export default router;
