import React, { useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';
import { UploadModal } from './components/UploadModal';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { RecordsPage } from './pages/RecordsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ClaimsPage } from './pages/ClaimsPage';
import { CaregiversPage } from './pages/CaregiversPage';
import { OrganizationPortalPage } from './pages/OrganizationPortalPage';
import { PatientLandingPage } from './pages/PatientLandingPage';
const MedicalStaffPage = React.lazy(() =>
  import('./pages/MedicalStaffPage').then((page) => ({ default: page.MedicalStaffPage }))
);
const AdminPage = React.lazy(() =>
  import('./pages/AdminPage').then((page) => ({ default: page.AdminPage }))
);
const AccessRequestsPage = React.lazy(() =>
  import('./pages/AccessRequestsPage').then((page) => ({ default: page.AccessRequestsPage }))
);

const PageLoading: React.FC = () => (
  <div className="py-20 text-center text-sm text-slate-500">Loading workspace...</div>
);

// Smart Home Redirect based on Authenticated Role
const RoleBasedHomeRedirect: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated || !user) return <PatientLandingPage />;

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
    <div className="app-shell min-h-screen relative flex flex-col text-slate-900 dark:text-slate-100 transition-colors duration-200">
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

        <footer className="app-footer border-t py-5 text-xs text-slate-500 transition-colors duration-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">MediVault</span>
              <span>•</span>
              <span>Your health records, on your terms.</span>
            </div>
            <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Access controls active
              </span>
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
              <Route path="/portals" element={<Navigate to="/" replace />} />
              <Route path="/organization" element={<OrganizationPortalPage />} />
              <Route path="/login" element={<Navigate to="/portals" replace />} />
              <Route path="/register" element={<Navigate to="/portals" replace />} />
              <Route path="/patient/login" element={<LoginPage portal="patient" />} />
              <Route path="/clinical/login" element={<LoginPage portal="clinical" />} />
              <Route path="/insurance/login" element={<LoginPage portal="insurance" />} />
              <Route path="/patient/register" element={<RegisterPage portal="patient" />} />
              <Route
                path="/organization/register"
                element={<RegisterPage portal="organization" />}
              />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<RoleRoute roles={['patient', 'medical_staff', 'admin']} />}>
                  <Route
                    path="/access-requests"
                    element={
                      <React.Suspense fallback={<PageLoading />}>
                        <AccessRequestsPage />
                      </React.Suspense>
                    }
                  />
                </Route>
                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route element={<RoleRoute roles={['patient', 'insurance_agent']} />}>
                  <Route path="/claims" element={<ClaimsPage />} />
                </Route>
                <Route element={<RoleRoute roles={['patient']} />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/records" element={<RecordsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/caregivers" element={<CaregiversPage />} />
                </Route>
                <Route element={<RoleRoute roles={['medical_staff']} />}>
                  <Route
                    path="/medical-staff"
                    element={
                      <React.Suspense fallback={<PageLoading />}>
                        <MedicalStaffPage />
                      </React.Suspense>
                    }
                  />
                </Route>
                <Route element={<RoleRoute roles={['admin']} />}>
                  <Route
                    path="/admin"
                    element={
                      <React.Suspense fallback={<PageLoading />}>
                        <AdminPage />
                      </React.Suspense>
                    }
                  />
                </Route>
              </Route>

              {/* Smart Fallback Redirects */}
              <Route path="/" element={<RoleBasedHomeRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
