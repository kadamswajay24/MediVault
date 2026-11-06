import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-700 dark:text-emerald-400" />
        <p className="text-sm">Verifying MediVault session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const isLimitedStaff = Boolean(user && ['medical_staff', 'insurance_agent'].includes(user.role) && (
    user.approvalStatus === 'pending' ||
    user.credentialVerification?.status !== 'verified' ||
    (user.credentialVerification?.expiresAt && new Date(user.credentialVerification.expiresAt) <= new Date())
  ));
  if (isLimitedStaff && location.pathname !== '/staff-application') {
    return <Navigate to="/staff-application" replace />;
  }

  return <Outlet />;
};

export const RoleRoute: React.FC<{ roles: string[] }> = ({ roles }) => {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
