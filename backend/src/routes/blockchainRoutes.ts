import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import * as ethLedger from "../services/ethLedgerService.js";

const router = Router();

/**
 * GET /api/blockchain
 * Operational summary of the deployed LandLedger contract.
 */
router.get("/", async (_req, res) => {
  try {
    const summary = await ethLedger.getSummary();
    res.json(summary);
  } catch {
    res.status(500).json({ error: "Failed to query blockchain." });
  }
});

/**
 * GET /api/blockchain/blocks
 * Read all on-chain records (audit transparency).
 */
router.get("/blocks", async (_req, res) => {
  try {
    const blocks = await ethLedger.getRecords();
    res.json({ blocks });
  } catch {
    res.status(500).json({ error: "Failed to read blockchain records." });
  }
});

/**
 * POST /api/blockchain/blocks
 * Authenticated generic append — wraps payload in LEDGER_APPEND envelope.
 */
router.post("/blocks", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== "object") {
      res.status(400).json({ error: "Body must contain a `data` object." });
      return;
    }

    const envelope = {
      type: "LEDGER_APPEND",
      recordedAt: new Date().toISOString(),
      actorUserId: req.user!.userId,
      actorCnic: req.user!.cnic,
      body: data,
    };

    const { transactionHash, recordIndex } = await ethLedger.addRecord(envelope);

    res.status(201).json({ transactionHash, recordIndex, envelope });
  } catch {
    res.status(500).json({ error: "Failed to write to blockchain." });
  }
});

export default router;
