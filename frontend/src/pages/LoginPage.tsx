import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { userMatchesPortal, type AuthPortal } from '../utils/authSession';

const portalDetails: Record<AuthPortal, {
  title: string;
  heading: string;
  description: string;
  home: string;
  submitLabel: string;
}> = {
  patient: {
    title: 'Patient Portal',
    heading: 'Sign in to your health account',
    description: 'Sign in to manage your personal health records and care.',
    home: '/dashboard',
    submitLabel: 'Sign in to Patient Portal',
  },
  clinical: {
    title: 'Medical Staff Portal',
    heading: 'Sign in to the clinical workspace',
    description: 'Sign in to track your application. Clinical tools unlock after credential verification and administrator approval.',
    home: '/medical-staff',
    submitLabel: 'Sign in to Clinical Portal',
  },
  insurance: {
    title: 'Insurance Portal',
    heading: 'Sign in to the insurance workspace',
    description: 'Sign in to track your application. Insurance agent access unlocks after credential verification and approval by your insurer.',
    home: '/claims',
    submitLabel: 'Sign in to Insurance Portal',
  },
  insurance_admin: {
    title: 'Insurance Company Administration',
    heading: 'Sign in to your company workspace',
    description: 'Manage agent applications for your approved insurance company.',
    home: '/insurance/company/admin',
    submitLabel: 'Sign in to Company Administration',
  },
  pharmacy: {
    title: 'Pharmacy Organization Portal',
    heading: 'Sign in to manage your MediVault pharmacy',
    description: 'Organization tools unlock after MediVault verifies the registration documents.',
    home: '/pharmacy/manager',
    submitLabel: 'Sign in to Pharmacy Portal',
  },
  lab: {
    title: 'Laboratory Portal',
    heading: 'Sign in to the laboratory workspace',
    description: 'Lab staff access unlocks after laboratory, credential, and membership reviews.',
    home: '/lab/workspace',
    submitLabel: 'Sign in to Laboratory Portal',
  },
  admin: {
    title: 'Administrator Portal',
    heading: 'Administrator sign in',
    description: 'Governance workspace for system administrators.',
    home: '/admin',
    submitLabel: 'Sign in as administrator',
  },
  hospital: {
    title: 'Hospital Administration Portal',
    heading: 'Hospital administrator sign in',
    description: 'Manage the hospitals assigned to your account.',
    home: '/hospital/admin',
    submitLabel: 'Sign in to Hospital Administration',
  },
};

export const LoginPage: React.FC<{ portal: AuthPortal }> = ({ portal }) => {
  const details = portalDetails[portal];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, logout, loading: authLoading, isAuthenticated, user } = useAuth();
  const homePath = portal === 'lab' && ['lab_manager', 'lab_chain_admin'].includes(user?.role || '') ? '/lab/manager' : details.home;
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;
    if (user.mustChangePassword) {
      navigate('/change-password', { replace: true });
      return;
    }
    if (['medical_staff', 'insurance_agent', 'pharmacy_manager', 'lab_manager'].includes(user.role) && (
      user.approvalStatus === 'pending' || user.credentialVerification?.status !== 'verified' ||
      (user.credentialVerification?.expiresAt && new Date(user.credentialVerification.expiresAt) <= new Date()) ||
      (user.role === 'medical_staff' && user.medicalStaffDetails?.professionalType === 'pharmacist' && user.pharmacyMembershipStatus !== 'approved') ||
      (user.role === 'medical_staff' && user.medicalStaffDetails?.professionalType === 'lab_technologist' && user.labMembershipStatus !== 'approved')
    )) {
      navigate('/staff-application', { replace: true });
      return;
    }
    if (userMatchesPortal(user, portal)) {
      navigate(homePath, { replace: true });
      return;
    }
    // Switching portal in the same tab ends the old tab session. Other tabs
    // keep their separate sessionStorage and remain signed in.
    logout();
  }, [authLoading, homePath, isAuthenticated, logout, navigate, portal, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both your email address and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const signedInUser = await login(email, password, portal);
      if (signedInUser.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }
      navigate(portal === 'lab' && ['lab_manager', 'lab_chain_admin'].includes(signedInUser.role) ? '/lab/manager' : details.home);
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Login failed. Please verify your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="login-page-title"
      className="login-layout flex min-h-[calc(100vh-9rem)] items-center justify-center px-4 py-8"
    >
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#914B54] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to portals
        </Link>
        <div className="surface-card p-6 text-center sm:p-8">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#914B54] dark:text-[#DDA6A3]">{details.title}</p>
            <h1 id="login-page-title" className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {details.heading}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{details.description}</p>
          </div>

          {error && (
            <div
              id="login-error"
              role="alert"
              className="mb-3 flex w-full items-start gap-2.5 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 text-center">
            <div>
              <label htmlFor="login-email-input" className="mb-2 block text-left text-sm font-medium text-slate-800 dark:text-slate-200">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <input
                  type="email"
                  id="login-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-500 transition-colors focus:border-[#914B54] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#914B54]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password-input" className="mb-2 block text-left text-sm font-medium text-slate-800 dark:text-slate-200">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-10 pr-14 text-sm text-slate-900 placeholder:text-slate-500 transition-colors focus:border-[#914B54] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#914B54]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                    : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className="button-primary mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : <span>{details.submitLabel}</span>}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          {portal === 'admin' || portal === 'hospital' ? (
            'Administrator accounts are provisioned by the system owner.'
          ) : (
            <>
              {portal === 'patient' ? 'New to MediVault?' : 'Need an account?'}{' '}
              <Link
                to={portal === 'patient' ? '/patient/register' : portal === 'clinical' ? '/clinical/register' : portal === 'insurance' ? '/insurance/register' : portal === 'pharmacy' ? '/pharmacy/register' : '/lab/staff/register'}
                className="font-semibold text-[#914B54] underline-offset-4 hover:underline dark:text-[#DDA6A3]"
              >
                {portal === 'patient'
                  ? 'Create a patient account'
                  : portal === 'clinical'
                    ? 'Apply for medical staff access'
                    : portal === 'lab'
                      ? 'Apply to join a laboratory'
                      : portal === 'pharmacy'
                        ? 'Register a pharmacy or franchise'
                        : 'Apply for insurance access'}
              </Link>
              {portal === 'lab' && <> · <Link to="/lab/register" className="font-semibold text-[#914B54] underline-offset-4 hover:underline dark:text-[#DDA6A3]">Register a laboratory</Link></>}
            </>
          )}
        </p>
      </div>
    </section>
  );
};
