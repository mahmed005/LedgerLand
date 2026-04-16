/* ═══════════════════════════════════════════════════════
   AdminCreateJudge — Judge provisioning guidance
   README-defined flow uses backend bootstrap env vars
   ═══════════════════════════════════════════════════════ */

export default function AdminCreateJudge() {
  return (
    <div className="form-page">
      <div className="page-header">
        <h1>
          Judge <span className="gradient-text">Provisioning</span>
        </h1>
        <p>Judge users are provisioned from backend configuration</p>
      </div>

      <div className="form-card glass-card">
        <div className="form-info">
          <p>
            <strong>How to create a judge account</strong>
          </p>
          <p>
            The backend README defines judge account creation through environment variables at startup,
            not via an HTTP endpoint.
          </p>
        </div>

        <div className="verify-info glass-card" style={{ marginBottom: 16 }}>
          <h3>Backend .env</h3>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
{`JUDGE_BOOTSTRAP_CNIC=3520111111111
JUDGE_BOOTSTRAP_PASSWORD=ChangeMe123`}
          </pre>
        </div>

        <div className="form-info">
          <p>
            <strong>⚖️ Judge Role</strong>
          </p>
          <ul>
            <li>Read-only access to all parcel records and audit trails</li>
            <li>Full CNIC visibility for judicial purposes</li>
            <li>Cannot create parcels, initiate transfers, or upload documents</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
