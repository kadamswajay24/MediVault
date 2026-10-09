import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  User,
  Users,
  Stethoscope,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

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
      await login(email, password);
      // Smart redirect
      const savedUser = localStorage.getItem('medivault_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u.role === 'admin') navigate('/admin');
        else if (u.role === 'insurance_agent') navigate('/claims');
        else if (u.role === 'medical_staff') navigate('/medical-staff');
        else navigate('/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Login failed. Please verify your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const personas = [
    {
      id: 'patient',
      role: 'Patient',
      name: 'Rohan Verma',
      email: 'patient@medivault.io',
      icon: User,
      color: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20',
      desc: 'Vault owner, records & claims',
    },
    {
      id: 'caregiver',
      role: 'Caregiver Proxy',
      name: 'Priya Verma',
      email: 'caregiver@medivault.io',
      icon: Users,
      color: 'border-teal-500/40 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/20',
      desc: 'Dual-context parent manager',
    },
    {
      id: 'doctor',
      role: 'Medical Staff',
      name: 'Dr. Sameer',
      email: 'doctor@medivault.io',
      icon: Stethoscope,
      color: 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20',
      desc: 'Cardiologist, Rx & notes',
    },
    {
      id: 'agent',
      role: 'Insurance Agent',
      name: 'Vikram Mehta',
      email: 'agent@medivault.io',
      icon: FileCheck2,
      color: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
      desc: 'Star Health claim adjuster',
    },
    {
      id: 'admin',
      role: 'Administrator',
      name: 'Chief Admin',
      email: 'admin@medivault.io',
      icon: ShieldCheck,
      color: 'border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20',
      desc: 'User directory & governance',
    },
  ];

  const handleSelectPersona = (p: typeof personas[0]) => {
    setSelectedPersona(p.id);
    setEmail(p.email);
    setPassword('Password@2026');
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
            MediVault Enterprise Access
          </h1>
          <p className="text-xs text-slate-500">
            Role-Based Health Records Management &amp; Claims Verification System
          </p>
        </div>

        {/* 1-Click Stakeholder Demo Switcher */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            1-Click Demo Personas (Select to test any role)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {personas.map((p) => {
              const Icon = p.icon;
              const isSelected = selectedPersona === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPersona(p)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white truncate">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                    <span className="truncate">{p.role}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{p.name}</div>
                </button>
              );
            })}
          </div>
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
            to="/register"
            className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
          >
            Register with Role Selection
          </Link>
        </p>
      </div>
    </div>
  );
};
