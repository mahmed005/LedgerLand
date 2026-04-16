/* StatusBadge — Colored pill for transfer/parcel status */

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_buyer: { label: "Pending Buyer", color: "var(--ll-gold)" },
  pending_nadra: { label: "Pending NADRA", color: "var(--ll-blue)" },
  completed: { label: "Completed", color: "var(--ll-green)" },
  nadra_failed: { label: "NADRA Failed", color: "var(--ll-rose)" },
  rejected: { label: "Rejected", color: "var(--ll-rose)" },
  disputed: { label: "Disputed", color: "var(--ll-rose)" },
  active: { label: "Active", color: "var(--ll-green)" },
};

interface Props {
  status: string;
}

export default function StatusBadge({ status }: Props) {
  const info = STATUS_MAP[status] ?? {
    label: status,
    color: "var(--ll-text)",
  };

  return (
    <span
      className="status-badge"
      style={
        {
          "--badge-color": info.color,
        } as React.CSSProperties
      }
    >
      <span className="status-badge__dot" />
      {info.label}
    </span>
  );
}
