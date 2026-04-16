/* ═══════════════════════════════════════════════════════
   App — Route definitions + context providers
   ═══════════════════════════════════════════════════════ */

import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";

// Components
import Layout from "./components/Layout";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleGuard from "./components/RoleGuard";

// Pages
import LandingPage from "./LandingPage";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import SearchParcels from "./pages/SearchParcels";
import ParcelDetail from "./pages/ParcelDetail";
import VerifyOwnership from "./pages/VerifyOwnership";
import MyTransfers from "./pages/MyTransfers";
import InitiateTransfer from "./pages/InitiateTransfer";
import TransferDetail from "./pages/TransferDetail";
import AdminCreateParcel from "./pages/AdminCreateParcel";
import AdminParcels from "./pages/AdminParcels";
import AdminCreateJudge from "./pages/AdminCreateJudge";
import BlockchainExplorer from "./pages/BlockchainExplorer";
import NotFound from "./pages/NotFound";

import "./styles/app.css";

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Navbar />
        <Routes>
          {/* ── Public routes (no layout shell) ── */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />

          {/* ── Public pages with Navbar ── */}
          <Route path="/search" element={<SearchParcels />} />
          <Route path="/parcels/:parcelId" element={<ParcelDetail />} />
          <Route path="/verify" element={<VerifyOwnership />} />

          {/* ── Protected routes (require authentication) ── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Dashboard — all roles */}
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Transfers — citizen only */}
              <Route element={<RoleGuard allowedRoles={["citizen"]} />}>
                <Route path="/transfers" element={<MyTransfers />} />
                <Route path="/transfers/new" element={<InitiateTransfer />} />
                <Route
                  path="/transfers/:transferId"
                  element={<TransferDetail />}
                />
              </Route>

              {/* Admin-only routes */}
              <Route element={<RoleGuard allowedRoles={["admin"]} />}>
                <Route path="/admin/parcels" element={<AdminParcels />} />
                <Route
                  path="/admin/parcels/new"
                  element={<AdminCreateParcel />}
                />
                <Route
                  path="/admin/users/judge"
                  element={<AdminCreateJudge />}
                />
              </Route>
            </Route>
          </Route>

          {/* ── Audit Trail — admin + judge only (outside layout) ── */}
          <Route path="/blockchain" element={<BlockchainExplorer />} />

          {/* ── 404 ── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
