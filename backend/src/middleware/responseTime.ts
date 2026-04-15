import { Request, Response, NextFunction } from "express";

/**
 * Middleware — measures and exposes response time via the X-Response-Time header.
 * KAN-25: Performance observability.
 *
 * We intercept res.end() so we can set the header BEFORE the response is
 * flushed to the client (res.on("finish") fires after headers are sent,
 * which causes "Cannot set headers after they are sent to the client").
 */
export function responseTime(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  // Capture the original res.end so we can wrap it
  const originalEnd = res.end.bind(res) as typeof res.end;

  // Override res.end to inject the timing header before the response is sent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).end = function (...args: Parameters<typeof res.end>) {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationMs = (durationNs / 1e6).toFixed(2);

    // Only set the header if it hasn't been sent yet
    if (!res.headersSent) {
      res.setHeader("X-Response-Time", `${durationMs}ms`);
    }

    // Log slow requests (> 3000ms threshold from KAN-25)
    if (parseFloat(durationMs) > 3000) {
      console.warn(
        `[perf] SLOW ${req.method} ${req.originalUrl} — ${durationMs}ms`
      );
    }

    return originalEnd(...args);
  };

  next();
}
