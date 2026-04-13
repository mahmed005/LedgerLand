import { createReadStream } from "node:fs";
import { Router } from "express";
import type { ParcelService } from "../services/parcelService.js";
import { buildOwnershipCertificatePdf } from "../services/documentService.js";

/**
 * **Public** parcel API under `/api/parcels`: search, detail, and document downloads (no JWT).
 * Matches MVP requirement that land records be viewable broadly.
 *
 * @param parcels - Parcel service instance.
 * @returns Router with search, document paths, then `:parcelId` detail (order matters).
 */
export function createParcelRouter(parcels: ParcelService): Router {
  const router = Router();

  /**
   * **`GET /api/parcels/search`**
   *
   * Finds parcels matching **all** supplied query params (**AND**). At least one param must be non-empty.
   *
   * **Query parameters** (all optional individually; pass at least one):
   * - `district` — case-insensitive substring match on parcel `district`.
   * - `moza` — case-insensitive substring match on parcel `moza`.
   * - `plotNumber` — case-insensitive substring match on parcel `plotNumber`.
   * - `ownerCnic` — digits-only normalization; exact match on `currentOwnerCnic` when valid 13-digit CNIC.
   *
   * **Responses:** `{ found: true, parcels: ParcelPublicView[] }` or
   * `{ found: false, message: "No record found.", parcels: [] }` (also when no query filters).
   *
   * @see README “Query parameters & sample JSON” for example URLs and JSON samples.
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

  /**
   * **`GET /api/parcels/:parcelId/documents/fard`**
   *
   * Streams the **Fard** (title deed) text file if an admin stored one at parcel creation.
   */
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

  /**
   * **`GET /api/parcels/:parcelId/documents/registry`**
   *
   * Streams the **registry** document when present (optional per parcel).
   */
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

  /**
   * **`GET /api/parcels/:parcelId/documents/ownership-certificate.pdf`**
   *
   * Builds a **PDF** ownership summary (parcel facts + full history) for bank/court-style demos.
   */
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
   * **`GET /api/parcels/:parcelId`**
   *
   * Returns one parcel including **ownershipHistory**, **disputed**, and document availability flags.
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
