import { Router, type RequestHandler } from "express";
import type { AuthService } from "./authService.js";
import type { AuditService } from "../services/auditService.js";

/**
 * Mounts citizen authentication under `/api/auth` (signup, login, session).
 *
 * @param auth - Business logic for credentials and tokens.
 * @param requireAuth - Middleware enforcing a valid JWT.
 * @param audit - Optional audit logger (successful logins are recorded when provided).
 * @returns Express router for `/signup`, `/login`, `/me`.
 */
export function createAuthRouter(
  auth: AuthService,
  requireAuth: RequestHandler,
  audit?: AuditService,
): Router {
  const router = Router();

  /**
   * **`POST /api/auth/signup`**
   *
   * Creates a new user keyed by **CNIC** (13 digits after normalization). Stores a bcrypt password
   * hash and returns a public profile (no secrets). Optional `email` is for future notifications.
   * Call once per person before login.
   */
  router.post("/signup", async (req, res) => {
    try {
      const { cnic, password, fullName, email } = req.body ?? {};
      if (typeof cnic !== "string" || typeof password !== "string" || typeof fullName !== "string") {
        res.status(400).json({ error: "cnic, password, and fullName are required strings" });
        return;
      }
      const user = await auth.signup({
        cnic,
        password,
        fullName,
        email: typeof email === "string" ? email : null,
      });
      res.status(201).json({ user });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UNKNOWN";
      if (msg === "CNIC_IN_USE") {
        res.status(409).json({ error: "CNIC already registered" });
        return;
      }
      if (msg === "WEAK_PASSWORD") {
        res.status(400).json({ error: "Password must be at least 8 characters" });
        return;
      }
      if (msg === "INVALID_CNIC") {
        res.status(400).json({ error: "CNIC must be 13 digits" });
        return;
      }
      res.status(500).json({ error: "Signup failed" });
    }
  });

  /**
   * **`POST /api/auth/login`**
   *
   * Validates CNIC + password and returns a **JWT** for `Authorization: Bearer` on protected routes.
   */
  router.post("/login", async (req, res) => {
    try {
      const { cnic, password } = req.body ?? {};
      if (typeof cnic !== "string" || typeof password !== "string") {
        res.status(400).json({ error: "cnic and password are required strings" });
        return;
      }
      const result = await auth.login({ cnic, password });
      await audit?.record({
        action: "auth.login",
        actorUserId: result.user.id,
        actorCnic: result.user.cnic,
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UNKNOWN";
      if (msg === "INVALID_CREDENTIALS") {
        res.status(401).json({ error: "Invalid CNIC or password" });
        return;
      }
      if (msg === "INVALID_CNIC") {
        res.status(400).json({ error: "CNIC must be 13 digits" });
        return;
      }
      res.status(500).json({ error: "Login failed" });
    }
  });

  /**
   * **`GET /api/auth/me`**
   *
   * Returns the authenticated user derived from the JWT (id, cnic, fullName, role, etc.).
   */
  router.get("/me", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
