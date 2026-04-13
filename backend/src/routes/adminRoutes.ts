import { Router, type RequestHandler } from "express";
import type { ParcelService } from "../services/parcelService.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

/**
 * **Admin** API under `/api/admin` for land-record officers: create parcels and seed documents.
 * Every route requires JWT + `role: "admin"`.
 *
 * @param parcels - Parcel service.
 * @param requireAuth - JWT middleware (runs before {@link requireAdmin}).
 * @returns Router mounted at `/api/admin`.
 */
export function createAdminRouter(parcels: ParcelService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireAdmin);

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

  return router;
}
