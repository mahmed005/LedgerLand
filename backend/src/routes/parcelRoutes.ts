import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import * as parcelService from "../services/parcelService.js";
import * as documentService from "../services/documentService.js";
import * as auditService from "../services/auditService.js";
import { optionalAuth, requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Multer config for citizen document uploads (KAN-11)
const upload = multer({
  dest: path.resolve(process.env.UPLOADS_DIR || "./uploads", "_tmp"),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    // Accept text files and common document formats
    const allowed = ["text/plain", "application/pdf", "image/jpeg", "image/png"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only .txt, .pdf, .jpg, and .png files are allowed."));
    }
  },
});

/**
 * GET /api/parcels/search
 * Search parcels by district, moza, plotNumber, ownerCnic (AND logic).
 * All query parameters are optional; at least one must be non-empty.
 * KAN-26: Anonymous users get redacted CNICs. Authenticated users see full data.
 */
router.get("/search", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { district, moza, plotNumber, ownerCnic } = req.query as Record<string, string>;
    const authenticated = !!req.user;
    const result = await parcelService.search(
      { district, moza, plotNumber, ownerCnic },
      authenticated
    );

    // KAN-24: Audit search action
    auditService
      .logAction(
        "SEARCH",
        req.user?.userId ?? null,
        req.user?.cnic ?? null,
        "parcel",
        null,
        { filters: { district, moza, plotNumber, ownerCnic } }
      )
      .catch(() => {});

    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

/**
 * GET /api/parcels/:parcelId
 * Get a single parcel by ID, including full ownership history.
 * KAN-26: Anonymous users get redacted CNICs. Authenticated users see full data.
 */
router.get("/:parcelId", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const authenticated = !!req.user;
    const parcel = await parcelService.getById(req.params.parcelId, authenticated);
    if (!parcel) {
      res.status(404).json({ error: "No record found for this parcel id." });
      return;
    }

    // KAN-24: Audit view action
    auditService
      .logAction(
        "PARCEL_VIEW",
        req.user?.userId ?? null,
        req.user?.cnic ?? null,
        "parcel",
        req.params.parcelId
      )
      .catch(() => {});

    res.json({ parcel });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

/**
 * POST /api/parcels/:parcelId/documents/upload
 * Citizen uploads a document (fard, registry, or mutation) (KAN-11).
 * Requires authentication.
 */
router.post(
  "/:parcelId/documents/upload",
  requireAuth,
  upload.single("document"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { docType } = req.body;
      if (!docType || !["fard", "registry", "mutation"].includes(docType)) {
        res.status(400).json({
          error: "docType must be one of: fard, registry, mutation.",
        });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded." });
        return;
      }

      const parcel = await parcelService.uploadCitizenDocument(
        req.params.parcelId,
        docType as "fard" | "registry" | "mutation",
        req.file.path
      );

      // KAN-24: Audit upload
      auditService
        .logAction(
          "DOCUMENT_UPLOAD",
          req.user!.userId,
          req.user!.cnic,
          "parcel",
          req.params.parcelId,
          { docType }
        )
        .catch(() => {});

      res.json({ message: `${docType} uploaded successfully.`, parcel });
    } catch (err: unknown) {
      const e = err as { status?: number; error?: string };
      res.status(e.status || 500).json({ error: e.error || "Internal error." });
    }
  }
);

/**
 * GET /api/parcels/:parcelId/documents/fard
 * Download the Fard (title-deed) text file.
 */
router.get("/:parcelId/documents/fard", async (req: Request, res: Response) => {
  try {
    const filePath = parcelService.getDocumentPath(req.params.parcelId, "fard");
    if (!filePath) {
      res.status(404).json({ error: "Fard document not found for this parcel." });
      return;
    }

    // KAN-24: Audit download
    auditService
      .logAction("DOCUMENT_DOWNLOAD", null, null, "parcel", req.params.parcelId, {
        docType: "fard",
      })
      .catch(() => {});

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="fard.txt"`);
    res.sendFile(filePath);
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

/**
 * GET /api/parcels/:parcelId/documents/registry
 * Download the registry text file.
 */
router.get("/:parcelId/documents/registry", async (req: Request, res: Response) => {
  try {
    const filePath = parcelService.getDocumentPath(req.params.parcelId, "registry");
    if (!filePath) {
      res.status(404).json({ error: "Registry document not found for this parcel." });
      return;
    }

    // KAN-24: Audit download
    auditService
      .logAction("DOCUMENT_DOWNLOAD", null, null, "parcel", req.params.parcelId, {
        docType: "registry",
      })
      .catch(() => {});

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="registry.txt"`);
    res.sendFile(filePath);
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

/**
 * GET /api/parcels/:parcelId/documents/mutation
 * Download the mutation (intiqal) text file (KAN-11).
 */
router.get("/:parcelId/documents/mutation", async (req: Request, res: Response) => {
  try {
    const filePath = parcelService.getDocumentPath(req.params.parcelId, "mutation");
    if (!filePath) {
      res.status(404).json({ error: "Mutation document not found for this parcel." });
      return;
    }

    // KAN-24: Audit download
    auditService
      .logAction("DOCUMENT_DOWNLOAD", null, null, "parcel", req.params.parcelId, {
        docType: "mutation",
      })
      .catch(() => {});

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="mutation.txt"`);
    res.sendFile(filePath);
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

/**
 * GET /api/parcels/:parcelId/documents/ownership-certificate.pdf
 * Generate and stream an ownership certificate PDF.
 */
router.get("/:parcelId/documents/ownership-certificate.pdf", async (req: Request, res: Response) => {
  try {
    const parcel = await parcelService.getById(req.params.parcelId, true);
    if (!parcel) {
      res.status(404).json({ error: "No record found for this parcel id." });
      return;
    }

    // KAN-24: Audit download
    auditService
      .logAction("DOCUMENT_DOWNLOAD", null, null, "parcel", req.params.parcelId, {
        docType: "ownership-certificate",
      })
      .catch(() => {});

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ownership-certificate-${parcel.id}.pdf"`
    );
    const pdfStream = documentService.generateOwnershipCertificatePdf(
      parcel as unknown as Parameters<typeof documentService.generateOwnershipCertificatePdf>[0]
    );
    pdfStream.pipe(res);
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

export default router;
