/* ═══════════════════════════════════════════════════════
   SignIn — Role-tabbed login page 
   Citizen / Admin / Judge portals
   ═══════════════════════════════════════════════════════ */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../api/client";
import CnicInput from "../components/CnicInput";

type RoleTab = "citizen" | "admin" | "judge";

const roleInfo: Record<RoleTab, { label: string; icon: string; desc: string; color: string }> = {
  citizen: {
    label: "Citizen",
    icon: "👤",
    desc: "Access your property records and manage transfers",
    color: "var(--ll-teal)",
  },
  admin: {
    label: "Administrator",
    icon: "🛡️",
    desc: "Manage parcels, users, and system administration",
    color: "var(--ll-gold)",
  },
  judge: {
    label: "Judge",
    icon: "⚖️",
    desc: "Read-only judicial access to all records & audit trails",
    color: "var(--ll-violet)",
  },
};

export default function SignIn() {
  const [activeRole, setActiveRole] = useState<RoleTab>("citizen");
  const [cnic, setCnic] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (cnic.length !== 13) {
      showToast("CNIC must be 13 digits", "error");
      return;
    }
    setLoading(true);
    try {
      const user = await login(cnic, password);
      // Validate that the logged-in user matches the selected role tab
      if (user && user.role !== activeRole) {
        showToast(
          `This account is registered as "${user.role}", not "${activeRole}". Redirecting to your dashboard.`,
          "info"
        );
      }
      showToast("Signed in successfully", "success");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Login failed. Please check your credentials.";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const info = roleInfo[activeRole];

  return (
    <div className="auth-page">
      <div className="auth-page__bg-grid" />
      <div className="auth-page__glow auth-page__glow--1" />
      <div className="auth-page__glow auth-page__glow--2" />

      <div className="auth-card auth-card--wide">
        <div className="auth-card__header">
          <Link to="/" className="auth-card__brand">
            <span className="auth-card__logo-mark">⬡</span>
            <span className="auth-card__logo-text">
              Ledger<em>Land</em>
            </span>
          </Link>
          <h1>Sign In</h1>
          <p>Choose your role to continue</p>
        </div>

        {/* ── Role Tabs ── */}
        <div className="role-tabs">
          {(Object.keys(roleInfo) as RoleTab[]).map((role) => (
            <button
              key={role}
              className={`role-tab${activeRole === role ? " role-tab--active" : ""}`}
              onClick={() => setActiveRole(role)}
              style={
                activeRole === role
                  ? ({ "--tab-color": roleInfo[role].color } as React.CSSProperties)
                  : undefined
              }
              type="button"
            >
              <span className="role-tab__icon">{roleInfo[role].icon}</span>
              <span className="role-tab__label">{roleInfo[role].label}</span>
            </button>
          ))}
        </div>

        {/* ── Role Description ── */}
        <div
          className="role-desc"
          style={{ "--role-color": info.color } as React.CSSProperties}
        >
          <span className="role-desc__icon">{info.icon}</span>
          <p>{info.desc}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-card__form">
          <div className="form-group">
            <label htmlFor="signin-cnic">CNIC Number</label>
            <CnicInput
              value={cnic}
              onChange={setCnic}
              required
              id="signin-cnic"
            />
          </div>

          <div className="form-group">
            <label htmlFor="signin-password">Password</label>
            <input
              type="password"
              id="signin-password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
            style={
              {
                background: `linear-gradient(135deg, ${info.color}, ${info.color}88)`,
              } as React.CSSProperties
            }
          >
            {loading
              ? "Signing in…"
              : `Sign In as ${info.label}`}
          </button>
        </form>

        <div className="auth-card__footer">
          {activeRole === "citizen" ? (
            <p>
              Don't have an account?{" "}
              <Link to="/signup" className="auth-link">
                Create one
              </Link>
            </p>
          ) : activeRole === "admin" ? (
            <p className="auth-card__footer-note">
              Admin accounts are provisioned by the system administrator.
            </p>
          ) : (
            <p className="auth-card__footer-note">
              Judge accounts are created by administrators.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
