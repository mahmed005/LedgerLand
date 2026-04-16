import { Router, type RequestHandler } from "express";
import type { ParcelService } from "../services/parcelService.js";
import type { AuditService } from "../services/auditService.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

/**
 * **Admin** API under `/api/admin` for land-record officers: create parcels and seed documents.
 * Every route requires JWT + `role: "admin"`.
 *
 * @param parcels - Parcel service.
 * @param requireAuth - JWT middleware (runs before {@link requireAdmin}).
 * @param audit - Optional audit trail for administrative writes.
 * @returns Router mounted at `/api/admin`.
 */
export function createAdminRouter(
  parcels: ParcelService,
  requireAuth: RequestHandler,
  audit?: AuditService,
): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireAdmin);

  /**
   * **`GET /api/admin/parcels`**
   *
   * Lists all parcels for admin management screens.
   */
  router.get("/parcels", async (_req, res) => {
    try {
      const list = await parcels.listParcels();
      res.json({ parcels: list });
    } catch {
      res.status(500).json({ error: "Failed to load parcels" });
    }
  });

  /**
   * **`POST /api/admin/parcels`**
   *
   * **Registers a new parcel** with location fields, current owner CNIC, optional khasra and
   * **disputed** flag, and optional **Fard/registry** plain text (written to disk for public download).
   * Initializes ownership history with the first owner entry.
   */
  router.post("/parcels", async (req, res) => {
    try {
      const b = req.body ?? {};
      const district = b.district;
      const moza = b.moza;
      const plotNumber = b.plotNumber;
      const currentOwnerCnic = b.currentOwnerCnic;
      if (
        typeof district !== "string" ||
        typeof moza !== "string" ||
        typeof plotNumber !== "string" ||
        typeof currentOwnerCnic !== "string"
      ) {
        res.status(400).json({
          error: "district, moza, plotNumber, and currentOwnerCnic are required strings",
        });
        return;
      }
      const created = await parcels.createParcel({
        district,
        moza,
        plotNumber,
        khasra: typeof b.khasra === "string" ? b.khasra : undefined,
        currentOwnerCnic,
        disputed: Boolean(b.disputed),
        fardText: typeof b.fardText === "string" ? b.fardText : undefined,
        registryText: typeof b.registryText === "string" ? b.registryText : undefined,
        mutationText: typeof b.mutationText === "string" ? b.mutationText : undefined,
      });
      await audit?.record({
        action: "admin.parcel_created",
        actorUserId: req.user!.id,
        actorCnic: req.user!.cnic,
        metadata: { parcelId: created.id },
      });
      res.status(201).json({ parcel: created });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UNKNOWN";
      if (msg === "INVALID_OWNER_CNIC") {
        res.status(400).json({ error: "Owner CNIC must be 13 digits" });
        return;
      }
      res.status(500).json({ error: "Failed to create parcel" });
    }
  });

  /**
   * **`PATCH /api/admin/parcels/:parcelId`**
   *
   * Updates mutable officer fields. Currently supports `{ "disputed": boolean }` to flag or clear disputes
   * on an **existing** parcel.
   */
  router.patch("/parcels/:parcelId", async (req, res) => {
    try {
      if (!req.body || typeof req.body.disputed !== "boolean") {
        res.status(400).json({ error: "disputed boolean is required" });
        return;
      }
      const updated = await parcels.updateDisputed(req.params.parcelId, req.body.disputed);
      if (!updated) {
        res.status(404).json({ error: "Parcel not found" });
        return;
      }
      await audit?.record({
        action: "admin.parcel_updated",
        actorUserId: req.user!.id,
        actorCnic: req.user!.cnic,
        metadata: { parcelId: updated.id, disputed: updated.disputed },
      });
      res.json({ parcel: updated });
    } catch (err) {
      void err;
      res.status(500).json({ error: "Failed to update parcel" });
    }
  });

  return router;
}
