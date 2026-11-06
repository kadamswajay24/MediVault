import React, { useState } from 'react';
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
import type { UserRole } from '../types';

type LoginPortal = 'patient' | 'clinical' | 'insurance' | 'admin';

const portalDetails: Record<LoginPortal, {
  title: string;
  description: string;
  roles: UserRole[];
  home: Record<UserRole, string>;
}> = {
  patient: {
    title: 'Patient Portal',
    description: 'Sign in to manage your personal health records and care.',
    roles: ['patient'],
    home: { patient: '/dashboard', medical_staff: '/medical-staff', insurance_agent: '/claims', admin: '/admin' },
  },
  clinical: {
    title: 'Medical Staff Portal',
    description: 'Workspace for approved clinicians and hospital staff.',
    roles: ['medical_staff'],
    home: { patient: '/dashboard', medical_staff: '/medical-staff', insurance_agent: '/claims', admin: '/admin' },
  },
  insurance: {
    title: 'Insurance Portal',
    description: 'Claims workspace for approved insurance staff.',
    roles: ['insurance_agent'],
    home: { patient: '/dashboard', medical_staff: '/medical-staff', insurance_agent: '/claims', admin: '/admin' },
  },
  admin: {
    title: 'Administrator Portal',
    description: 'Governance workspace for system administrators.',
    roles: ['admin'],
    home: { patient: '/dashboard', medical_staff: '/medical-staff', insurance_agent: '/claims', admin: '/admin' },
  },
};

export const LoginPage: React.FC<{ portal: LoginPortal }> = ({ portal }) => {
  const details = portalDetails[portal];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both your email address and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await login(email, password, details.roles);
      navigate(details.home[user.role]);
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
        <div className="surface-card p-6 sm:p-8">
          <div className="mb-6">
            <h1 id="login-page-title" className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {portal === 'patient' ? 'Sign in' : `Sign in to ${details.title}`}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {portal === 'patient'
                ? 'Sign in to access your health records.'
                : details.description}
            </p>
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email-input" className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-200">
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
              <label htmlFor="login-password-input" className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-200">
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
              ) : <span>Sign in</span>}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          {portal === 'admin' ? (
            'Administrator accounts are provisioned by the system owner.'
          ) : (
            <>
              {portal === 'patient' ? 'New to MediVault?' : 'Need an account?'}{' '}
              <Link
                to={portal === 'patient' ? '/patient/register' : portal === 'clinical' ? '/clinical/register' : '/insurance/register'}
                className="font-semibold text-[#914B54] underline-offset-4 hover:underline dark:text-[#DDA6A3]"
              >
                {portal === 'patient'
                  ? 'Create a patient account'
                  : portal === 'clinical'
                    ? 'Apply for medical staff access'
                    : 'Apply for insurance access'}
              </Link>
            </>
          )}
        </p>
      </div>
    </section>
  );
};
