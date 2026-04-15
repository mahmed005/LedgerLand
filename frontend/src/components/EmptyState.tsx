/* EmptyState — Centered message for empty lists */

interface Props {
  icon?: string;
  title: string;
  message?: string;
  children?: React.ReactNode;
}

export default function EmptyState({
  icon = "📋",
  title,
  message,
  children,
}: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {children}
    </div>
  );
}
