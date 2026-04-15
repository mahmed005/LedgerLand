import { Transfer } from "../models/Transfer.js";
import { Parcel } from "../models/Parcel.js";
import { User } from "../models/User.js";
import { normalizeCnic, isValidCnic } from "../utils/cnic.js";
import * as ethLedger from "./ethLedgerService.js";
import * as notificationService from "./notificationService.js";
import * as auditService from "./auditService.js";

/**
 * Initiate a land transfer — seller (logged-in user) opens a ticket.
 * Status starts as "pending_buyer" — requires buyer approval first (KAN-7).
 * Triggers notification to the land owner (KAN-22).
 * @returns `{ transferId, status }`
 */
export async function initiateTransfer(
  sellerUserId: string,
  parcelId: string,
  buyerCnic: string
) {
  const normalizedBuyer = normalizeCnic(buyerCnic);
  if (!isValidCnic(normalizedBuyer)) {
    throw { status: 400, error: "Buyer CNIC must be 13 digits." };
  }

  // Look up seller
  const seller = await User.findById(sellerUserId);
  if (!seller) {
    throw { status: 401, error: "Seller not found." };
  }

  // Look up parcel
  const parcel = await Parcel.findById(parcelId);
  if (!parcel) {
    throw { status: 404, error: "Parcel not found." };
  }

  // Seller must be current owner
  if (parcel.currentOwnerCnic !== seller.cnic) {
    throw { status: 403, error: "You are not the current owner of this parcel." };
  }

  // Cannot transfer disputed parcel
  if (parcel.disputed) {
    throw { status: 400, error: "Cannot transfer a disputed parcel." };
  }

  // Buyer cannot be seller
  if (normalizedBuyer === seller.cnic) {
    throw { status: 400, error: "Buyer cannot be the same as seller." };
  }

  // Check for existing pending transfer on this parcel
  const pendingExists = await Transfer.findOne({
    parcelId,
    status: { $in: ["pending_buyer", "pending_nadra"] },
  });
  if (pendingExists) {
    throw { status: 400, error: "A pending transfer already exists for this parcel." };
  }

  const transfer = await Transfer.create({
    parcelId,
    sellerCnic: seller.cnic,
    buyerCnic: normalizedBuyer,
    status: "pending_buyer",
  });

  // KAN-22: Notify the land owner
  notificationService
    .notifyOwnerOnTransferInitiated(
      seller.email,
      seller.fullName,
      parcelId,
      normalizedBuyer
    )
    .catch((err) =>
      console.error("[transfer] Notification failed (non-blocking):", err)
    );

  // KAN-24: Audit log
  await auditService.logAction(
    "TRANSFER_INITIATE",
    sellerUserId,
    seller.cnic,
    "transfer",
    String(transfer._id),
    { parcelId, buyerCnic: normalizedBuyer }
  );

  return {
    transferId: transfer._id,
    status: transfer.status,
  };
}

/**
 * Get a single transfer by ID (KAN-7).
 * Only the seller or buyer (or admin) can view.
 */
export async function getTransferById(transferId: string, actorUserId: string) {
  const transfer = await Transfer.findById(transferId);
  if (!transfer) {
    throw { status: 404, error: "Transfer not found." };
  }

  // Verify the actor is seller, buyer, or admin
  const actor = await User.findById(actorUserId);
  if (!actor) {
    throw { status: 401, error: "User not found." };
  }
  if (
    actor.cnic !== transfer.sellerCnic &&
    actor.cnic !== transfer.buyerCnic &&
    actor.role !== "admin"
  ) {
    throw { status: 403, error: "You are not a party to this transfer." };
  }

  return transfer.toJSON();
}

/**
 * Get all transfers where the user is seller or buyer (KAN-7).
 */
export async function getTransfersByUser(actorUserId: string) {
  const actor = await User.findById(actorUserId);
  if (!actor) {
    throw { status: 401, error: "User not found." };
  }

  const transfers = await Transfer.find({
    $or: [{ sellerCnic: actor.cnic }, { buyerCnic: actor.cnic }],
  })
    .sort({ createdAt: -1 })
    .lean();

  return transfers;
}

/**
 * Buyer approves the transfer (KAN-7).
 * Moves status from "pending_buyer" → "pending_nadra".
 */
