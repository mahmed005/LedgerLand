import { randomUUID } from "node:crypto";
import { ParcelModel } from "../models/Parcel.js";
import { TransferModel } from "../models/Transfer.js";
import type { EthLedgerService } from "../ledger/ethLedgerService.js";
import { isValidCnic, normalizeCnic } from "../utils/cnic.js";

/**
 * Land transfer orchestration: ticket creation, NADRA simulation, on-chain anchoring, Mongo updates.
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
      sellerNadraVerified: false,
      buyerNadraVerified: false,
      createdAt: now,
    });
    return { transferId, status: "pending_nadra" };
  }

  /**
   * MVP stand-in for NADRA biometric verification: marks both parties verified, finalizes ownership,
   * appends an immutable record on-chain, and stores the transaction hash on the transfer ticket.
   *
   * @param transferId - Pending transfer identifier.
   * @param actorCnic - CNIC of the caller (must be seller or buyer on the ticket).
   * @throws Error `TRANSFER_NOT_FOUND` | `NOT_PARTY` | `NOT_PENDING` | `DISPUTED`.
   */
  async simulateNadraAndComplete(transferId: string, actorCnic: string): Promise<{
    transferId: string;
    transactionHash: string;
    parcelId: string;
    newOwnerCnic: string;
  }> {
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

    const completedAt = new Date().toISOString();
    t.sellerNadraVerified = true;
    t.buyerNadraVerified = true;

    const ledgerResult = await this.ledger.appendLedgerEntry({
      type: "LAND_TRANSFER",
      parcelId: t.parcelId,
      sellerCnic: t.sellerCnic,
      buyerCnic: t.buyerCnic,
      transferId: t._id,
      completedAt,
    });

    parcel.currentOwnerCnic = t.buyerCnic;
    parcel.ownershipHistory.push({
      ownerCnic: t.buyerCnic,
      acquiredAt: completedAt,
      transferId: t._id,
      note: "Transfer after simulated NADRA verification",
    });
    parcel.updatedAt = completedAt;
    await parcel.save();

    t.status = "completed";
    t.completedAt = completedAt;
    t.transactionHash = ledgerResult.transactionHash;
    await t.save();

    return {
      transferId: t._id,
      transactionHash: ledgerResult.transactionHash,
      parcelId: t.parcelId,
      newOwnerCnic: t.buyerCnic,
    };
  }
}
