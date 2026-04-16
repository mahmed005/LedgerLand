/* ═══════════════════════════════════════════════════════
   Layout — App shell with sidebar navigation
   ═══════════════════════════════════════════════════════ */

import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ── Inline SVG Icons ──────────────────────────────────── */
const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);
const TransferIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const ChainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="2" y="7" width="6" height="10" rx="2" />
    <rect x="16" y="7" width="6" height="10" rx="2" />
    <path d="M8 12h8" />
  </svg>
);
const GavelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="m14 13-8.5 8.5a2.12 2.12 0 1 1-3-3L11 10" />
    <path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8" />
  </svg>
);
const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16,17 21,12 16,7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
);
const MapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const UserPlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <path d="M20 8v6M23 11h-6" />
  </svg>
);

/* ── Role badges ───────────────────────────────────────── */
const roleBadgeColors: Record<string, string> = {
  citizen: "var(--ll-teal)",
  admin: "var(--ll-gold)",
  judge: "var(--ll-violet)",
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const role = user?.role || "citizen";
  const badgeColor = roleBadgeColors[role] || "var(--ll-text)";

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? " sidebar--open" : ""}`}>
        <div className="sidebar__header">
          <a href="/" className="sidebar__brand">
            <span className="sidebar__logo-mark">⬡</span>
            <span className="sidebar__logo-text">
              Ledger<em>Land</em>
            </span>
          </a>
        </div>

        <nav className="sidebar__nav">
          <div className="sidebar__group">
            <span className="sidebar__group-label">Main</span>
            <NavLink
              to="/dashboard"
              className="sidebar__link"
              onClick={() => setSidebarOpen(false)}
            >
              <DashboardIcon /> Dashboard
            </NavLink>
            <NavLink
              to="/search"
              className="sidebar__link"
              onClick={() => setSidebarOpen(false)}
            >
              <SearchIcon /> Search Records
            </NavLink>
            {role === "citizen" && (
              <NavLink
                to="/verify"
                className="sidebar__link"
                onClick={() => setSidebarOpen(false)}
              >
                <ChainIcon /> Verify Ownership
              </NavLink>
            )}
          </div>

          {role === "citizen" && (
            <div className="sidebar__group">
              <span className="sidebar__group-label">Transfers</span>
              <NavLink
                to="/transfers"
                className="sidebar__link"
                onClick={() => setSidebarOpen(false)}
              >
                <TransferIcon /> My Transfers
              </NavLink>
              <NavLink
                to="/transfers/new"
                className="sidebar__link"
                onClick={() => setSidebarOpen(false)}
              >
                <PlusIcon /> New Transfer
              </NavLink>
            </div>
          )}

          {role === "admin" && (
            <div className="sidebar__group">
              <span className="sidebar__group-label">Administration</span>
              <NavLink
                to="/admin/parcels"
                className="sidebar__link"
                onClick={() => setSidebarOpen(false)}
              >
                <MapIcon /> Manage Parcels
              </NavLink>
              <NavLink
                to="/admin/parcels/new"
                className="sidebar__link"
                onClick={() => setSidebarOpen(false)}
              >
                <PlusIcon /> Register Parcel
              </NavLink>
              <NavLink
                to="/admin/users/judge"
                className="sidebar__link"
                onClick={() => setSidebarOpen(false)}
              >
                <UserPlusIcon /> Create Judge
              </NavLink>
              <NavLink
                to="/blockchain"
                className="sidebar__link"
                onClick={() => setSidebarOpen(false)}
              >
                <ChainIcon /> Blockchain Explorer
              </NavLink>
            </div>
          )}

          {role === "judge" && (
            <div className="sidebar__group">
              <span className="sidebar__group-label">Judicial</span>
              <NavLink
                to="/search"
                className="sidebar__link"
                onClick={() => setSidebarOpen(false)}
              >
                <GavelIcon /> Case Search
              </NavLink>
              <NavLink
                to="/blockchain"
                className="sidebar__link"
                onClick={() => setSidebarOpen(false)}
              >
                <ChainIcon /> Blockchain Explorer
              </NavLink>
            </div>
          )}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">
                {user?.fullName || "User"}
              </span>
              <span
                className="sidebar__user-role"
                style={{ color: badgeColor }}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </span>
            </div>
          </div>
          <button className="sidebar__logout" onClick={handleLogout}>
            <LogoutIcon /> Logout
          </button>
        </div>
      </aside>

      {/* ── Overlay for mobile ── */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main Content ── */}
      <main className="app-main">
        <header className="app-topbar">
          <button
            className="app-topbar__menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            <MenuIcon />
          </button>
          <div className="app-topbar__spacer" />
          <div className="app-topbar__user">
            <span
              className="app-topbar__role-badge"
              style={
                {
                  "--badge-color": badgeColor,
                } as React.CSSProperties
              }
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </span>
            <span className="app-topbar__name">
              {user?.fullName || "User"}
            </span>
          </div>
        </header>
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
