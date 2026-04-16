/* ═══════════════════════════════════════════════════════
   ParcelDetail — Full view for a single parcel
   ═══════════════════════════════════════════════════════ */

import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Navbar from "../components/Navbar";
import LoadingSpinner from "../components/LoadingSpinner";
import StatusBadge from "../components/StatusBadge";

interface OwnershipEntry {
  ownerCnic: string;
  ownerFullName?: string | null;
  acquiredAt: string;
  transferId: string | null;
  note: string;
}

interface ParcelData {
  id: string;
  district: string;
  moza: string;
  plotNumber: string;
  khasra: string;
  currentOwnerCnic: string;
  currentOwnerFullName?: string | null;
  disputed: boolean;
  ownershipHistory: OwnershipEntry[];
  hasFard: boolean;
  hasRegistry: boolean;
  hasMutation?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ParcelDetail() {
  const { parcelId } = useParams<{ parcelId: string }>();
  const [parcel, setParcel] = useState<ParcelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState<"fard" | "registry" | "mutation">("fard");

  const fileRef = useRef<HTMLInputElement>(null);
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (!parcelId) return;
    api
      .get<{ parcel: ParcelData }>(`/parcels/${parcelId}`)
      .then((data) => setParcel(data.parcel))
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "Failed to load parcel"
        );
      })
      .finally(() => setLoading(false));
  }, [parcelId]);

  const handleDownload = async (docType: string) => {
    try {
      const res = await api.download(
        `/parcels/${parcelId}/documents/${docType}`
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = docType.includes("pdf")
        ? "ownership-certificate.pdf"
        : `${docType}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${docType}`, "success");
    } catch {
      showToast(`Document not available`, "error");
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", uploadKind);

      await api.post(`/parcels/${parcelId}/documents/upload`, formData);
      showToast(`${uploadKind} uploaded successfully`, "success");
      // Refresh parcel data
      const data = await api.get<{ parcel: ParcelData }>(
        `/parcels/${parcelId}`
      );
      setParcel(data.parcel);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Upload failed";
      showToast(msg, "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="public-page">
          <div className="page-center">
            <LoadingSpinner />
          </div>
        </div>
      </>
    );
  }

  if (error || !parcel) {
    return (
      <>
        <Navbar />
        <div className="public-page">
          <div className="page-center">
            <div className="empty-state">
              <div className="empty-state__icon">❌</div>
              <h2>{error || "Parcel not found"}</h2>
              <Link to="/search" className="btn btn--primary">
                Back to Search
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const isOwner =
    isAuthenticated && user?.cnic === parcel.currentOwnerCnic;

  return (
    <>
    <Navbar />
    <div className="public-page">
    <div className="parcel-detail">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header__row">
          <div>
            <h1>
              {parcel.district} / {parcel.moza}
            </h1>
            <p>Plot {parcel.plotNumber}{parcel.khasra ? ` · Khasra ${parcel.khasra}` : ""}</p>
          </div>
          <div className="page-header__badges">
            {parcel.disputed && <StatusBadge status="disputed" />}
            {!parcel.disputed && <StatusBadge status="active" />}
          </div>
        </div>
      </div>

      <div className="detail-grid">
        {/* ── Owner Info ── */}
        <div className="detail-card glass-card">
          <h2>Current Owner</h2>
          <div className="detail-card__fields">
            <div className="detail-card__field">
              <span className="detail-card__label">CNIC</span>
              <span className="detail-card__value mono">
                {parcel.currentOwnerCnic}
              </span>
            </div>
            {parcel.currentOwnerFullName && (
              <div className="detail-card__field">
                <span className="detail-card__label">Name</span>
                <span className="detail-card__value">
                  {parcel.currentOwnerFullName}
                </span>
              </div>
            )}
          </div>
          {isOwner && !parcel.disputed && (
            <Link
              to={`/transfers/new?parcelId=${parcel.id}`}
              className="btn btn--primary"
              style={{ marginTop: 16 }}
            >
              Transfer This Property
            </Link>
          )}
        </div>

        {/* ── Documents ── */}
        <div className="detail-card glass-card">
          <h2>Documents</h2>
          <div className="doc-buttons">
            {parcel.hasFard && (
              <button
                className="btn btn--ghost"
                onClick={() => handleDownload("fard")}
              >
                📄 Download Fard
              </button>
            )}
            {parcel.hasRegistry && (
              <button
                className="btn btn--ghost"
                onClick={() => handleDownload("registry")}
              >
                📄 Download Registry
              </button>
            )}
            {parcel.hasMutation && (
              <button
                className="btn btn--ghost"
                onClick={() => handleDownload("mutation")}
              >
                📄 Download Mutation
              </button>
            )}
            <button
              className="btn btn--ghost"
              onClick={() => handleDownload("ownership-certificate.pdf")}
            >
              📜 Ownership Certificate (PDF)
            </button>
          </div>

          {isAuthenticated && (
            <div className="upload-section">
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label htmlFor="upload-kind">Document Type</label>
                <select
                  id="upload-kind"
                  className="form-input"
                  value={uploadKind}
                  onChange={(e) =>
                    setUploadKind(e.target.value as "fard" | "registry" | "mutation")
                  }
                  disabled={uploading}
                >
                  <option value="fard">Fard</option>
                  <option value="registry">Registry</option>
                  <option value="mutation">Mutation</option>
                </select>
              </div>
              <label className="btn btn--outline upload-btn">
                {uploading ? "Uploading…" : "📤 Upload Document"}
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ── Ownership History ── */}
      <div className="history-section glass-card">
        <h2>Ownership History</h2>
        <div className="history-timeline">
          {parcel.ownershipHistory.map((entry, i) => (
            <div className="history-item" key={i}>
              <div className="history-item__dot" />
              <div className="history-item__content">
                <div className="history-item__header">
                  <span className="mono">{entry.ownerCnic}</span>
                  <span className="history-item__date">
                    {new Date(entry.acquiredAt).toLocaleDateString("en-PK", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {entry.ownerFullName && (
                  <p className="history-item__note">Owner: {entry.ownerFullName}</p>
                )}
                <p className="history-item__note">{entry.note}</p>
                {entry.transferId && (
                  <Link
                    to={`/transfers/${entry.transferId}`}
                    className="history-item__link"
                  >
                    View Transfer →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
    </>
  );
}
