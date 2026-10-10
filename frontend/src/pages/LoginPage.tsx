import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import type { UserRole } from '../types';

type LoginPortal = 'patient' | 'clinical' | 'insurance';

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
    title: 'Insurance & Governance Portal',
    description: 'Claims workspace for insurers and governance tools for administrators.',
    roles: ['insurance_agent', 'admin'],
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
      className="login-layout flex flex-col items-center justify-start px-4 py-6 sm:min-h-[calc(100vh-10rem)] sm:justify-center sm:py-10"
    >
      <div className="w-full max-w-md space-y-5 sm:space-y-7">
        <div className="text-center">
          <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20 sm:mb-4 sm:h-12 sm:w-12">
            <ShieldCheck className="h-6 w-6 stroke-[2.2]" aria-hidden="true" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
            {portal === 'patient' ? 'Your personal health space' : details.title}
          </p>
          <h1
            id="login-page-title"
            className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-[2rem]"
          >
            {portal === 'patient' ? 'Your health. Your records. Your control.' : 'Sign in to continue'}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
            {portal === 'patient'
              ? 'Access your health records and manage who can see them.'
              : details.description}
          </p>
        </div>

        <section className="surface-card p-6 sm:p-8" aria-labelledby="login-card-title">
          <div className="mb-6">
            <h2 id="login-card-title" className="text-xl font-semibold text-slate-900 dark:text-white">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {portal === 'patient'
                ? 'Sign in to continue to your personal health space.'
                : 'Sign in with your approved account to continue.'}
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
                Email Address
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
                  className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-500 transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
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
                  className="h-12 w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-10 pr-14 text-sm text-slate-900 placeholder:text-slate-500 transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
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
              className="button-primary mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>{portal === 'patient' ? 'Sign in securely' : 'Sign in'}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </section>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          {portal === 'patient' ? 'New to MediVault?' : 'Need a new account?'}{' '}
          <Link
            to={portal === 'patient' ? '/patient/register' : '/organization/register'}
            className="font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            {portal === 'patient' ? 'Create a patient account' : 'Apply for organization access'}
          </Link>
        </p>
        <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-600 dark:text-slate-400">
          <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          Privacy-first access to your health records.
        </p>
        <p className="text-center text-xs text-slate-600 dark:text-slate-400">
          <Link
            to={portal === 'patient' ? '/' : '/organization'}
            className="font-medium underline-offset-4 hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
          >
            {portal === 'patient' ? 'Back to patient home' : 'Back to organization access'}
          </Link>
        </p>
      </div>
    </section>
  );
};
