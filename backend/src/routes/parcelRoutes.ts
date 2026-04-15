import { createReadStream } from "node:fs";
import multer from "multer";
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import type { ParcelService } from "../services/parcelService.js";
import type { AuditService } from "../services/auditService.js";
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

const parcelDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function optionalMultipartDocument(req: Request, res: Response, next: NextFunction): void {
  const ct = req.headers["content-type"] ?? "";
  if (ct.includes("multipart/form-data")) {
    parcelDocumentUpload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File too large (max 10 MB)" });
        return;
      }
      next(err);
    });
    return;
  }
  next();
}

/**
 * Parcel API under `/api/parcels`: location-based search and detail are available **without** login, but
 * **CNICs and registered owner names are redacted** unless the viewer is `admin`/`judge` or a `citizen` tied to the parcel.
 * **Document downloads require JWT** and the same sensitive-data rule as full JSON.
 *
 * @param parcels - Parcel service instance.
 * @param optionalAuth - Sets `req.user` when a valid Bearer token is sent; continues anonymously otherwise.
 * @param requireAuth - Required for `.../documents/*` routes.
 * @param audit - Audit trail for document uploads.
 * @returns Router with search, document paths, then `:parcelId` detail (order matters).
 */
export function createParcelRouter(
  parcels: ParcelService,
  optionalAuth: RequestHandler,
  requireAuth: RequestHandler,
  audit: AuditService,
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
   * **`POST /api/parcels/:parcelId/documents/upload`**
   *
   * **JWT required.** Upload or replace Fard / registry / mutation text for a parcel.
   * **`admin`** may upload for any parcel; others must be the **current owner**. **`judge`** cannot upload.
   *
   * - **JSON:** `Content-Type: application/json`, body `{ "kind": "fard" | "registry" | "mutation", "text": "..." }`.
   * - **Multipart:** `kind` form field plus `file` (optional plain-text body) or a `text` form field.
   */
  router.post(
    "/:parcelId/documents/upload",
    requireAuth,
    optionalMultipartDocument,
    async (req, res) => {
      const parcelId = parcelIdFromReq(req);
      const kind = req.body?.kind;
      if (kind !== "fard" && kind !== "registry" && kind !== "mutation") {
        res.status(400).json({ error: 'kind must be "fard", "registry", or "mutation"' });
        return;
      }
      const file = req.file;
      let text: string;
      if (file?.buffer && file.buffer.length > 0) {
        text = file.buffer.toString("utf8");
      } else if (typeof req.body?.text === "string") {
        text = req.body.text;
      } else {
        res.status(400).json({
          error: "Provide a JSON body with text, or multipart fields kind and file (or text)",
        });
        return;
      }
      try {
        const parcel = await parcels.saveParcelDocument(parcelId, {
          cnic: req.user!.cnic,
          role: req.user!.role,
        }, kind, text);
        await audit.record({
          action: "parcel.document_uploaded",
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
    },
  );

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
