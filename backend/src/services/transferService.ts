import { randomUUID } from "node:crypto";
import { ParcelModel } from "../models/Parcel.js";
import { TransferModel } from "../models/Transfer.js";
import type { EthLedgerService } from "../ledger/ethLedgerService.js";
import { isValidCnic, normalizeCnic } from "../utils/cnic.js";

/** Serializable transfer ticket for seller/buyer inspection APIs. */
export interface TransferPublicView {
  transferId: string;
  parcelId: string;
  sellerCnic: string;
  buyerCnic: string;
  status: string;
  buyerApprovedAt: string | null;
  createdAt: string;
  completedAt: string | null;
  transactionHash: string | null;
}

/**
 * Land transfer orchestration: ticket creation, buyer approval, NADRA simulation, on-chain anchoring, Mongo updates.
 */
export class TransferService {
  /**
   * @param ledger - On-chain append-only ledger.
   */
  constructor(private readonly ledger: EthLedgerService) {}

  /**
   * Opens a transfer request from the current owner to a buyer identified by CNIC.
   *
   * @param parcelId - Target parcel id.
   * @param sellerCnic - Authenticated seller CNIC (must match `currentOwnerCnic`).
   * @param buyerCnicRaw - Buyer CNIC (any format; normalized internally).
   * @returns Created transfer id and status.
   * @throws Error `PARCEL_NOT_FOUND` | `NOT_OWNER` | `DISPUTED` | `INVALID_BUYER_CNIC` | `SELF_TRANSFER`.
   */
  async createTransfer(
    parcelId: string,
    sellerCnic: string,
    buyerCnicRaw: string,
  ): Promise<{ transferId: string; status: string }> {
    const buyer = normalizeCnic(buyerCnicRaw);
    if (!isValidCnic(buyer)) {
      throw new Error("INVALID_BUYER_CNIC");
    }
    const seller = normalizeCnic(sellerCnic);
    if (seller === buyer) {
      throw new Error("SELF_TRANSFER");
    }
    const parcel = await ParcelModel.findById(parcelId);
    if (!parcel) {
      throw new Error("PARCEL_NOT_FOUND");
    }
    if (parcel.disputed) {
      throw new Error("DISPUTED");
    }
    if (parcel.currentOwnerCnic !== seller) {
      throw new Error("NOT_OWNER");
    }
    const pending = await TransferModel.findOne({ parcelId, status: "pending_nadra" });
    if (pending) {
      throw new Error("TRANSFER_ALREADY_PENDING");
    }

    const transferId = randomUUID();
    const now = new Date().toISOString();
    await TransferModel.create({
      _id: transferId,
      parcelId,
      sellerCnic: seller,
      buyerCnic: buyer,
      status: "pending_nadra",
      buyerApprovedAt: null,
      sellerNadraVerified: false,
      buyerNadraVerified: false,
      createdAt: now,
    });
    return { transferId, status: "pending_nadra" };
  }

  /**
   * Returns a pending (or terminal-state) transfer when the caller is the listed seller or buyer.
   *
   * @param transferId - Ticket id.
   * @param actorCnic - Authenticated CNIC.
   * @throws Error `TRANSFER_NOT_FOUND` | `NOT_PARTY`.
   */
  async getTransferForParty(transferId: string, actorCnic: string): Promise<TransferPublicView> {
    const actor = normalizeCnic(actorCnic);
    const t = await TransferModel.findById(transferId).lean();
    if (!t) {
      throw new Error("TRANSFER_NOT_FOUND");
    }
    if (actor !== t.sellerCnic && actor !== t.buyerCnic) {
      throw new Error("NOT_PARTY");
    }
    return toTransferPublic(t);
  }

  /**
   * Records **buyer approval** for a pending transfer. Idempotent when already approved.
   *
   * @param transferId - Ticket id.
   * @param buyerCnic - Authenticated buyer CNIC (must match ticket).
   * @throws Error `TRANSFER_NOT_FOUND` | `NOT_BUYER` | `NOT_PENDING` | `DISPUTED`.
   */
  async buyerApproveTransfer(transferId: string, buyerCnic: string): Promise<TransferPublicView> {
    const buyer = normalizeCnic(buyerCnic);
    const t = await TransferModel.findById(transferId);
    if (!t) {
      throw new Error("TRANSFER_NOT_FOUND");
    }
    if (t.status !== "pending_nadra") {
      throw new Error("NOT_PENDING");
    }
    if (buyer !== t.buyerCnic) {
      throw new Error("NOT_BUYER");
    }
    const parcel = await ParcelModel.findById(t.parcelId);
    if (!parcel) {
      throw new Error("PARCEL_NOT_FOUND");
    }
    if (parcel.disputed) {
      throw new Error("DISPUTED");
    }
    if (!t.buyerApprovedAt) {
      t.buyerApprovedAt = new Date().toISOString();
      await t.save();
    }
    const refreshed = await TransferModel.findById(transferId).lean();
    if (!refreshed) {
      throw new Error("TRANSFER_NOT_FOUND");
    }
    return toTransferPublic(refreshed);
  }

