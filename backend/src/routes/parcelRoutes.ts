import { createReadStream } from "node:fs";
import { Router, type Request, type RequestHandler } from "express";
import type { ParcelService } from "../services/parcelService.js";
import { buildOwnershipCertificatePdf } from "../services/documentService.js";
import {
  applyParcelSensitiveRbac,
  assertOwnerSearchAllowed,
  canViewFullSensitiveParcelData,
} from "../utils/parcelRbac.js";

function parcelIdFromReq(req: Request): string {
  const id = req.params["parcelId"];
  if (typeof id === "string") {
    return id;
  }
  if (Array.isArray(id) && id[0]) {
    return id[0];
  }
  return "";
}

/**
 * Parcel API under `/api/parcels`: location-based search and detail are available **without** login, but
 * **CNICs and registered owner names are redacted** unless the viewer is `admin`/`judge` or a `citizen` tied to the parcel.
 * **Document downloads require JWT** and the same sensitive-data rule as full JSON.
 *
 * @param parcels - Parcel service instance.
 * @param optionalAuth - Sets `req.user` when a valid Bearer token is sent; continues anonymously otherwise.
 * @param requireAuth - Required for `.../documents/*` routes.
 * @returns Router with search, document paths, then `:parcelId` detail (order matters).
 */
export function createParcelRouter(
  parcels: ParcelService,
  optionalAuth: RequestHandler,
  requireAuth: RequestHandler,
): Router {
  const router = Router();
  router.use(optionalAuth);

  /**
   * **`GET /api/parcels/search`**
   *
   * Finds parcels matching **all** supplied query params (**AND**). At least one param must be non-empty.
   *
   * **RBAC:** `ownerCnic` requires authentication; citizens may only search **their own** CNIC; `admin`/`judge` may search any.
   * Result rows apply {@link applyParcelSensitiveRbac} per parcel.
   *
   * **Query parameters** (all optional individually; pass at least one):
   * - `district` — case-insensitive substring match on parcel `district`.
   * - `moza` — case-insensitive substring match on parcel `moza`.
   * - `plotNumber` — case-insensitive substring match on parcel `plotNumber`.
   * - `ownerCnic` — digits-only normalization; exact match on `currentOwnerCnic` when valid 13-digit CNIC (auth rules above).
   *
   * @see README “Query parameters & sample JSON” for example URLs and JSON samples.
   */
  router.get("/search", async (req, res) => {
    const district = typeof req.query.district === "string" ? req.query.district : undefined;
    const moza = typeof req.query.moza === "string" ? req.query.moza : undefined;
    const plotNumber = typeof req.query.plotNumber === "string" ? req.query.plotNumber : undefined;
    const ownerCnic = typeof req.query.ownerCnic === "string" ? req.query.ownerCnic : undefined;
    const gate = assertOwnerSearchAllowed(req.user, ownerCnic);
    if (!gate.ok) {
      res.status(gate.status).json({ error: gate.error });
      return;
    }
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
    const parcelsOut = list.map((p) => applyParcelSensitiveRbac(req.user, p));
    res.json({ found: true, parcels: parcelsOut });
  });

  /**
   * **`GET /api/parcels/:parcelId/documents/fard`**
   *
   * **JWT required.** Streams Fard text only when the caller may view sensitive parcel data for this id.
   */
  router.get("/:parcelId/documents/fard", requireAuth, async (req, res) => {
    const parcelId = parcelIdFromReq(req);
    const p = await parcels.getParcelById(parcelId);
    if (!p) {
      res.status(404).json({ error: "No record found for this parcel id." });
      return;
    }
    if (!canViewFullSensitiveParcelData(req.user, p)) {
      res.status(403).json({ error: "Not authorized to download documents for this parcel." });
      return;
    }
    const resolved = await parcels.resolveDocumentPath(parcelId, "fard");
    if (!resolved) {
      res.status(404).json({ error: "Fard document is not available for this parcel." });
      return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="fard-${parcelId}.txt"`);
    createReadStream(resolved.absolutePath).pipe(res);
  });

  /**
   * **`GET /api/parcels/:parcelId/documents/registry`**
   *
   * **JWT required** and same RBAC as Fard.
   */
  router.get("/:parcelId/documents/registry", requireAuth, async (req, res) => {
    const parcelId = parcelIdFromReq(req);
    const p = await parcels.getParcelById(parcelId);
    if (!p) {
      res.status(404).json({ error: "No record found for this parcel id." });
      return;
    }
    if (!canViewFullSensitiveParcelData(req.user, p)) {
      res.status(403).json({ error: "Not authorized to download documents for this parcel." });
      return;
    }
    const resolved = await parcels.resolveDocumentPath(parcelId, "registry");
    if (!resolved) {
      res.status(404).json({ error: "Registry document is not available for this parcel." });
      return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="registry-${parcelId}.txt"`);
    createReadStream(resolved.absolutePath).pipe(res);
  });

  /**
   * **`GET /api/parcels/:parcelId/documents/mutation`**
   *
   * **JWT required** and same RBAC as Fard.
   */
  router.get("/:parcelId/documents/mutation", requireAuth, async (req, res) => {
    const parcelId = parcelIdFromReq(req);
    const p = await parcels.getParcelById(parcelId);
    if (!p) {
      res.status(404).json({ error: "No record found for this parcel id." });
      return;
    }
    if (!canViewFullSensitiveParcelData(req.user, p)) {
      res.status(403).json({ error: "Not authorized to download documents for this parcel." });
      return;
    }
    const resolved = await parcels.resolveDocumentPath(parcelId, "mutation");
    if (!resolved) {
      res.status(404).json({ error: "Mutation document is not available for this parcel." });
      return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="mutation-${parcelId}.txt"`);
    createReadStream(resolved.absolutePath).pipe(res);
  });

  /**
   * **`GET /api/parcels/:parcelId/documents/ownership-certificate.pdf`**
   *
   * **JWT required** and same RBAC; PDF is generated from the **full** internal parcel view (never redacted placeholders).
   */
  router.get("/:parcelId/documents/ownership-certificate.pdf", requireAuth, async (req, res) => {
    const parcelId = parcelIdFromReq(req);
    const p = await parcels.getParcelById(parcelId);
    if (!p) {
      res.status(404).json({ error: "No record found for this parcel id." });
      return;
    }
    if (!canViewFullSensitiveParcelData(req.user, p)) {
      res.status(403).json({ error: "Not authorized to download documents for this parcel." });
      return;
    }
    const pdf = await buildOwnershipCertificatePdf(p);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ownership-certificate-${parcelId}.pdf"`,
    );
    res.send(pdf);
  });

  /**
   * **`GET /api/parcels/:parcelId`**
   *
   * Parcel detail with **RBAC projection** (redacted CNICs/names when caller is not entitled to full data).
   */
  router.get("/:parcelId", async (req, res) => {
    const p = await parcels.getParcelById(parcelIdFromReq(req));
    if (!p) {
      res.status(404).json({ error: "No record found for this parcel id." });
      return;
    }
    res.json({ parcel: applyParcelSensitiveRbac(req.user, p) });
  });

  return router;
}
