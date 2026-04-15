/* ═══════════════════════════════════════════════════════
   SearchParcels — Public land record search
   ═══════════════════════════════════════════════════════ */

import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Navbar from "../components/Navbar";
import CnicInput from "../components/CnicInput";
import ParcelCard, { type ParcelData } from "../components/ParcelCard";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";

interface SearchResponse {
  found: boolean;
  message?: string;
  parcels: ParcelData[];
}

export default function SearchParcels() {
  const [params, setParams] = useSearchParams();
  const [district, setDistrict] = useState(params.get("district") || "");
  const [moza, setMoza] = useState(params.get("moza") || "");
  const [plotNumber, setPlotNumber] = useState(params.get("plotNumber") || "");
  const [ownerCnic, setOwnerCnic] = useState(params.get("ownerCnic") || "");

  const [results, setResults] = useState<ParcelData[] | null>(null);
  const [noResults, setNoResults] = useState(false);
  const [loading, setLoading] = useState(false);

  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();

    if (!district.trim() && !moza.trim() && !plotNumber.trim() && !ownerCnic) {
      showToast("Please enter at least one search filter", "error");
      return;
    }

    const newParams = new URLSearchParams();
    if (district.trim()) newParams.set("district", district.trim());
    if (moza.trim()) newParams.set("moza", moza.trim());
    if (plotNumber.trim()) newParams.set("plotNumber", plotNumber.trim());
    if (ownerCnic) newParams.set("ownerCnic", ownerCnic);
    setParams(newParams);

    setLoading(true);
    setNoResults(false);
    try {
      const query = newParams.toString();
      const data = await api.get<SearchResponse>(
        `/parcels/search?${query}`
      );
      setResults(data.parcels);
      setNoResults(!data.found);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Search failed";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="public-page">
        <div className="search-page">
          <div className="page-header">
            <h1>
              Search <span className="gradient-text">Land Records</span>
            </h1>
            <p>
              Look up property records by district, moza, plot number, or owner
              CNIC
              {!isAuthenticated && (
                <span className="search-page__auth-hint">
                  {" "}
                  · <Link to="/signin">Sign in</Link> to see full CNIC numbers
                </span>
              )}
            </p>
          </div>

          <form onSubmit={handleSearch} className="search-form glass-card">
            <div className="search-form__fields">
              <div className="form-group">
                <label htmlFor="search-district">District</label>
                <input
                  type="text"
                  id="search-district"
                  className="form-input"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Lahore"
                />
              </div>
              <div className="form-group">
                <label htmlFor="search-moza">Moza</label>
                <input
                  type="text"
                  id="search-moza"
                  className="form-input"
                  value={moza}
                  onChange={(e) => setMoza(e.target.value)}
                  placeholder="e.g. Ravi"
                />
              </div>
              <div className="form-group">
                <label htmlFor="search-plot">Plot Number</label>
                <input
                  type="text"
                  id="search-plot"
                  className="form-input"
                  value={plotNumber}
                  onChange={(e) => setPlotNumber(e.target.value)}
                  placeholder="e.g. P-42"
                />
              </div>
              <div className="form-group">
                <label htmlFor="search-cnic">Owner CNIC</label>
                <CnicInput
                  value={ownerCnic}
                  onChange={setOwnerCnic}
                  id="search-cnic"
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading}
            >
              {loading ? "Searching…" : "Search Records"}
            </button>
          </form>

          {loading && (
            <div className="page-center" style={{ marginTop: 48 }}>
              <LoadingSpinner />
            </div>
          )}

          {noResults && !loading && (
            <EmptyState
              icon="🔍"
              title="No record found."
              message="Try adjusting your search filters or check for typos."
            />
          )}

          {results && results.length > 0 && !loading && (
            <div className="results-grid">
              {results.map((p) => (
                <ParcelCard key={p.id} parcel={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
