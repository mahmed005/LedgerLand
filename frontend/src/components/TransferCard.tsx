/* ═══════════════════════════════════════════════════════
   TransferCard — Reusable transfer summary card
   ═══════════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";

export interface TransferData {
  _id: string;
  parcelId: string;
  sellerCnic: string;
  buyerCnic: string;
  status: string;
  createdAt: string;
}

interface Props {
  transfer: TransferData;
}

export default function TransferCard({ transfer }: Props) {
  return (
    <Link
      to={`/transfers/${transfer._id}`}
      className="transfer-row glass-card"
    >
      <div className="transfer-row__main">
        <div className="transfer-row__parties">
          <span className="mono">{transfer.sellerCnic}</span>
          <span className="transfer-row__arrow">→</span>
          <span className="mono">{transfer.buyerCnic}</span>
        </div>
        <div className="transfer-row__meta">
          <span>
            {new Date(transfer.createdAt).toLocaleDateString("en-PK")}
          </span>
        </div>
      </div>
      <StatusBadge status={transfer.status} />
    </Link>
  );
}
