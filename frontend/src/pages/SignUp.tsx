/* ═══════════════════════════════════════════════════════
   SignUp — Registration page
   ═══════════════════════════════════════════════════════ */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../api/client";
import CnicInput from "../components/CnicInput";
import React from "react";

export default function SignUp() {
  const [cnic, setCnic] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (cnic.length !== 13) {
      showToast("CNIC must be 13 digits", "error");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    if (password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    setLoading(true);
    try {
      await signup({
        cnic,
        password,
        fullName,
        email: email || undefined,
      });
      showToast("Account created successfully!", "success");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Registration failed. Please try again.";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__bg-grid" />
      <div className="auth-page__glow auth-page__glow--1" />
      <div className="auth-page__glow auth-page__glow--2" />

      <div className="auth-card">
        <div className="auth-card__header">
          <Link to="/" className="auth-card__brand">
            <span className="auth-card__logo-mark">⬡</span>
            <span className="auth-card__logo-text">
              Ledger<em>Land</em>
            </span>
          </Link>
          <h1>Citizen Registration</h1>
          <p>Create your citizen account to manage property records</p>
        </div>

        <div className="role-desc" style={{ "--role-color": "var(--ll-teal)" } as React.CSSProperties}>
          <span className="role-desc__icon">👤</span>
          <p>This registration is for <strong>citizens</strong> only. Admin and Judge accounts are provisioned by system administrators.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-card__form">
          <div className="form-group">
            <label htmlFor="signup-name">Full Name</label>
            <input
              type="text"
              id="signup-name"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-cnic">CNIC Number</label>
            <CnicInput
              value={cnic}
              onChange={setCnic}
              required
              id="signup-cnic"
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-email">
              Email <span className="form-optional">(optional)</span>
            </label>
            <input
              type="email"
              id="signup-email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <input
                type="password"
                id="signup-password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label htmlFor="signup-confirm">Confirm Password</label>
              <input
                type="password"
                id="signup-confirm"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="auth-card__footer">
          <p>
            Already have an account?{" "}
            <Link to="/signin" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
