/* ═══════════════════════════════════════════════════════
   BlockchainExplorer — Admin/Judge-friendly records view
   Shows on-chain land transfer records in plain language
   ═══════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { api } from "../api/client";
import LoadingSpinner from "../components/LoadingSpinner";

interface ChainSummary {
  valid: boolean;
  blockCount?: number;
  recordCount?: number;
  tip?: { hash: string; chainId: string };
  contractAddress?: string;
  rpcOk?: boolean;
}

interface Block {
  index: number;
  author: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export default function BlockchainExplorer() {
  const [summary, setSummary] = useState<ChainSummary | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [sumData, blockData] = await Promise.allSettled([
          api.get<ChainSummary>("/blockchain"),
          api.get<{ blocks: Block[] }>("/blockchain/blocks"),
        ]);

        if (sumData.status === "fulfilled") setSummary(sumData.value);
        if (blockData.status === "fulfilled")
          setBlocks(blockData.value.blocks);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* Helper: turn payload into human-readable description */
  const describeRecord = (payload: Record<string, unknown>): string => {
    const type = (payload?.type as string)?.toLowerCase() || "";
    if (type.includes("transfer") || type.includes("ownership")) {
      const from = payload.previousOwner || payload.sellerCnic || "—";
      const to = payload.newOwner || payload.buyerCnic || "—";
      return `Ownership transferred from ${from} to ${to}`;
    }
    if (type.includes("register") || type.includes("create")) {
      return `New parcel registered: ${payload.plotNumber || payload.parcelId || "—"}`;
    }
    return `Land record update (${type || "general"})`;
  };

  if (loading) {
    return (
      <>
        <div className="public-page">
          <div className="page-center">
            <LoadingSpinner />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    <div className="public-page">
    <div className="blockchain-page">
      <div className="page-header">
        <h1>
          Land Records <span className="gradient-text">Audit Trail</span>
        </h1>
        <p>All ownership changes are permanently recorded for transparency and legal accountability</p>
      </div>

      {/* ── System Status ── */}
      <div className="stats-grid">
        <div className="stat-card stat-card--teal">
          <div className="stat-card__value">
            {summary?.valid ? "🟢 Online" : "🔴 Offline"}
          </div>
          <div className="stat-card__label">System Status</div>
        </div>
        <div className="stat-card stat-card--blue">
          <div className="stat-card__value">
            {summary?.recordCount ?? summary?.blockCount ?? "—"}
          </div>
          <div className="stat-card__label">Total Records</div>
        </div>
        <div className="stat-card stat-card--gold">
          <div className="stat-card__value">🔒</div>
          <div className="stat-card__label">Tamper-Proof</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-card__value">✓</div>
          <div className="stat-card__label">Verified & Signed</div>
        </div>
      </div>

      {/* ── What this is ── */}
      <div className="verify-info glass-card" style={{ marginBottom: 24 }}>
        <h3>ℹ️ What is this page?</h3>
        <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6 }}>
          Every time land ownership changes hands, a permanent, tamper-proof record is created. 
          These records cannot be altered or deleted by anyone — not even system administrators. 
          This ensures full transparency and protects property rights.
        </p>
      </div>

      {/* ── Records ── */}
      <div className="blocks-section">
        <h2>Recorded Ownership Changes</h2>
        {blocks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <h3>No records yet</h3>
            <p>Once land transfers are completed, they will appear here as permanent records.</p>
          </div>
        ) : (
          <div className="blocks-list">
            {blocks.map((block) => (
              <div
                key={block.index}
                className={`block-card glass-card${expandedIdx === block.index ? " block-card--expanded" : ""}`}
              >
                <button
                  className="block-card__header"
                  onClick={() =>
                    setExpandedIdx(
                      expandedIdx === block.index ? null : block.index
                    )
                  }
                >
                  <div className="block-card__main">
                    <span className="block-card__index">
                      Record #{block.index}
                    </span>
                    <span className="block-card__type">
                      {describeRecord(block.payload)}
                    </span>
                    <span className="block-card__time">
                      {block.timestamp
                        ? new Date(
                            block.timestamp * 1000
                          ).toLocaleString("en-PK", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>
                  <span className="block-card__expand">
                    {expandedIdx === block.index ? "▲ Less" : "▼ More"}
                  </span>
                </button>

                {expandedIdx === block.index && (
                  <div className="block-card__body">
                    <div className="block-card__field">
                      <span>Recorded By</span>
                      <code>{block.author || "System"}</code>
                    </div>
                    <div className="block-card__payload">
                      <span>Full Record Details</span>
                      <div className="block-card__details-grid">
                        {Object.entries(block.payload).map(([key, val]) => (
                          <div key={key} className="block-card__detail-row">
                            <span className="block-card__detail-key">
                              {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                            </span>
                            <span className="block-card__detail-val">
                              {typeof val === "object" ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
    </>
  );
}
