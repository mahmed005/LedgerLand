/* ═══════════════════════════════════════════════════════
   InitiateTransfer — Start a new property transfer
   ═══════════════════════════════════════════════════════ */

import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import CnicInput from "../components/CnicInput";

export default function InitiateTransfer() {
  const [params] = useSearchParams();
  const [parcelId, setParcelId] = useState(params.get("parcelId") || "");
  const [buyerCnic, setBuyerCnic] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!parcelId.trim()) {
      showToast("Please enter a Parcel ID", "error");
      return;
    }
    if (buyerCnic.length !== 13) {
      showToast("Buyer CNIC must be 13 digits", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await api.post<{ transferId: string; status: string }>(
        "/transfers",
        { parcelId: parcelId.trim(), buyerCnic }
      );
      showToast("Transfer initiated successfully!", "success");
      navigate(`/transfers/${data.transferId}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to initiate transfer";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page">
      <div className="page-header">
        <h1>
          Initiate <span className="gradient-text">Transfer</span>
        </h1>
        <p>Start a property ownership transfer to a buyer</p>
      </div>

      <form onSubmit={handleSubmit} className="form-card glass-card">
        <div className="form-group">
          <label htmlFor="transfer-parcel">Parcel ID</label>
          <input
            type="text"
            id="transfer-parcel"
            className="form-input"
            value={parcelId}
            onChange={(e) => setParcelId(e.target.value)}
            placeholder="Enter the parcel ID"
            required
          />
          <span className="form-hint">
            You can find this on the parcel detail page
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="transfer-buyer">Buyer CNIC</label>
          <CnicInput
            value={buyerCnic}
            onChange={setBuyerCnic}
            id="transfer-buyer"
            required
          />
          <span className="form-hint">
            The buyer's 13-digit national ID number
          </span>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
          >
            {loading ? "Processing…" : "Initiate Transfer"}
          </button>
        </div>

        <div className="form-info">
          <p>
            <strong>What happens next?</strong>
          </p>
          <ol>
            <li>The buyer will see the transfer and can approve it</li>
            <li>After approval, NADRA biometric verification is simulated</li>
            <li>
              On success, ownership is recorded permanently on the blockchain
            </li>
          </ol>
        </div>
      </form>
    </div>
  );
}
