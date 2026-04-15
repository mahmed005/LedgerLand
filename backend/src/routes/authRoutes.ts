import { Router, Request, Response } from "express";
import * as authService from "../services/authService.js";
import * as auditService from "../services/auditService.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

/**
 * POST /api/auth/signup
 * Create a new citizen account with CNIC + password.
 */
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { cnic, password, fullName, email } = req.body;
    const user = await authService.signup(cnic, password, fullName, email);

    // KAN-24: Audit signup
    auditService
      .logAction("SIGNUP", String(user.id), user.cnic, "user", String(user.id))
      .catch(() => {});

    res.status(201).json({ user });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: string };
    res.status(e.status || 500).json({ error: e.error || "Internal error." });
  }
});

/**
 * POST /api/auth/login
 * Authenticate via CNIC + password → JWT token.
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { cnic, password } = req.body;
    const result = await authService.login(cnic, password);

    // KAN-24: Audit login
    auditService
      .logAction(
        "LOGIN",
        String(result.user.id),
        result.user.cnic,
        "auth",
        null
      )
      .catch(() => {});

    res.json(result);
  } catch (err: unknown) {
    const e = err as { status?: number; error?: string };
    res.status(e.status || 500).json({ error: e.error || "Internal error." });
  }
});

/**
 * GET /api/auth/me
 * Return the profile of the currently authenticated user.
 */
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { User } = await import("../models/User.js");
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json({ user: authService.toPublicUser(user) });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

export default router;