  /**
   * MVP stand-in for NADRA biometric verification.
   *
   * When `verified` is **true** (default): requires prior {@link buyerApproveTransfer}, then writes `LAND_TRANSFER`,
   * updates Mongo ownership, and completes the ticket.
   *
   * When `verified` is **false**: records `nadra_failed` without chain write or ownership change.
   *
   * @param transferId - Pending transfer identifier.
   * @param actorCnic - CNIC of the caller (must be seller or buyer on the ticket).
   * @param options - Pass `verified: false` to simulate biometric/identity failure.
   * @throws Error `TRANSFER_NOT_FOUND` | `NOT_PARTY` | `NOT_PENDING` | `DISPUTED` | `BUYER_NOT_APPROVED` | `OWNER_CHANGED`.
   */
  async simulateNadraAndComplete(
    transferId: string,
    actorCnic: string,
    options?: { verified?: boolean },
  ): Promise<{
    transferId: string;
    transactionHash: string | null;
    parcelId: string;
    newOwnerCnic: string | null;
    status: string;
  }> {
    const verified = options?.verified !== false;
    const actor = normalizeCnic(actorCnic);
    const t = await TransferModel.findById(transferId);
    if (!t) {
      throw new Error("TRANSFER_NOT_FOUND");
    }
    if (t.status !== "pending_nadra") {
      throw new Error("NOT_PENDING");
    }
    if (actor !== t.sellerCnic && actor !== t.buyerCnic) {
      throw new Error("NOT_PARTY");
    }
    if (!t.buyerApprovedAt) {
      throw new Error("BUYER_NOT_APPROVED");
    }
    const parcel = await ParcelModel.findById(t.parcelId);
    if (!parcel) {
      throw new Error("PARCEL_NOT_FOUND");
    }
    if (parcel.disputed) {
      throw new Error("DISPUTED");
    }
    if (parcel.currentOwnerCnic !== t.sellerCnic) {
      throw new Error("OWNER_CHANGED");
    }

    const now = new Date().toISOString();

    if (!verified) {
      t.status = "nadra_failed";
      t.completedAt = now;
      t.sellerNadraVerified = false;
      t.buyerNadraVerified = false;
      await t.save();
      return {
        transferId: t._id,
        transactionHash: null,
        parcelId: t.parcelId,
        newOwnerCnic: null,
        status: t.status,
      };
    }

    t.sellerNadraVerified = true;
    t.buyerNadraVerified = true;

    const ledgerResult = await this.ledger.appendLedgerEntry({
      type: "LAND_TRANSFER",
      parcelId: t.parcelId,
      sellerCnic: t.sellerCnic,
      buyerCnic: t.buyerCnic,
      transferId: t._id,
      completedAt: now,
    });

    parcel.currentOwnerCnic = t.buyerCnic;
    parcel.ownershipHistory.push({
      ownerCnic: t.buyerCnic,
      acquiredAt: now,
      transferId: t._id,
      note: "Transfer after simulated NADRA verification",
    });
    parcel.updatedAt = now;
    await parcel.save();

    t.status = "completed";
    t.completedAt = now;
    t.transactionHash = ledgerResult.transactionHash;
    await t.save();

    return {
      transferId: t._id,
      transactionHash: ledgerResult.transactionHash,
      parcelId: t.parcelId,
      newOwnerCnic: t.buyerCnic,
      status: t.status,
    };
  }
}

function toTransferPublic(t: {
  _id: string;
  parcelId: string;
  sellerCnic: string;
  buyerCnic: string;
  status: string;
  buyerApprovedAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
  transactionHash?: string | null;
}): TransferPublicView {
  return {
    transferId: t._id,
    parcelId: t.parcelId,
    sellerCnic: t.sellerCnic,
    buyerCnic: t.buyerCnic,
    status: t.status,
    buyerApprovedAt: t.buyerApprovedAt ?? null,
    createdAt: t.createdAt,
    completedAt: t.completedAt ?? null,
    transactionHash: t.transactionHash ?? null,
  };
}
