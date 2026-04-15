/* ═══════════════════════════════════════════════════════
   RoleGuard — Restricts access by user role
   ═══════════════════════════════════════════════════════ */

import { Outlet } from "react-router-dom";
import { useAuth, type User } from "../context/AuthContext";

interface Props {
  allowedRoles: User["role"][];
}

export default function RoleGuard({ allowedRoles }: Props) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="page-center">
        <div className="empty-state">
          <div className="empty-state__icon">🔒</div>
          <h2>Access Denied</h2>
          <p>You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
