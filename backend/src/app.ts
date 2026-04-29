import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

type Role = "admin" | "seller" | "buyer";

interface User {
  cnic: string;
  password: string;
  role: Role;
}

interface Parcel {
  id: string;
  plotNumber: string;
  ownerCnic: string;
  disputed: boolean;
}

interface Transfer {
  id: string;
  parcelId: string;
  sellerCnic: string;
  buyerCnic: string;
  buyerApproved: boolean;
  completed: boolean;
}

const users = new Map<string, User>();
const tokens = new Map<string, User>();
const parcels = new Map<string, Parcel>();
const transfers = new Map<string, Transfer>();

function getBearerToken(req: Request): string | null {
  const value = req.header("authorization");
  if (!value) return null;
  const [scheme, token] = value.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

function requireAuth(req: Request, res: Response): User | null {
  const token = getBearerToken(req);
  if (!token || !tokens.has(token)) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return null;
  }
  return tokens.get(token)!;
}

function requireRole(req: Request, res: Response, role: Role): User | null {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== role) {
    res.status(403).json({ error: "FORBIDDEN" });
    return null;
  }
  return user;
}

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/auth/signup", (req, res) => {
    const { cnic, password, role } = req.body as Partial<User>;
    if (!cnic || !password || !role) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    if (users.has(cnic)) {
      return res.status(409).json({ error: "CNIC_IN_USE" });
    }
    users.set(cnic, { cnic, password, role });
    return res.status(201).json({ cnic, role });
  });

  app.post("/api/auth/login", (req, res) => {
    const { cnic, password } = req.body as Partial<User>;
    if (!cnic || !password) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    const user = users.get(cnic);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }
    const token = randomUUID();
    tokens.set(token, user);
    return res.status(200).json({ token, user: { cnic: user.cnic, role: user.role } });
  });

  app.post("/api/admin/parcels", (req, res) => {
    if (!requireRole(req, res, "admin")) return;
    const { plotNumber, ownerCnic, disputed } = req.body as Partial<Parcel>;
    if (!plotNumber || !ownerCnic) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    const parcel: Parcel = {
      id: randomUUID(),
      plotNumber,
      ownerCnic,
      disputed: disputed ?? false,
    };
    parcels.set(parcel.id, parcel);
    return res.status(201).json({ parcel });
  });

  app.patch("/api/admin/parcels/:id", (req, res) => {
    if (!requireRole(req, res, "admin")) return;
    const parcel = parcels.get(req.params.id);
    if (!parcel) return res.status(404).json({ error: "PARCEL_NOT_FOUND" });
    if (typeof req.body.disputed === "boolean") {
      parcel.disputed = req.body.disputed;
    }
    return res.status(200).json({ parcel });
  });

  app.get("/api/parcels/:id", (req, res) => {
    const parcel = parcels.get(req.params.id);
    if (!parcel) return res.status(404).json({ error: "PARCEL_NOT_FOUND" });
    return res.status(200).json({ parcel });
  });

  app.post("/api/transfers", (req, res) => {
    const seller = requireRole(req, res, "seller");
    if (!seller) return;
    const { parcelId, buyerCnic } = req.body as { parcelId?: string; buyerCnic?: string };
    if (!parcelId || !buyerCnic) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    const parcel = parcels.get(parcelId);
    if (!parcel) return res.status(404).json({ error: "PARCEL_NOT_FOUND" });
    if (parcel.ownerCnic !== seller.cnic) {
      return res.status(403).json({ error: "NOT_PARCEL_OWNER" });
    }
    if (parcel.disputed) {
      return res.status(409).json({ error: "PARCEL_DISPUTED" });
    }
    const transfer: Transfer = {
      id: randomUUID(),
      parcelId: parcel.id,
      sellerCnic: seller.cnic,
      buyerCnic,
      buyerApproved: false,
      completed: false,
    };
    transfers.set(transfer.id, transfer);
    return res.status(201).json({ transfer });
  });

  app.get("/api/transfers/:id", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const transfer = transfers.get(req.params.id);
    if (!transfer) return res.status(404).json({ error: "TRANSFER_NOT_FOUND" });
    if (user.cnic !== transfer.sellerCnic && user.cnic !== transfer.buyerCnic) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    return res.status(200).json({ transfer });
  });

  app.post("/api/transfers/:id/buyer-approve", (req, res) => {
    const buyer = requireRole(req, res, "buyer");
    if (!buyer) return;
    const transfer = transfers.get(req.params.id);
    if (!transfer) return res.status(404).json({ error: "TRANSFER_NOT_FOUND" });
    if (transfer.buyerCnic !== buyer.cnic) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    transfer.buyerApproved = true;
    return res.status(200).json({ transfer });
  });

  app.post("/api/transfers/:id/complete", (req, res) => {
    const seller = requireRole(req, res, "seller");
    if (!seller) return;
    const transfer = transfers.get(req.params.id);
    if (!transfer) return res.status(404).json({ error: "TRANSFER_NOT_FOUND" });
    if (transfer.sellerCnic !== seller.cnic) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    if (!transfer.buyerApproved) {
      return res.status(409).json({ error: "BUYER_APPROVAL_REQUIRED" });
    }
    const parcel = parcels.get(transfer.parcelId);
    if (!parcel) return res.status(404).json({ error: "PARCEL_NOT_FOUND" });
    parcel.ownerCnic = transfer.buyerCnic;
    transfer.completed = true;
    return res.status(200).json({ transfer, parcel });
  });

  return app;
}
