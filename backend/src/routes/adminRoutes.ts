import { Router, Response } from "express";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth.js";
import * as parcelService from "../services/parcelService.js";
import * as authService from "../services/authService.js";
import * as auditService from "../services/auditService.js";

const router = Router();

/**
 * POST /api/admin/parcels
 * Register a new land parcel (admin only).
 */
router.post(
  "/parcels",
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        district,
        moza,
        plotNumber,
        currentOwnerCnic,
        khasra,
        disputed,
        fardText,
        registryText,
        mutationText,
      } = req.body;

      if (!district || !moza || !plotNumber || !currentOwnerCnic) {
        res.status(400).json({
          error: "district, moza, plotNumber, and currentOwnerCnic are required.",
        });
        return;
      }

      const parcel = await parcelService.createParcel({
        district,
        moza,
        plotNumber,
        currentOwnerCnic,
        khasra,
        disputed,
        fardText,
        registryText,
        mutationText,
      });

      // KAN-24: Audit parcel creation
      auditService
        .logAction(
          "PARCEL_CREATE",
          req.user!.userId,
          req.user!.cnic,
          "parcel",
          parcel.id as string,
          { district, moza, plotNumber }
        )
        .catch(() => {});

      res.status(201).json({ parcel });
    } catch (err: unknown) {
      const e = err as { status?: number; error?: string };
      res.status(e.status || 500).json({ error: e.error || "Internal error." });
    }
  }
);

/**
 * PATCH /api/admin/parcels/:parcelId
 * Update parcel fields (KAN-20: flag disputed properties after creation).
 * Admin only.
 */
router.patch(
  "/parcels/:parcelId",
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { disputed } = req.body;

      if (typeof disputed !== "boolean") {
        res.status(400).json({
          error: "disputed (boolean) is required.",
        });
        return;
      }

      const parcel = await parcelService.updateParcelDisputed(
        req.params.parcelId,
        disputed
      );

      // KAN-24: Audit parcel update
      auditService
        .logAction(
          "PARCEL_UPDATE",
          req.user!.userId,
          req.user!.cnic,
          "parcel",
          req.params.parcelId,
          { disputed }
        )
        .catch(() => {});

      res.json({ parcel });
    } catch (err: unknown) {
      const e = err as { status?: number; error?: string };
      res.status(e.status || 500).json({ error: e.error || "Internal error." });
    }
  }
);

/**
 * POST /api/admin/users/judge
 * Create a judge account (KAN-16). Admin only — no self-registration.
 */
router.post(
  "/users/judge",
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { cnic, password, fullName, email } = req.body;

      if (!cnic || !password || !fullName) {
        res.status(400).json({
          error: "cnic, password, and fullName are required.",
        });
        return;
      }

      const judge = await authService.createJudge(cnic, password, fullName, email);

      // KAN-24: Audit judge creation
      auditService
        .logAction(
          "JUDGE_CREATE",
          req.user!.userId,
          req.user!.cnic,
          "user",
          String(judge.id),
          { judgeCnic: judge.cnic }
        )
        .catch(() => {});

      res.status(201).json({ user: judge });
    } catch (err: unknown) {
      const e = err as { status?: number; error?: string };
      res.status(e.status || 500).json({ error: e.error || "Internal error." });
    }
  }
);

export default router;
