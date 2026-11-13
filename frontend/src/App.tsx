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
import { PatientPortalLayout } from './components/PatientPortalLayout';
import { ClinicalAccessRoute, ProfessionalTypeRoute, ProtectedRoute, RoleRoute } from './components/ProtectedRoute';
import { UploadModal } from './components/UploadModal';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { InsuranceCompanyRegisterPage } from './pages/InsuranceCompanyRegisterPage';
import { InsuranceCompanyAdminPage } from './pages/InsuranceCompanyAdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { RecordsPage } from './pages/RecordsPage';
import { RecordViewerPage } from './pages/RecordViewerPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ClaimsPage } from './pages/ClaimsPage';
import { CaregiversPage } from './pages/CaregiversPage';
import { PatientLandingPage } from './pages/PatientLandingPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { StaffApplicationPage } from './pages/StaffApplicationPage';
const PharmacyPage = React.lazy(() =>
  import('./pages/PharmacyPage').then((page) => ({ default: page.PharmacyPage }))
);
const PharmacyOrganizationRegisterPage = React.lazy(() =>
  import('./pages/PharmacyOrganizationRegisterPage').then((page) => ({ default: page.PharmacyOrganizationRegisterPage }))
);
const PharmacyOrganizationManagerPage = React.lazy(() =>
  import('./pages/PharmacyOrganizationManagerPage').then((page) => ({ default: page.PharmacyOrganizationManagerPage }))
);
const LabOrganizationRegisterPage = React.lazy(() =>
  import('./pages/LabOrganizationRegisterPage').then((page) => ({ default: page.LabOrganizationRegisterPage }))
);
const LabOrganizationManagerPage = React.lazy(() =>
  import('./pages/LabOrganizationManagerPage').then((page) => ({ default: page.LabOrganizationManagerPage }))
);
const LabStaffPage = React.lazy(() =>
  import('./pages/LabStaffPage').then((page) => ({ default: page.LabStaffPage }))
);
const LabPatientPage = React.lazy(() =>
  import('./pages/LabPatientPage').then((page) => ({ default: page.LabPatientPage }))
);
const MedicalStaffPage = React.lazy(() =>
  import('./pages/MedicalStaffPage').then((page) => ({ default: page.MedicalStaffPage }))
);
const AppointmentsPage = React.lazy(() =>
  import('./pages/AppointmentsPage').then((page) => ({ default: page.AppointmentsPage }))
);
const PatientClinicalFilePage = React.lazy(() =>
  import('./pages/PatientClinicalFilePage').then((page) => ({
    default: page.PatientClinicalFilePage,
  }))
);
const AdminPage = React.lazy(() =>
  import('./pages/AdminPage').then((page) => ({ default: page.AdminPage }))
);
const HospitalManagementPage = React.lazy(() => import('./pages/HospitalManagementPage').then((page) => ({ default: page.HospitalManagementPage })));
const ChangePasswordPage = React.lazy(() => import('./pages/ChangePasswordPage').then((page) => ({ default: page.ChangePasswordPage })));
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
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;

  if (['medical_staff', 'insurance_agent', 'pharmacy_manager', 'lab_manager'].includes(user.role) && (
    user.approvalStatus === 'pending' || user.credentialVerification?.status !== 'verified' ||
    (user.credentialVerification?.expiresAt && new Date(user.credentialVerification.expiresAt) <= new Date()) ||
    (user.role === 'medical_staff' && user.medicalStaffDetails?.professionalType === 'pharmacist' && user.pharmacyMembershipStatus !== 'approved') ||
    (user.role === 'medical_staff' && user.medicalStaffDetails?.professionalType === 'lab_technologist' && user.labMembershipStatus !== 'approved')
  )) return <Navigate to="/staff-application" replace />;

  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'hospital_admin':
      return <Navigate to="/hospital/admin" replace />;
    case 'insurance_agent':
      return <Navigate to="/claims" replace />;
    case 'insurer_admin':
      return <Navigate to="/insurance/company/admin" replace />;
    case 'pharmacy_manager':
      return <Navigate to="/pharmacy/manager" replace />;
    case 'lab_manager':
    case 'lab_chain_admin':
      return <Navigate to="/lab/manager" replace />;
    case 'pharmacy_chain_admin':
      return <Navigate to="/pharmacy/manager" replace />;
    case 'medical_staff':
      if (user.medicalStaffDetails?.professionalType === 'lab_technologist') return <Navigate to="/lab/workspace" replace />;
      return <Navigate to={user.medicalStaffDetails?.professionalType === 'pharmacist' ? '/pharmacy' : '/medical-staff'} replace />;
    case 'patient':
    default:
      return <Navigate to="/dashboard" replace />;
  }
};

