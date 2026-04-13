import { Router, type RequestHandler } from "express";
import type { EthLedgerService } from "../ledger/ethLedgerService.js";

/**
 * **Ledger inspection and generic append** under `/api/blockchain`.
 * Reads are public; append requires JWT (auditing / extensions).
 *
 * @param ledger - Solidity-backed {@link EthLedgerService}.
 * @param requireAuth - Middleware that sets `req.user` for authenticated append.
 * @returns Router mounted at `/api/blockchain`.
 */
export function createBlockchainRouter(
  ledger: EthLedgerService,
  requireAuth: RequestHandler,
): Router {
  const router = Router();

  /**
   * **`GET /api/blockchain`**
   *
   * Returns **RPC health**, on-chain **record count**, latest block hash / chain id, and **contract address**.
   */
  router.get("/", async (_req, res) => {
    const summary = await ledger.getSummary();
    res.json({
      valid: summary.rpcOk,
      blockCount: summary.recordCount,
      tip: summary.latestBlockHash
        ? { hash: summary.latestBlockHash, chainId: summary.chainId.toString() }
        : null,
      contractAddress: summary.contractAddress,
    });
  });

  /**
   * **`GET /api/blockchain/blocks`**
   *
   * Lists **all** on-chain records with parsed JSON payloads where possible (development / audit view).
   */
  router.get("/blocks", async (_req, res) => {
    const rows = await ledger.listRecords();
    const blocks = rows.map((r) => {
      try {
        return {
          index: r.index,
          author: r.author,
          timestamp: r.timestamp,
          payload: JSON.parse(r.jsonPayload) as unknown,
        };
      } catch {
        return {
          index: r.index,
          author: r.author,
          timestamp: r.timestamp,
          payload: null,
          rawPayload: r.jsonPayload,
        };
      }
    });
    res.json({ blocks });
  });

  /**
   * **`POST /api/blockchain/blocks`**
   *
   * Appends a **generic** JSON object inside a `LEDGER_APPEND` envelope (actor user id + CNIC, time).
   * Distinct from **`LAND_TRANSFER`** entries produced by `/api/transfers`.
   */
  router.post("/blocks", requireAuth, async (req, res) => {
    try {
      const body = req.body?.data;
      if (body === undefined || typeof body !== "object" || body === null || Array.isArray(body)) {
        res.status(400).json({ error: "data must be a JSON object" });
        return;
      }
      const user = req.user!;
      const envelope: Record<string, unknown> = {
        type: "LEDGER_APPEND",
        recordedAt: new Date().toISOString(),
        actorUserId: user.id,
        actorCnic: user.cnic,
        body,
      };
      const result = await ledger.appendLedgerEntry(envelope);
      res.status(201).json({
        transactionHash: result.transactionHash,
        recordIndex: result.recordIndex,
        envelope,
      });
    } catch {
      res.status(500).json({ error: "Failed to append on-chain record" });
    }
  });

  return router;
}
