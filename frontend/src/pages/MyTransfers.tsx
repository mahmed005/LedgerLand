/* ═══════════════════════════════════════════════════════
   MyTransfers — Auto list current user's transfers
   ═══════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import LoadingSpinner from "../components/LoadingSpinner";
import TransferCard, { type TransferData } from "../components/TransferCard";
import EmptyState from "../components/EmptyState";

export default function MyTransfers() {
  const [transferId, setTransferId] = useState("");
  const [transfers, setTransfers] = useState<TransferData[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.get<{ transfers: TransferData[] }>("/transfers/my");
        setTransfers(data.transfers);
      } catch (err) {
        showToast(
          err instanceof ApiError ? err.message : "Failed to load your transfers",
          "error"
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [showToast]);

  const filteredTransfers = useMemo(() => {
    const q = transferId.trim();
    if (!q) return transfers;
    return transfers.filter((t) => t.transferId.includes(q));
  }, [transfers, transferId]);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    // Local filter submit only; data auto-loads from /transfers/my.
  };

  if (loading) {
    return (
      <div className="page-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="transfers-page">
      <div className="page-header">
        <div className="page-header__row">
          <div>
            <h1>
              My <span className="gradient-text">Transfers</span>
            </h1>
            <p>All transfers linked to your account are shown automatically</p>
          </div>
          <Link to="/transfers/new" className="btn btn--primary">
            + New Transfer
          </Link>
        </div>
      </div>

      <form onSubmit={handleLookup} className="search-form glass-card">
        <div className="search-form__fields search-form__fields--inline">
          <div className="form-group" style={{ flex: 1 }}>
            <input
              type="text"
              className="form-input"
              value={transferId}
              onChange={(e) => setTransferId(e.target.value)}
              placeholder="Filter by transfer ID (optional)"
            />
          </div>
          <button type="submit" className="btn btn--primary">
            Filter
          </button>
        </div>
      </form>

      {filteredTransfers.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No transfers found"
          message={
            transferId.trim()
              ? "No transfer matches this ID filter."
              : "No transfers are linked to your account yet."
          }
        />
      ) : (
        <div className="transfers-list">
          {filteredTransfers.map((transfer) => (
            <TransferCard key={transfer.transferId} transfer={transfer} />
          ))}
        </div>
      )}
    </div>
  );
}
