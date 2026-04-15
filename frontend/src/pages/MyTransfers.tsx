/* ═══════════════════════════════════════════════════════
   MyTransfers — List user's transfers with status filter
   ═══════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import LoadingSpinner from "../components/LoadingSpinner";
import TransferCard, { type TransferData } from "../components/TransferCard";
import EmptyState from "../components/EmptyState";

const TABS = ["all", "pending_buyer", "pending_nadra", "completed", "rejected"];

export default function MyTransfers() {
  const [transfers, setTransfers] = useState<TransferData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    api
      .get<{ transfers: TransferData[] }>("/transfers/my")
      .then((data) => setTransfers(data.transfers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    activeTab === "all"
      ? transfers
      : transfers.filter((t) => t.status === activeTab);

  if (loading) {
    return (
      <div className="page-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="transfers-page">
      <div className="page-header">
        <div className="page-header__row">
          <div>
            <h1>
              My <span className="gradient-text">Transfers</span>
            </h1>
            <p>View and manage your property transfers</p>
          </div>
          <Link to="/transfers/new" className="btn btn--primary">
            + New Transfer
          </Link>
        </div>
      </div>

      {/* ── Status Tabs ── */}
      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab${activeTab === tab ? " tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "all"
              ? "All"
              : tab
                  .replace("_", " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
            {tab === "all" && (
              <span className="tab__count">{transfers.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Transfer List ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No transfers found"
          message={
            activeTab === "all"
              ? "You haven't initiated or received any transfers yet."
              : `No ${activeTab.replace("_", " ")} transfers.`
          }
        />
      ) : (
        <div className="transfers-list">
          {filtered.map((t) => (
            <TransferCard key={t._id} transfer={t} />
          ))}
        </div>
      )}
    </div>
  );
}
