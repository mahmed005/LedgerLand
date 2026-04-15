import { Request, Response, NextFunction } from "express";
import * as authService from "../services/authService.js";

/** Express request with attached user. */
export interface AuthRequest extends Request {
  user?: { userId: string; cnic: string; role?: string };
}

/**
 * Middleware — extract and verify Bearer JWT, attach `req.user`.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = authService.verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

/**
 * Middleware — optional authentication. If a valid Bearer token is present,
 * attaches `req.user`. If not, continues without error.
 * Used on public routes that show extra data to authenticated users (e.g. CNIC redaction).
 */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const token = header.slice(7);
      const payload = authService.verifyToken(token);
      req.user = payload;
    } catch {
      // Invalid token — treat as anonymous, don't block
    }
  }
  next();
}

/**
 * Middleware — must follow `requireAuth`. Checks role === "admin".
 */
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  // If role was already resolved (e.g., from JWT), use it directly
  if (req.user.role === "admin") {
    next();
    return;
  }

  // Fetch fresh user to get the role (JWT payload may not include role)
  const { User } = await import("../models/User.js");
  const user = await User.findById(req.user.userId).lean();
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  req.user.role = "admin";
  next();
}

/**
 * Middleware — must follow `requireAuth`. Checks role === "judge" or "admin".
 * KAN-16: Judge gets read-only access to land records.
 */
export async function requireJudge(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  // If role was already resolved, use it directly
  if (req.user.role === "judge" || req.user.role === "admin") {
    next();
    return;
  }

  // Fetch fresh user to get the role
  const { User } = await import("../models/User.js");
  const user = await User.findById(req.user.userId).lean();
  if (!user || (user.role !== "judge" && user.role !== "admin")) {
    res.status(403).json({ error: "Judge or admin access required." });
    return;
  }

  req.user.role = user.role;
  next();
}
