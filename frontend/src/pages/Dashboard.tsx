/* ═══════════════════════════════════════════════════════
   Dashboard — Role-aware home screen (user-friendly)
   ═══════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import LoadingSpinner from "../components/LoadingSpinner";

interface Stats {
  recentTransfersHint: string;
  totalRecords: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data: Stats = {
          recentTransfersHint: "Use transfer ID",
          totalRecords: "—",
        };

        try {
          const bRes = await api.get<{ blockCount?: number; recordCount?: number }>("/blockchain");
          data.totalRecords = String(bRes.recordCount ?? bRes.blockCount ?? "—");
        } catch {
          // blockchain not available
        }

        setStats(data);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user?.role]);

  if (loading) {
    return (
      <div className="page-center">
        <LoadingSpinner />
      </div>
    );
  }

  const role = user?.role || "citizen";

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>
          Welcome back,{" "}
          <span className="gradient-text">{user?.fullName}</span>
        </h1>
        <p>
          {role === "citizen" && "Manage your properties and transfers"}
          {role === "admin" && "System administration and land registry management"}
          {role === "judge" && "Judicial access to land records and audit trails"}
        </p>
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid">
        <div className="stat-card stat-card--teal">
          <div className="stat-card__value">
            {role === "citizen" ? "👤" : role === "admin" ? "🛡️" : "⚖️"}
          </div>
          <div className="stat-card__label">
            {role.charAt(0).toUpperCase() + role.slice(1)} Account
          </div>
        </div>
        {(role === "citizen" || role === "admin") && (
          <div className="stat-card stat-card--gold">
            <div className="stat-card__value">
              {stats?.recentTransfersHint ?? "Use transfer ID"}
            </div>
            <div className="stat-card__label">Transfer Tracking</div>
          </div>
        )}
        <div className="stat-card stat-card--green">
          <div className="stat-card__value">🔒</div>
          <div className="stat-card__label">Records Secured</div>
        </div>
        {(role === "admin" || role === "judge") && (
          <div className="stat-card stat-card--blue">
            <div className="stat-card__value">{stats?.totalRecords ?? "—"}</div>
            <div className="stat-card__label">Total Records</div>
          </div>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <div className="quick-actions">
        <h2>What would you like to do?</h2>
        <div className="quick-actions__grid">

          {/* ── Citizen Actions ── */}
          {role === "citizen" && (
            <>
              <Link to="/search" className="action-card">
                <div className="action-card__icon action-card__icon--teal">🔍</div>
                <h3>Search Land Records</h3>
                <p>Look up any property by location or owner information</p>
              </Link>

              <Link to="/verify" className="action-card">
                <div className="action-card__icon action-card__icon--green">✓</div>
                <h3>Verify Ownership</h3>
                <p>Check if a property is registered and who the current owner is</p>
              </Link>

              <Link to="/transfers/new" className="action-card">
                <div className="action-card__icon action-card__icon--gold">↗</div>
                <h3>Transfer Property</h3>
                <p>Start transferring ownership of your property to a buyer</p>
              </Link>

              <Link to="/transfers" className="action-card">
                <div className="action-card__icon action-card__icon--blue">📋</div>
                <h3>My Transfers</h3>
                <p>View and manage your pending and completed transfers</p>
              </Link>
            </>
          )}

          {/* ── Admin Actions ── */}
          {role === "admin" && (
            <>
              <Link to="/admin/parcels/new" className="action-card">
                <div className="action-card__icon action-card__icon--teal">📌</div>
                <h3>Register New Parcel</h3>
                <p>Add a new land parcel to the official registry</p>
              </Link>

              <Link to="/admin/parcels" className="action-card">
                <div className="action-card__icon action-card__icon--gold">📋</div>
                <h3>Manage Parcels</h3>
                <p>Search, view and update parcel records and disputed status</p>
              </Link>

              <Link to="/admin/users/judge" className="action-card">
                <div className="action-card__icon action-card__icon--violet">⚖️</div>
                <h3>Create Judge Account</h3>
                <p>Register a new judicial authority with read-only access</p>
              </Link>

              <Link to="/transfers" className="action-card">
                <div className="action-card__icon action-card__icon--blue">↗</div>
                <h3>My Transfers</h3>
                <p>View and manage property transfers</p>
              </Link>

              <Link to="/search" className="action-card">
                <div className="action-card__icon action-card__icon--green">🔍</div>
                <h3>Search Records</h3>
                <p>Look up any property record in the system</p>
              </Link>

              <Link to="/blockchain" className="action-card">
                <div className="action-card__icon action-card__icon--rose">📜</div>
                <h3>Audit Trail</h3>
                <p>View all permanent ownership change records</p>
              </Link>
            </>
          )}

          {/* ── Judge Actions ── */}
          {role === "judge" && (
            <>
              <Link to="/search" className="action-card">
                <div className="action-card__icon action-card__icon--violet">🔍</div>
                <h3>Search Case Records</h3>
                <p>Look up property records for judicial investigation</p>
              </Link>

              <Link to="/blockchain" className="action-card">
                <div className="action-card__icon action-card__icon--gold">📜</div>
                <h3>Audit Trail</h3>
                <p>Review permanent ownership change records for evidence</p>
              </Link>

              <Link to="/verify" className="action-card">
                <div className="action-card__icon action-card__icon--teal">✓</div>
                <h3>Verify Ownership</h3>
                <p>Confirm current ownership status of any property</p>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
