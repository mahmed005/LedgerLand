/* ═══════════════════════════════════════════════════════
   AdminParcels — Search + manage parcels (toggle disputed)
   ═══════════════════════════════════════════════════════ */

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import LoadingSpinner from "../components/LoadingSpinner";
import StatusBadge from "../components/StatusBadge";

interface Parcel {
  id: string;
  district: string;
  moza: string;
  plotNumber: string;
  currentOwnerCnic: string;
  disputed: boolean;
}

export default function AdminParcels() {
  const [district, setDistrict] = useState("");
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!district.trim()) {
      showToast("Enter a district to search", "error");
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const data = await api.get<{ parcels: Parcel[] }>(
        `/parcels/search?district=${encodeURIComponent(district.trim())}`
      );
      setParcels(data.parcels);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Search failed",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleDisputed = async (parcel: Parcel) => {
    setTogglingId(parcel.id);
    try {
      await api.patch(`/admin/parcels/${parcel.id}`, {
        disputed: !parcel.disputed,
      });
      setParcels((prev) =>
        prev.map((p) =>
          p.id === parcel.id ? { ...p, disputed: !p.disputed } : p
        )
      );
      showToast(
        `Parcel ${parcel.plotNumber} marked as ${!parcel.disputed ? "disputed" : "not disputed"}`,
        "success"
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Update failed",
        "error"
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="admin-parcels">
      <div className="page-header">
        <div className="page-header__row">
          <div>
            <h1>
              Manage <span className="gradient-text">Parcels</span>
            </h1>
            <p>Search parcels and manage disputed status</p>
          </div>
          <Link to="/admin/parcels/new" className="btn btn--primary">
            + Register Parcel
          </Link>
        </div>
      </div>

      <form onSubmit={handleSearch} className="search-form glass-card">
        <div className="search-form__fields search-form__fields--inline">
          <div className="form-group" style={{ flex: 1 }}>
            <input
              type="text"
              className="form-input"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="Search by district…"
            />
          </div>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="page-center" style={{ marginTop: 32 }}>
          <LoadingSpinner />
        </div>
      )}

      {searched && !loading && parcels.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">📋</div>
          <h3>No parcels found</h3>
          <p>Try searching with a different district name.</p>
        </div>
      )}

      {parcels.length > 0 && !loading && (
        <div className="admin-table-wrap glass-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>District</th>
                <th>Moza</th>
                <th>Plot</th>
                <th>Owner CNIC</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {parcels.map((p) => (
                <tr key={p.id}>
                  <td>{p.district}</td>
                  <td>{p.moza}</td>
                  <td>{p.plotNumber}</td>
                  <td className="mono">{p.currentOwnerCnic}</td>
                  <td>
                    {p.disputed ? (
                      <StatusBadge status="disputed" />
                    ) : (
                      <StatusBadge status="active" />
                    )}
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      <Link
                        to={`/parcels/${p.id}`}
                        className="btn btn--ghost btn--sm"
                      >
                        View
                      </Link>
                      <button
                        className={`btn btn--sm ${p.disputed ? "btn--outline" : "btn--danger"}`}
                        onClick={() => toggleDisputed(p)}
                        disabled={togglingId === p.id}
                      >
                        {togglingId === p.id
                          ? "…"
                          : p.disputed
                            ? "Clear Disputed"
                            : "Mark Disputed"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
