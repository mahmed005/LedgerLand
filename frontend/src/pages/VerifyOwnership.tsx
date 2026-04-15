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
import CnicInput from "../components/CnicInput";
import Navbar from "../components/Navbar";
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
    currentOwnerName?: string;
    disputed: boolean;
    hasFard?: boolean;
    hasRegistry?: boolean;
  };
  message?: string;
}

export default function VerifyOwnership() {
  const [mode, setMode] = useState<"parcel" | "cnic">("cnic");
  const [cnic, setCnic] = useState("");
  const [district, setDistrict] = useState("");
  const [plotNumber, setPlotNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VerifyResult[] | null>(null);
  const { showToast } = useToast();

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResults(null);

    try {
      let query = "";
      if (mode === "cnic") {
        if (cnic.length !== 13) {
          showToast("Please enter a valid 13-digit CNIC", "error");
          setLoading(false);
          return;
        }
        query = `ownerCnic=${cnic}`;
      } else {
        if (!district.trim() || !plotNumber.trim()) {
          showToast("Please enter both district and plot number", "error");
          setLoading(false);
          return;
        }
        query = `district=${encodeURIComponent(district.trim())}&plotNumber=${encodeURIComponent(plotNumber.trim())}`;
      }

      const data = await api.get<{ found: boolean; parcels: VerifyResult["parcel"][] }>(
        `/parcels/search?${query}`
      );

      if (data.found && data.parcels.length > 0) {
        setResults(
          data.parcels.map((p) => ({
            verified: true,
            parcel: p,
          }))
        );
      } else {
        setResults([{ verified: false, message: "No matching property records found." }]);
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Verification failed",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Navbar />
    <div className="public-page">
    <div className="verify-page">
      <div className="page-header">
        <h1>
          Verify <span className="gradient-text">Ownership</span>
        </h1>
        <p>Check if a property is registered and verify the current owner</p>
      </div>

      {/* ── Mode Toggle ── */}
      <div className="verify-modes">
        <button
          className={`verify-mode${mode === "cnic" ? " verify-mode--active" : ""}`}
          onClick={() => setMode("cnic")}
          type="button"
        >
          <span className="verify-mode__icon">👤</span>
          <span>Search by Owner CNIC</span>
        </button>
        <button
          className={`verify-mode${mode === "parcel" ? " verify-mode--active" : ""}`}
          onClick={() => setMode("parcel")}
          type="button"
        >
          <span className="verify-mode__icon">📍</span>
          <span>Search by Property Details</span>
        </button>
      </div>

      {/* ── Search Form ── */}
      <form onSubmit={handleVerify} className="verify-form glass-card">
        {mode === "cnic" ? (
          <div className="form-group">
            <label htmlFor="verify-cnic">Owner CNIC Number</label>
            <CnicInput value={cnic} onChange={setCnic} id="verify-cnic" required />
            <span className="form-hint">Enter the 13-digit CNIC of the property owner</span>
          </div>
        ) : (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="verify-district">District</label>
              <input
                type="text"
                id="verify-district"
                className="form-input"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Lahore"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="verify-plot">Plot Number</label>
              <input
                type="text"
                id="verify-plot"
                className="form-input"
                value={plotNumber}
                onChange={(e) => setPlotNumber(e.target.value)}
                placeholder="e.g. P-42"
                required
              />
            </div>
          </div>
        )}
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
                      {r.parcel.currentOwnerName || r.parcel.currentOwnerCnic}
                    </span>
                  </div>
                  <div className="verify-card__row">
                    <span className="verify-card__label">📄 Documents</span>
                    <span className="verify-card__value verify-card__docs">
                      {r.parcel.hasFard && <span className="doc-tag">Fard</span>}
                      {r.parcel.hasRegistry && <span className="doc-tag">Registry</span>}
                      {!r.parcel.hasFard && !r.parcel.hasRegistry && (
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
            <p>Enter the owner's CNIC or property location details</p>
          </div>
          <div className="verify-info__step">
            <span className="verify-info__num">2</span>
            <p>Our system checks the registered land records database</p>
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
