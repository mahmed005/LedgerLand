/* ═══════════════════════════════════════════════════════
   Navbar — Slim top navigation for non-layout pages
   Used on public pages: Search, ParcelDetail, Blockchain
   ═══════════════════════════════════════════════════════ */

import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { pathname } = useLocation();

  if (pathname === "/") {
    return null;
  }

  return (
    <header className="app-navbar">
      <div className="app-navbar__inner">
        <Link to="/" className="app-navbar__brand">
          <span className="app-navbar__logo-mark">⬡</span>
          <span className="app-navbar__logo-text">
            Ledger<em>Land</em>
          </span>
        </Link>

        <nav className="app-navbar__links">
          <Link to="/search" className="app-navbar__link">
            Search Records
          </Link>
          <Link to="/verify" className="app-navbar__link">
            Verify Ownership
          </Link>
        </nav>

        <div className="app-navbar__actions">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="btn btn--ghost btn--sm">
                Dashboard
              </Link>
              <span className="app-navbar__user">
                {user?.fullName}
              </span>
              <button
                className="btn btn--ghost btn--sm"
                onClick={logout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/signin" className="btn btn--ghost btn--sm">
                Sign In
              </Link>
              <Link to="/signup" className="btn btn--primary btn--sm">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
