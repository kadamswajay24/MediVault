import React, { useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UploadModal } from './components/UploadModal';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { RecordsPage } from './pages/RecordsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ClaimsPage } from './pages/ClaimsPage';
import { CaregiversPage } from './pages/CaregiversPage';
import { MedicalStaffPage } from './pages/MedicalStaffPage';
import { AdminPage } from './pages/AdminPage';

// Smart Home Redirect based on Authenticated Role
const RoleBasedHomeRedirect: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'insurance_agent':
      return <Navigate to="/claims" replace />;
    case 'medical_staff':
      return <Navigate to="/medical-staff" replace />;
    case 'patient':
    default:
      return <Navigate to="/dashboard" replace />;
  }
};

// Main App Layout Wrapper
const AppLayout: React.FC = () => {
  const [globalUploadOpen, setGlobalUploadOpen] = useState(false);
  const location = useLocation();

  const handleUploadSuccess = () => {
    setGlobalUploadOpen(false);
    if (location.pathname === '/records' || location.pathname === '/dashboard') {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Clean enterprise background grid */}
      <div className="fixed inset-0 pointer-events-none z-0 enterprise-grid opacity-70" />

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        <Navbar onOpenUpload={() => setGlobalUploadOpen(true)} />

        <main className="flex-1">
          <Outlet />
        </main>

        {/* Global Upload Modal */}
        <UploadModal
          isOpen={globalUploadOpen}
          onClose={() => setGlobalUploadOpen(false)}
          onUploadSuccess={handleUploadSuccess}
        />

        {/* Crisp Enterprise Healthcare Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950/80 py-5 text-xs text-slate-500 transition-colors duration-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">MediVault Enterprise</span>
              <span>•</span>
              <span>Role-Based Health Records &amp; Insurance Adjudication System</span>
            </div>
            <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                RBAC Active
              </span>
              <span>Dual-Context Proxy</span>
              <span>HIPAA Compliant</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// Top-level root component
export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route element={<AppLayout />}>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/records" element={<RecordsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/claims" element={<ClaimsPage />} />
                <Route path="/caregivers" element={<CaregiversPage />} />
                <Route path="/medical-staff" element={<MedicalStaffPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/audit-logs" element={<AuditLogsPage />} />
              </Route>

              {/* Smart Fallback Redirects */}
              <Route path="/" element={<RoleBasedHomeRedirect />} />
              <Route path="*" element={<RoleBasedHomeRedirect />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
