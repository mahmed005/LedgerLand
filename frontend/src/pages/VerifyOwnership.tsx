/* ═══════════════════════════════════════════════════════
   VerifyOwnership — Citizen-friendly ownership verification
   Instead of raw blockchain data, show a simple form where
   citizens can enter a parcel ID or CNIC and get a 
   human-readable ownership certificate / verification result.
   ═══════════════════════════════════════════════════════ */

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import LoadingSpinner from "../components/LoadingSpinner";
import StatusBadge from "../components/StatusBadge";

interface VerifyResult {
  verified: boolean;
  parcel?: {
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
  };
  message?: string;
}

export default function VerifyOwnership() {
  const [parcelId, setParcelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VerifyResult[] | null>(null);
  const { showToast } = useToast();

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResults(null);

    try {
      if (!parcelId.trim()) {
        showToast("Please enter a parcel ID", "error");
        setLoading(false);
        return;
      }

      const data = await api.get<{ parcel: VerifyResult["parcel"] }>(
        `/parcels/${encodeURIComponent(parcelId.trim())}`
      );
      setResults([
        {
          verified: true,
          parcel: data.parcel,
        },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setResults([{ verified: false, message: "No record found for this parcel ID." }]);
        } else {
          showToast(err.message, "error");
        }
      } else {
        showToast("Verification failed", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="public-page">
    <div className="verify-page">
      <div className="page-header">
        <h1>
          Verify <span className="gradient-text">Ownership</span>
        </h1>
        <p>Enter parcel ID to directly view current ownership details</p>
      </div>

      {/* ── Search Form ── */}
      <form onSubmit={handleVerify} className="verify-form glass-card">
        <div className="form-group">
          <label htmlFor="verify-parcel-id">Parcel ID</label>
          <input
            type="text"
            id="verify-parcel-id"
            className="form-input"
            value={parcelId}
            onChange={(e) => setParcelId(e.target.value)}
            placeholder="Enter parcel ID"
            required
          />
          <span className="form-hint">Ownership details are shown directly for this parcel</span>
        </div>
        <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
          {loading ? "Verifying…" : "🔍 Verify Ownership"}
        </button>
      </form>

      {/* ── Loading ── */}
      {loading && (
        <div className="page-center" style={{ marginTop: 32 }}>
          <LoadingSpinner />
        </div>
      )}

      {/* ── Results ── */}
      {results && !loading && (
        <div className="verify-results">
          {results.map((r, i) =>
            r.verified && r.parcel ? (
              <div key={i} className="verify-card glass-card verify-card--success">
                <div className="verify-card__header">
                  <div className="verify-card__badge verify-card__badge--success">
                    ✓ Ownership Verified
                  </div>
                  {r.parcel.disputed && <StatusBadge status="disputed" />}
                </div>

                <div className="verify-card__details">
                  <div className="verify-card__row">
                    <span className="verify-card__label">📍 Location</span>
                    <span className="verify-card__value">
                      {r.parcel.district}, {r.parcel.moza}
                    </span>
                  </div>
                  <div className="verify-card__row">
                    <span className="verify-card__label">🏠 Plot Number</span>
                    <span className="verify-card__value">{r.parcel.plotNumber}</span>
                  </div>
                  {r.parcel.khasra && (
                    <div className="verify-card__row">
                      <span className="verify-card__label">📋 Khasra</span>
                      <span className="verify-card__value">{r.parcel.khasra}</span>
                    </div>
                  )}
                  <div className="verify-card__row">
                    <span className="verify-card__label">👤 Current Owner</span>
                    <span className="verify-card__value">
                      {r.parcel.currentOwnerFullName || r.parcel.currentOwnerCnic}
                    </span>
                  </div>
                  <div className="verify-card__row">
                    <span className="verify-card__label">📄 Documents</span>
                    <span className="verify-card__value verify-card__docs">
                      {r.parcel.hasFard && <span className="doc-tag">Fard</span>}
                      {r.parcel.hasRegistry && <span className="doc-tag">Registry</span>}
                      {r.parcel.hasMutation && <span className="doc-tag">Mutation</span>}
                      {!r.parcel.hasFard && !r.parcel.hasRegistry && !r.parcel.hasMutation && (
                        <span className="text-muted">None on file</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="verify-card__footer">
                  <Link to={`/parcels/${r.parcel.id}`} className="btn btn--primary">
                    View Full Details & Documents
                  </Link>
                </div>

                {r.parcel.disputed && (
                  <div className="verify-card__warning">
                    ⚠️ This property is currently flagged as <strong>disputed</strong>. 
                    Please consult with the relevant authorities before proceeding with any transaction.
                  </div>
                )}
              </div>
            ) : (
              <div key={i} className="verify-card glass-card verify-card--fail">
                <div className="verify-card__header">
                  <div className="verify-card__badge verify-card__badge--fail">
                    ✕ Not Found
                  </div>
                </div>
                <p className="verify-card__message">
                  {r.message || "No property records found matching your search criteria."}
                </p>
                <p className="verify-card__hint">
                  Make sure you've entered the correct CNIC or property details. 
                  If you believe this is an error, please contact your local land registry office.
                </p>
              </div>
            )
          )}
        </div>
      )}

      {/* ── How it works ── */}
      <div className="verify-info glass-card">
        <h3>🔐 How Verification Works</h3>
        <div className="verify-info__steps">
          <div className="verify-info__step">
            <span className="verify-info__num">1</span>
            <p>Enter the parcel ID</p>
          </div>
          <div className="verify-info__step">
            <span className="verify-info__num">2</span>
            <p>Our system loads the registered ownership record</p>
          </div>
          <div className="verify-info__step">
            <span className="verify-info__num">3</span>
            <p>All ownership records are secured on the blockchain, ensuring tamper-proof verification</p>
          </div>
        </div>
      </div>
    </div>
    </div>
    </>
  );
}
