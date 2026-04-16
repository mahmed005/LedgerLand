/* ═══════════════════════════════════════════════════════
   ParcelCard — Reusable parcel summary card
   ═══════════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";

export interface ParcelData {
  id: string;
  district: string;
  moza: string;
  plotNumber: string;
  khasra?: string;
  currentOwnerCnic: string;
  currentOwnerFullName?: string | null;
  disputed: boolean;
  hasFard?: boolean;
  hasRegistry?: boolean;
  hasMutation?: boolean;
}

interface Props {
  parcel: ParcelData;
}

export default function ParcelCard({ parcel }: Props) {
  return (
    <Link
      to={`/parcels/${parcel.id}`}
      className="parcel-card glass-card"
    >
      <div className="parcel-card__header">
        <h3>
          {parcel.district} / {parcel.moza}
        </h3>
        {parcel.disputed && <StatusBadge status="disputed" />}
      </div>
      <div className="parcel-card__body">
        <div className="parcel-card__field">
          <span className="parcel-card__label">Plot</span>
          <span className="parcel-card__value">{parcel.plotNumber}</span>
        </div>
        {parcel.khasra && (
          <div className="parcel-card__field">
            <span className="parcel-card__label">Khasra</span>
            <span className="parcel-card__value">{parcel.khasra}</span>
          </div>
        )}
        <div className="parcel-card__field">
          <span className="parcel-card__label">Owner CNIC</span>
          <span className="parcel-card__value">
            {parcel.currentOwnerCnic}
          </span>
        </div>
        {parcel.currentOwnerFullName && (
          <div className="parcel-card__field">
            <span className="parcel-card__label">Owner Name</span>
            <span className="parcel-card__value">
              {parcel.currentOwnerFullName}
            </span>
          </div>
        )}
      </div>
      <div className="parcel-card__footer">
        <span className="parcel-card__docs">
          {parcel.hasFard && <span className="doc-tag">Fard</span>}
          {parcel.hasRegistry && <span className="doc-tag">Registry</span>}
          {parcel.hasMutation && <span className="doc-tag">Mutation</span>}
        </span>
        <span className="parcel-card__arrow">→</span>
      </div>
    </Link>
  );
}
