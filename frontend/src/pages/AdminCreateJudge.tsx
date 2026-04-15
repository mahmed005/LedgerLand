/* ═══════════════════════════════════════════════════════
   AdminCreateJudge — Create a judge account (KAN-16)
   ═══════════════════════════════════════════════════════ */

import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import CnicInput from "../components/CnicInput";

export default function AdminCreateJudge() {
  const [cnic, setCnic] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

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

    setLoading(true);
    try {
      await api.post("/admin/users/judge", {
        cnic,
        password,
        fullName: fullName.trim(),
        email: email.trim() || undefined,
      });
      showToast("Judge account created successfully!", "success");
      // Reset form
      setCnic("");
      setPassword("");
      setFullName("");
      setEmail("");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Failed to create judge",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page">
      <div className="page-header">
        <h1>
          Create <span className="gradient-text">Judge Account</span>
        </h1>
        <p>Register a new judicial authority with read-only access</p>
      </div>

      <form onSubmit={handleSubmit} className="form-card glass-card">
        <div className="form-group">
          <label htmlFor="judge-name">Full Name *</label>
          <input
            type="text"
            id="judge-name"
            className="form-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Judge's full name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="judge-cnic">CNIC Number *</label>
          <CnicInput
            value={cnic}
            onChange={setCnic}
            id="judge-cnic"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="judge-email">
            Email <span className="form-optional">(optional)</span>
          </label>
          <input
            type="email"
            id="judge-email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="judge@example.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="judge-password">Password *</label>
          <input
            type="password"
            id="judge-password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 6 characters"
            required
            minLength={6}
          />
        </div>

        <div className="form-info">
          <p>
            <strong>⚖️ Judge Role</strong>
          </p>
          <ul>
            <li>Read-only access to all parcel records and audit trails</li>
            <li>Full CNIC visibility for judicial purposes</li>
            <li>Cannot create parcels, initiate transfers, or modify data</li>
          </ul>
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full"
          disabled={loading}
        >
          {loading ? "Creating…" : "Create Judge Account"}
        </button>
      </form>
    </div>
  );
}