// Main App Layout Wrapper
const AppLayout: React.FC = () => {
  const [globalUploadOpen, setGlobalUploadOpen] = useState(false);
  const location = useLocation();
  const isRecordViewer = /^\/records\/[^/]+\/view$/.test(location.pathname);

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
        {!isRecordViewer && <Navbar onOpenUpload={() => setGlobalUploadOpen(true)} />}

        <main className="flex-1">
          <Outlet />
        </main>

        {/* Global Upload Modal */}
        {!isRecordViewer && (
          <UploadModal
            isOpen={globalUploadOpen}
            onClose={() => setGlobalUploadOpen(false)}
            onUploadSuccess={handleUploadSuccess}
          />
        )}

        {!isRecordViewer && (
          <footer className="app-footer border-t py-5 text-xs text-slate-500 transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="app-footer__brand">MediVault</span>
                <span>•</span>
                <span>Health records and care access</span>
              </div>
              <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-xs">
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Access controls active
                </span>
              </div>
            </div>
          </footer>
        )}
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
              <Route path="/login" element={<Navigate to="/portals" replace />} />
              <Route path="/register" element={<Navigate to="/portals" replace />} />
              <Route path="/patient/login" element={<LoginPage portal="patient" />} />
              <Route path="/clinical/login" element={<LoginPage portal="clinical" />} />
              <Route path="/insurance/login" element={<LoginPage portal="insurance" />} />
              <Route path="/insurance/admin/login" element={<LoginPage portal="insurance_admin" />} />
              <Route path="/pharmacy/login" element={<LoginPage portal="pharmacy" />} />
              <Route path="/lab/login" element={<LoginPage portal="lab" />} />
              <Route path="/admin/login" element={<LoginPage portal="admin" />} />
              <Route path="/hospital/login" element={<LoginPage portal="hospital" />} />
              <Route path="/patient/register" element={<RegisterPage portal="patient" />} />
              <Route path="/clinical/register" element={<RegisterPage portal="clinical" />} />
              <Route path="/insurance/register" element={<RegisterPage portal="insurance" />} />
              <Route path="/insurance/company/register" element={<InsuranceCompanyRegisterPage />} />
              <Route path="/pharmacy/register" element={<React.Suspense fallback={<PageLoading />}><PharmacyOrganizationRegisterPage /></React.Suspense>} />
              <Route path="/lab/register" element={<React.Suspense fallback={<PageLoading />}><LabOrganizationRegisterPage /></React.Suspense>} />
              <Route path="/lab/staff/register" element={<RegisterPage portal="lab" />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/staff-application" element={<StaffApplicationPage />} />
                <Route path="/records/:recordId/view" element={<RecordViewerPage />} />
                <Route element={<PatientPortalLayout />}>
                  <Route element={<RoleRoute roles={['patient', 'medical_staff', 'insurance_agent', 'insurer_admin', 'pharmacy_manager', 'pharmacy_chain_admin', 'lab_manager', 'lab_chain_admin', 'hospital_admin', 'admin']} />}>
                    <Route path="/profile" element={<ProfilePage />} />
                  </Route>
                  <Route element={<RoleRoute roles={['patient', 'medical_staff', 'admin']} />}>
                    <Route element={<ClinicalAccessRoute />}>
                    <Route
                      path="/access-requests"
                      element={
                        <React.Suspense fallback={<PageLoading />}>
                          <AccessRequestsPage />
                        </React.Suspense>
                      }
                    />
                    </Route>
                  </Route>
                  <Route
                    element={
                      <RoleRoute roles={['patient', 'medical_staff', 'admin', 'insurance_agent', 'insurer_admin', 'pharmacy_manager', 'pharmacy_chain_admin', 'lab_manager', 'lab_chain_admin']} />
                    }
                  >
                    <Route path="/audit-logs" element={<AuditLogsPage />} />
                  </Route>
                  <Route element={<RoleRoute roles={['patient', 'insurance_agent', 'insurer_admin']} />}>
                    <Route path="/claims" element={<ClaimsPage />} />
                  </Route>
                  <Route element={<RoleRoute roles={['insurer_admin']} />}>
                    <Route path="/insurance/company/admin" element={<InsuranceCompanyAdminPage />} />
                  </Route>
                  <Route element={<RoleRoute roles={['patient']} />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/pharmacy" element={<React.Suspense fallback={<PageLoading />}><PharmacyPage /></React.Suspense>} />
                    <Route path="/labs" element={<React.Suspense fallback={<PageLoading />}><LabPatientPage /></React.Suspense>} />
                    <Route path="/appointments" element={<React.Suspense fallback={<PageLoading />}><AppointmentsPage /></React.Suspense>} />
                    <Route path="/policies" element={<PoliciesPage />} />
                    <Route path="/records" element={<RecordsPage />} />
                    <Route
                      path="/prescriptions"
                      element={
                        <React.Suspense fallback={<PageLoading />}>
                          <MedicalStaffPage />
                        </React.Suspense>
                      }
                    />
                    <Route path="/caregivers" element={<CaregiversPage />} />
                  </Route>
                  <Route element={<RoleRoute roles={['pharmacy_manager', 'pharmacy_chain_admin']} />}>
                    <Route path="/pharmacy/manager" element={<React.Suspense fallback={<PageLoading />}><PharmacyOrganizationManagerPage /></React.Suspense>} />
                  </Route>
                  <Route element={<RoleRoute roles={['lab_manager', 'lab_chain_admin']} />}>
                    <Route path="/lab/manager" element={<React.Suspense fallback={<PageLoading />}><LabOrganizationManagerPage /></React.Suspense>} />
                  </Route>
                  <Route element={<RoleRoute roles={['medical_staff']} />}>
                    <Route element={<ProfessionalTypeRoute types={['lab_technologist']} />}>
                      <Route path="/lab/workspace" element={<React.Suspense fallback={<PageLoading />}><LabStaffPage /></React.Suspense>} />
                    </Route>
                    <Route element={<ProfessionalTypeRoute types={['pharmacist']} />}>
                      <Route path="/pharmacy" element={<React.Suspense fallback={<PageLoading />}><PharmacyPage /></React.Suspense>} />
                    </Route>
                    <Route element={<ProfessionalTypeRoute types={['physician']} />}>
                    <Route
                      path="/medical-staff/appointments"
                      element={
                        <React.Suspense fallback={<PageLoading />}>
                          <AppointmentsPage />
                        </React.Suspense>
                      }
                    />
                    </Route>
                    <Route element={<ProfessionalTypeRoute types={['physician', 'nurse']} />}>
                      <Route
                        path="/medical-staff"
                        element={
                          <React.Suspense fallback={<PageLoading />}>
                            <MedicalStaffPage />
                          </React.Suspense>
                        }
                      />
                    </Route>
                    <Route element={<ProfessionalTypeRoute types={['physician']} />}>
                    <Route
                      path="/medical-staff/patients/:patientId"
                      element={
                        <React.Suspense fallback={<PageLoading />}>
                          <PatientClinicalFilePage />
                        </React.Suspense>
                      }
                    />
                    </Route>
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
                  <Route element={<RoleRoute roles={['admin', 'hospital_admin']} />}>
                    <Route path="/hospital/admin" element={<React.Suspense fallback={<PageLoading />}><HospitalManagementPage /></React.Suspense>} />
                  </Route>
                </Route>
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="/change-password" element={<React.Suspense fallback={<PageLoading />}><ChangePasswordPage /></React.Suspense>} />
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
