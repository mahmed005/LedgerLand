import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../auth/types.js";

/**
 * Requires `req.user.role` to be one of the allowed roles (after JWT middleware).
 *
 * @param allowed - Role names permitted for the route.
 * @returns Express middleware responding `403` when the caller’s role is not listed.
 */
export function requireRoles(...allowed: UserRole[]) {
  const set = new Set(allowed);
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role || !set.has(role)) {
      res.status(403).json({ error: "Insufficient privileges for this resource" });
      return;
    }
    next();
  };
}
