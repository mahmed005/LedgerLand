/* NotFound — 404 page */

import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-page__bg-grid" />
      <div className="auth-page__glow auth-page__glow--1" />

      <div className="empty-state" style={{ padding: "80px 24px" }}>
        <div className="empty-state__icon" style={{ fontSize: "64px" }}>
          🌐
        </div>
        <h1
          style={{
            fontFamily: "var(--ll-font-head)",
            fontSize: "48px",
            fontWeight: 800,
            color: "var(--ll-white)",
          }}
        >
          404
        </h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
          <Link to="/" className="btn btn--primary">
            Go Home
          </Link>
          <Link to="/search" className="btn btn--ghost">
            Search Records
          </Link>
        </div>
      </div>
    </div>
  );
}
