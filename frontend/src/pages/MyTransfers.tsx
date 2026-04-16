/* ═══════════════════════════════════════════════════════
   MyTransfers — List user's transfers with status filter
   ═══════════════════════════════════════════════════════ */

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import LoadingSpinner from "../components/LoadingSpinner";
import TransferCard, { type TransferData } from "../components/TransferCard";
import EmptyState from "../components/EmptyState";

export default function MyTransfers() {
  const [transferId, setTransferId] = useState("");
  const [transfer, setTransfer] = useState<TransferData | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    if (!transferId.trim()) {
      showToast("Enter a transfer ID", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await api.get<{ transfer: TransferData }>(
        `/transfers/${transferId.trim()}`
      );
      setTransfer(data.transfer);
    } catch (err) {
      setTransfer(null);
      showToast(
        err instanceof ApiError ? err.message : "Failed to load transfer",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading && !transfer) {
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
              Transfer <span className="gradient-text">Lookup</span>
            </h1>
            <p>Fetch a transfer by its ID and perform buyer/NADRA actions</p>
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
              placeholder="Enter transfer ID"
            />
          </div>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Loading…" : "Open Transfer"}
          </button>
        </div>
      </form>

      {!transfer ? (
        <EmptyState
          icon="📋"
          title="No transfer loaded"
          message="Use the transfer ID returned by POST /api/transfers to view details."
        />
      ) : (
        <div className="transfers-list">
          <TransferCard key={transfer.transferId} transfer={transfer} />
        </div>
      )}
    </div>
  );
}