export async function buyerApproveTransfer(
  transferId: string,
  buyerUserId: string
) {
  const transfer = await Transfer.findById(transferId);
  if (!transfer) {
    throw { status: 404, error: "Transfer not found." };
  }

  if (transfer.status !== "pending_buyer") {
    throw {
      status: 400,
      error: "Transfer is not awaiting buyer approval.",
    };
  }

  // Only the buyer can approve
  const buyer = await User.findById(buyerUserId);
  if (!buyer) {
    throw { status: 401, error: "User not found." };
  }
  if (buyer.cnic !== transfer.buyerCnic) {
    throw { status: 403, error: "Only the buyer may approve this transfer." };
  }

  transfer.status = "pending_nadra";
  await transfer.save();

  // KAN-24: Audit log
  await auditService.logAction(
    "TRANSFER_APPROVE",
    buyerUserId,
    buyer.cnic,
    "transfer",
    String(transfer._id),
    { parcelId: transfer.parcelId }
  );

  return {
    message: "Transfer approved by buyer. Ready for NADRA verification.",
    transferId: transfer._id,
    status: transfer.status,
  };
}

/**
 * Simulate NADRA biometric verification and finalize the transfer.
 * - KAN-8: Supports a failure path — if `simulateFailure` is true, the transfer is rejected.
 * - Writes LAND_TRANSFER to the on-chain ledger
 * - Updates Parcel: currentOwnerCnic, ownershipHistory
 * - Marks Transfer completed with txHash
 */
export async function simulateNadra(
  transferId: string,
  actorUserId: string,
  simulateFailure = false
) {
  const transfer = await Transfer.findById(transferId);
  if (!transfer) {
    throw { status: 404, error: "Transfer not found." };
  }
  if (transfer.status !== "pending_nadra") {
    throw { status: 400, error: "Transfer is not in pending_nadra state." };
  }

  // Actor must be seller or buyer
  const actor = await User.findById(actorUserId);
  if (!actor) {
    throw { status: 401, error: "User not found." };
  }
  if (actor.cnic !== transfer.sellerCnic && actor.cnic !== transfer.buyerCnic) {
    throw { status: 403, error: "Only the seller or buyer may verify this transfer." };
  }

  // KAN-8: NADRA failure path — identity mismatch simulation
  if (simulateFailure) {
    transfer.status = "rejected";
    await transfer.save();

    await auditService.logAction(
      "TRANSFER_REJECT",
      actorUserId,
      actor.cnic,
      "transfer",
      String(transfer._id),
      { reason: "NADRA verification failed (simulated)" }
    );

    return {
      message: "NADRA verification failed. Transfer rejected.",
      transferId: transfer._id,
      status: "rejected",
    };
  }

  // Build on-chain payload
  const chainPayload = {
    type: "LAND_TRANSFER",
    transferId: transfer._id,
    parcelId: transfer.parcelId,
    sellerCnic: transfer.sellerCnic,
    buyerCnic: transfer.buyerCnic,
    verifiedBy: actor.cnic,
    timestamp: new Date().toISOString(),
  };

  // Write to blockchain
  const { transactionHash } = await ethLedger.addRecord(chainPayload);

  // Update parcel
  const parcel = await Parcel.findById(transfer.parcelId);
  if (parcel) {
    parcel.currentOwnerCnic = transfer.buyerCnic;
    parcel.ownershipHistory.push({
      ownerCnic: transfer.buyerCnic,
      acquiredAt: new Date(),
      transferId: String(transfer._id),
      note: `Transfer from ${transfer.sellerCnic}`,
    });
    await parcel.save();
  }

  // Mark transfer completed
  transfer.status = "completed";
  transfer.transactionHash = transactionHash;
  await transfer.save();

  // KAN-24: Audit log
  await auditService.logAction(
    "TRANSFER_COMPLETE",
    actorUserId,
    actor.cnic,
    "transfer",
    String(transfer._id),
    { parcelId: transfer.parcelId, transactionHash }
  );

  return {
    message: "NADRA verification simulated and transfer completed.",
    transferId: transfer._id,
    transactionHash,
    parcelId: transfer.parcelId,
    newOwnerCnic: transfer.buyerCnic,
  };
}
