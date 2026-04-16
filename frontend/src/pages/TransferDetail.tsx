/* ═══════════════════════════════════════════════════════
   TransferDetail — View + act on a single transfer
   ═══════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import LoadingSpinner from "../components/LoadingSpinner";
import StatusBadge from "../components/StatusBadge";

interface TransferData {
  transferId: string;
  parcelId: string;
  sellerCnic: string;
  buyerCnic: string;
  status: string;
  buyerApprovedAt: string | null;
  completedAt: string | null;
  transactionHash: string | null;
  createdAt: string;
}

export default function TransferDetail() {
  const { transferId } = useParams<{ transferId: string }>();
  const [transfer, setTransfer] = useState<TransferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  const { user } = useAuth();
  const { showToast } = useToast();

  const fetchTransfer = () => {
    if (!transferId) return;
    api
      .get<{ transfer: TransferData }>(`/transfers/${transferId}`)
      .then((data) => setTransfer(data.transfer))
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "Transfer not found"
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(fetchTransfer, [transferId]);

  const handleApprove = async () => {
    setActing(true);
    try {
      const data = await api.post<{
        message: string;
        transfer: TransferData;
      }>(
        `/transfers/${transferId}/buyer-approve`
      );
      showToast("Transfer approved! Awaiting NADRA verification.", "success");
      setTransfer(data.transfer);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Approval failed",
        "error"
      );
    } finally {
      setActing(false);
    }
  };

  const handleSimulateNadra = async () => {
    if (
      !confirm(
        "This will simulate NADRA biometric verification and finalize the transfer on-chain. Continue?"
      )
    )
      return;

    setActing(true);
    try {
      const data = await api.post<{
        transactionHash?: string;
        newOwnerCnic?: string;
        status?: string;
        message?: string;
      }>(`/transfers/${transferId}/simulate-nadra`);

      if (data.transactionHash) {
        showToast(
          "Transfer completed! Ownership recorded on blockchain.",
          "success"
        );
        setTransfer((prev) =>
          prev
            ? {
                ...prev,
                status: "completed",
                transactionHash: data.transactionHash ?? null,
              }
            : prev
        );
      } else {
        showToast(data.message || "Transfer status updated", "info");
        fetchTransfer(); // reload to get latest
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Verification failed",
        "error"
      );
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="page-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !transfer) {
    return (
      <div className="page-center">
        <div className="empty-state">
          <div className="empty-state__icon">❌</div>
          <h2>{error || "Transfer not found"}</h2>
          <Link to="/transfers" className="btn btn--primary">
            Back to Transfers
          </Link>
        </div>
      </div>
    );
  }

  const isBuyer = user?.cnic === transfer.buyerCnic;
  const isSeller = user?.cnic === transfer.sellerCnic;
  const canApprove =
    isBuyer && transfer.status === "pending_nadra" && !transfer.buyerApprovedAt;
  const canNadra =
    (isBuyer || isSeller) && transfer.status === "pending_nadra" && !!transfer.buyerApprovedAt;

  const steps = ["buyer_approval", "nadra_verification", "completed"] as const;
  const currentIdx =
    transfer.status === "completed"
      ? 2
      : transfer.status === "nadra_failed"
        ? 1
        : transfer.buyerApprovedAt
          ? 1
          : 0;

  return (
    <div className="transfer-detail">
      <div className="page-header">
        <h1>
          Transfer <span className="gradient-text">Details</span>
        </h1>
      </div>

      {/* ── Status Timeline ── */}
      <div className="transfer-timeline glass-card">
        {steps.map((step, i) => {
          const isFailed = transfer.status === "nadra_failed";
          const isActive = i <= currentIdx && !(isFailed && i === 2);
          const isCurrent = i === currentIdx;

          return (
            <div
              key={step}
              className={`timeline-step${isActive ? " timeline-step--active" : ""}${isCurrent ? " timeline-step--current" : ""}`}
            >
              <div className="timeline-step__dot">
                {isActive ? "✓" : i + 1}
              </div>
              <span className="timeline-step__label">
                {step === "buyer_approval" && "Buyer Approval"}
                {step === "nadra_verification" && "NADRA Verification"}
                {step === "completed" && "On-Chain"}
              </span>
              {i < 2 && <div className="timeline-step__line" />}
            </div>
          );
        })}
        {transfer.status === "nadra_failed" && (
          <div className="timeline-step timeline-step--rejected timeline-step--current">
            <div className="timeline-step__dot">✕</div>
            <span className="timeline-step__label">NADRA Failed</span>
          </div>
        )}
      </div>

      {/* ── Details ── */}
      <div className="detail-grid">
        <div className="detail-card glass-card">
          <h2>Transfer Info</h2>
          <div className="detail-card__fields">
            <div className="detail-card__field">
              <span className="detail-card__label">Status</span>
              <StatusBadge status={transfer.status} />
            </div>
            <div className="detail-card__field">
              <span className="detail-card__label">Seller CNIC</span>
              <span className="detail-card__value mono">
                {transfer.sellerCnic}
              </span>
            </div>
            <div className="detail-card__field">
              <span className="detail-card__label">Buyer CNIC</span>
              <span className="detail-card__value mono">
                {transfer.buyerCnic}
              </span>
            </div>
            <div className="detail-card__field">
              <span className="detail-card__label">Created</span>
              <span className="detail-card__value">
                {new Date(transfer.createdAt).toLocaleString("en-PK")}
              </span>
            </div>
            {transfer.transactionHash && (
              <div className="detail-card__field">
                <span className="detail-card__label">TX Hash</span>
                <span className="detail-card__value mono" style={{ fontSize: 12 }}>
                  {transfer.transactionHash}
                </span>
              </div>
            )}
          </div>

          <div className="detail-card__field" style={{ marginTop: 8 }}>
            <Link to={`/parcels/${transfer.parcelId}`} className="btn btn--ghost">
              View Parcel →
            </Link>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="detail-card glass-card">
          <h2>Actions</h2>
          {canApprove && (
            <div className="action-section">
              <p>
                As the buyer, you can approve this transfer to proceed to NADRA
                verification.
              </p>
              <button
                className="btn btn--primary btn--full"
                onClick={handleApprove}
                disabled={acting}
              >
                {acting ? "Approving…" : "✓ Approve Transfer"}
              </button>
            </div>
          )}

          {canNadra && (
            <div className="action-section">
              <p>
                The transfer is approved. Simulate NADRA biometric verification
                to finalize the transfer on-chain.
              </p>
              <button
                className="btn btn--primary btn--full"
                onClick={handleSimulateNadra}
                disabled={acting}
              >
                {acting ? "Verifying…" : "🔐 Verify with NADRA"}
              </button>
            </div>
          )}

          {transfer.status === "completed" && (
            <div className="action-section">
              <div className="success-banner">
                <span>✓</span> Transfer completed and recorded on blockchain
              </div>
            </div>
          )}

          {transfer.status === "nadra_failed" && (
            <div className="action-section">
              <div className="error-banner">
                <span>✕</span> Transfer failed during NADRA verification
              </div>
            </div>
          )}

          {!canApprove && !canNadra && transfer.status !== "completed" && transfer.status !== "nadra_failed" && (
            <p className="text-muted">No actions available for your role.</p>
          )}
        </div>
      </div>
    </div>
  );
}
