import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import parcelRoutes from "./routes/parcelRoutes.js";
import transferRoutes from "./routes/transferRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import blockchainRoutes from "./routes/blockchainRoutes.js";
import { responseTime } from "./middleware/responseTime.js";

const app = express();

// ── Global middleware ────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(responseTime);  // KAN-25: Performance observability

// ── Health check ─────────────────────────────────────
/**
 * GET /health
 * Liveness probe — does not touch DB or chain.
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── API routes ───────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/parcels", parcelRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/blockchain", blockchainRoutes);

export default app;
