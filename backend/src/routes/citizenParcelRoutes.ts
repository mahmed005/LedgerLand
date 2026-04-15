import { Router, type RequestHandler } from "express";
import type { ParcelService } from "../services/parcelService.js";
import type { AuditService } from "../services/auditService.js";

/**
 * Authenticated **citizen** routes for maintaining documents on parcels they own.
 *
 * @param parcels - Parcel service.
 * @param requireAuth - JWT middleware.
 * @param audit - Audit logger.
 * @returns Router mounted at `/api/citizen/parcels`.
 */
export function createCitizenParcelRouter(
  parcels: ParcelService,
  requireAuth: RequestHandler,
  audit: AuditService,
): Router {
  const router = Router();
  router.use(requireAuth);

  /**
   * **`POST /api/citizen/parcels/:parcelId/documents`**
   *
   * Body: `{ "kind": "fard" | "registry" | "mutation", "text": "<utf-8 plain text>" }`.
   * Caller must be the parcel’s **current owner** (JWT CNIC match).
   */
  router.post("/:parcelId/documents", async (req, res) => {
    try {
      const kind = req.body?.kind;
      const text = req.body?.text;
      if (kind !== "fard" && kind !== "registry" && kind !== "mutation") {
        res.status(400).json({ error: 'kind must be "fard", "registry", or "mutation"' });
        return;
      }
      if (typeof text !== "string") {
        res.status(400).json({ error: "text must be a string" });
        return;
      }
      const parcel = await parcels.saveParcelDocument(
        req.params.parcelId,
        { cnic: req.user!.cnic, role: req.user!.role },
        kind,
        text,
      );
      await audit.record({
        action: "parcel.citizen_document_uploaded",
        actorUserId: req.user!.id,
        actorCnic: req.user!.cnic,
        metadata: { parcelId: parcel.id, kind },
      });
      res.status(201).json({ parcel });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UNKNOWN";
      if (msg === "PARCEL_NOT_FOUND") {
        res.status(404).json({ error: "Parcel not found" });
        return;
      }
      if (msg === "NOT_ALLOWED") {
        if (req.user?.role === "judge") {
          res.status(403).json({ error: "Court officers cannot upload parcel documents" });
          return;
        }
        res.status(403).json({
          error: "Only the current owner or an admin may upload documents for this parcel",
        });
        return;
      }
      if (msg === "EMPTY_DOCUMENT" || msg === "INVALID_ACTOR_CNIC") {
        res.status(400).json({ error: "Invalid document payload" });
        return;
      }
      res.status(500).json({ error: "Failed to store document" });
    }
  });

  return router;
}
