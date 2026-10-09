import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Mail,
  Lock,
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
    description: 'Secure workspace for approved clinicians and hospital staff.',
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
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex p-2.5 rounded-xl bg-emerald-600 text-white mb-2 shadow-sm">
            <ShieldCheck className="w-6 h-6 stroke-[2.4]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {details.title}
          </h1>
          <p className="text-xs text-slate-500">
            {details.description}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  id="login-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@medivault.io"
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  id="login-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500">
          Need a new account?{' '}
          <Link
            to={portal === 'patient' ? '/patient/register' : '/organization/register'}
            className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
          >
            {portal === 'patient' ? 'Create a patient account' : 'Apply for organization access'}
          </Link>
        </p>
        <p className="text-center text-xs text-slate-500">
          <Link
            to={portal === 'patient' ? '/' : '/organization'}
            className="font-semibold text-slate-600 dark:text-slate-300 hover:underline"
          >
            {portal === 'patient' ? 'Back to patient home' : 'Back to organization access'}
          </Link>
        </p>
      </div>
    </div>
  );
};
