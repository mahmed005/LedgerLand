import type { IUserRepository } from "../auth/userRepository.js";

export interface TransferInitiatedNotice {
  sellerCnic: string;
  transferId: string;
  parcelId: string;
  buyerCnic: string;
}

/**
 * Best-effort owner notifications when domain events occur (email when configured on the user).
 *
 * When the seller has no email, a structured log line is emitted so operators can wire SMS/webhooks later.
 */
export class NotificationService {
  /**
   * @param users - Repository used to load the seller profile (for optional email).
   */
  constructor(private readonly users: IUserRepository) {}

  /**
   * Notifies the **seller** that a transfer ticket was opened for their parcel.
   *
   * @param notice - Identifiers for the new transfer.
   */
  async notifySellerTransferInitiated(notice: TransferInitiatedNotice): Promise<void> {
    const seller = await this.users.findByCnic(notice.sellerCnic);
    const lines = [
      "[LedgerLand] Transfer initiated",
      `transferId=${notice.transferId}`,
      `parcelId=${notice.parcelId}`,
      `buyerCnic=${notice.buyerCnic}`,
    ];
    if (seller?.email) {
      lines.push(`notifyEmail=${seller.email}`);
    } else {
      lines.push("notifyEmail=(none — seller account has no email on file)");
    }
    console.info(lines.join(" "));
  }
}
