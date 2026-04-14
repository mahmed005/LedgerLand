import { createReadStream } from "node:fs";
import { Router, type RequestHandler } from "express";
import type { ParcelService } from "../services/parcelService.js";
import { buildOwnershipCertificatePdf } from "../services/documentService.js";
import { requireRoles } from "../middleware/requireRoles.js";

/**
 * **Court / judge** read API under `/api/court/parcels` (JWT with `judge` or `admin` role).
 * Mirrors public parcel search/detail/downloads so authorized officers can use authenticated endpoints.
 *
 * @param parcels - Parcel service.
 * @param requireAuth - JWT middleware (must run before {@link requireRoles}).
 * @returns Router mounted at `/api/court/parcels`.
 */
export function createCourtRouter(parcels: ParcelService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRoles("judge", "admin"));

  /**
   * **`GET /api/court/parcels/search`** — same query semantics as public search.
   */
  router.get("/search", async (req, res) => {
    const district = typeof req.query.district === "string" ? req.query.district : undefined;
    const moza = typeof req.query.moza === "string" ? req.query.moza : undefined;
    const plotNumber = typeof req.query.plotNumber === "string" ? req.query.plotNumber : undefined;
    const ownerCnic = typeof req.query.ownerCnic === "string" ? req.query.ownerCnic : undefined;
    const hasFilter = [district, moza, plotNumber, ownerCnic].some((x) => x?.trim());
    if (!hasFilter) {
      res.json({
        found: false,
        message: "No record found.",
        parcels: [],
      });
      return;
    }
    const list = await parcels.searchParcels({ district, moza, plotNumber, ownerCnic });
    if (list.length === 0) {
      res.json({
        found: false,
        message: "No record found.",
        parcels: [],
      });
      return;
    }
    res.json({ found: true, parcels: list });
  });

  router.get("/:parcelId/documents/fard", async (req, res) => {
    const resolved = await parcels.resolveDocumentPath(req.params.parcelId, "fard");
    if (!resolved) {
      res.status(404).json({ error: "Fard document is not available for this parcel." });
      return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="fard-${req.params.parcelId}.txt"`);
    createReadStream(resolved.absolutePath).pipe(res);
  });

  router.get("/:parcelId/documents/registry", async (req, res) => {
    const resolved = await parcels.resolveDocumentPath(req.params.parcelId, "registry");
    if (!resolved) {
      res.status(404).json({ error: "Registry document is not available for this parcel." });
      return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="registry-${req.params.parcelId}.txt"`);
    createReadStream(resolved.absolutePath).pipe(res);
  });

  router.get("/:parcelId/documents/mutation", async (req, res) => {
    const resolved = await parcels.resolveDocumentPath(req.params.parcelId, "mutation");
    if (!resolved) {
      res.status(404).json({ error: "Mutation document is not available for this parcel." });
      return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="mutation-${req.params.parcelId}.txt"`);
    createReadStream(resolved.absolutePath).pipe(res);
  });

  router.get("/:parcelId/documents/ownership-certificate.pdf", async (req, res) => {
    const p = await parcels.getParcelById(req.params.parcelId);
    if (!p) {
      res.status(404).json({ error: "No record found for this parcel id." });
      return;
    }
    const pdf = await buildOwnershipCertificatePdf(p);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ownership-certificate-${req.params.parcelId}.pdf"`,
    );
    res.send(pdf);
  });

  /**
   * **`GET /api/court/parcels/:parcelId`** — parcel detail with ownership history.
   */
  router.get("/:parcelId", async (req, res) => {
    const p = await parcels.getParcelById(req.params.parcelId);
    if (!p) {
      res.status(404).json({ error: "No record found for this parcel id." });
      return;
    }
    res.json({ parcel: p });
  });

  return router;
}
