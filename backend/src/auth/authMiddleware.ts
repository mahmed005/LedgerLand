import type { NextFunction, Request, Response } from "express";
import type { AuthService } from "./authService.js";
import type { PublicUser } from "./types.js";

declare module "express-serve-static-core" {
  interface Request {
    /** Set by {@link createAuthMiddleware} after a valid JWT is presented. */
    user?: PublicUser;
  }
}

/**
 * Builds Express middleware that requires `Authorization: Bearer <jwt>`.
 * Used for **`/api/auth/me`**, **`/api/transfers/*`**, **`/api/admin/*`**, and **`POST /api/blockchain/blocks`**.
 *
 * @param auth - Service used to verify tokens.
 * @returns Async middleware populating `req.user` or responding `401`.
 */
export function createAuthMiddleware(auth: AuthService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }
    const token = header.slice("Bearer ".length).trim();
    try {
      req.user = await auth.verifyAccessToken(token);
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

/**
 * Parses `Authorization: Bearer` when present and sets `req.user`; continues without error if the header is missing or invalid.
 * Used for **RBAC-aware** public routes (e.g. parcel search) where anonymous access is allowed but with redacted fields.
 *
 * @param auth - Service used to verify tokens.
 */
export function createOptionalAuthMiddleware(auth: AuthService) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      next();
      return;
    }
    const token = header.slice("Bearer ".length).trim();
    try {
      req.user = await auth.verifyAccessToken(token);
    } catch {
      req.user = undefined;
    }
    next();
  };
}
