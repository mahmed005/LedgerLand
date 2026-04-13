import type { NextFunction, Request, Response } from "express";

/**
 * Ensures `req.user.role === "admin"` after JWT middleware.
 * Use on **`/api/admin/*`** routes so only Patwari-style officers can create parcels.
 *
 * @returns Express middleware responding `403` when the caller is not an admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin privileges required" });
    return;
  }
  next();
}
