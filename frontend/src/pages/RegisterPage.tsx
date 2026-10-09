import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  User,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  Stethoscope,
  FileCheck2,
  Phone,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import type { UserRole } from '../types';

type RegistrationPortal = 'patient' | 'organization';

export const RegisterPage: React.FC<{ portal: RegistrationPortal }> = ({ portal }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(portal === 'patient' ? 'patient' : 'medical_staff');
  const isPatientPortal = portal === 'patient';
  const signInPath = isPatientPortal
    ? '/patient/login'
    : role === 'insurance_agent'
    ? '/insurance/login'
    : '/clinical/login';

  // Role details
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [hospitalAffiliation, setHospitalAffiliation] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [agentId, setAgentId] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrationPending, setRegistrationPending] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handlePhoneChange = (value: string) => {
    const formattedNumber = value.trim().replace(/[\s()-]/g, '');
    const internationalNumber = formattedNumber.match(/^\+?91([6-9]\d{9})$/);
    const digits = value.replace(/\D/g, '');
    setPhone(internationalNumber ? internationalNumber[1] : digits.slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        phone: `+91${phone}`,
        medicalStaffDetails:
          role === 'medical_staff'
            ? { licenseNumber, specialization, hospitalAffiliation }
            : undefined,
        insuranceDetails:
          role === 'insurance_agent'
            ? { companyName, agentId, licenseNumber }
            : undefined,
      });

      if (result.pendingApproval) {
        setRegistrationPending(true);
        return;
      }

      if (role === 'insurance_agent') navigate('/claims');
      else if (role === 'medical_staff') navigate('/medical-staff');
      else navigate('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Registration failed. Please check your information.'
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
          <div className="inline-flex p-2.5 rounded-xl bg-emerald-500 text-slate-950 mb-2 shadow-sm">
            <ShieldCheck className="w-6 h-6 stroke-[2.4]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isPatientPortal ? 'Create a Patient Account' : 'Apply for Organization Access'}
          </h1>
          <p className="text-xs text-slate-500">
            {isPatientPortal
              ? 'Create your personal account to manage your health records and care.'
              : 'Choose your professional role. All organization accounts require administrator approval.'}
          </p>
        </div>

        {registrationPending ? (
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Application submitted for review
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Your staff account will be available after an administrator approves your
              application. You can sign in once your access is approved.
            </p>
            <Link
              to={signInPath}
              className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Return to sign in <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
        /* Card Form */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Organization applications choose between clinical and insurance roles. */}
            {!isPatientPortal && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Stakeholder Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('medical_staff')}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    role === 'medical_staff'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Stethoscope className="w-4 h-4 mb-1 text-blue-600" />
                  <div>Doctor</div>
                  <div className="text-[10px] text-slate-400 font-normal">Clinician</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('insurance_agent')}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    role === 'insurance_agent'
                      ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4 mb-1 text-amber-600" />
                  <div>Insurer</div>
                  <div className="text-[10px] text-slate-400 font-normal">Adjuster</div>
                </button>
              </div>
            </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <span className="absolute left-9 top-1/2 -translate-y-1/2 border-r border-slate-300 pr-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
                    +91
                  </span>
                  <input
                      type="tel"
                      required
                      inputMode="numeric"
                      autoComplete="tel-national"
                      pattern="[6-9][0-9]{9}"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="9876543210"
                      aria-label="10-digit Indian mobile number"
                      title="Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9."
                      className="w-full pl-[4.4rem] pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Medical Staff Specific Fields */}
            {role === 'medical_staff' && (
              <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 space-y-2.5">
                <span className="text-[11px] font-bold uppercase text-blue-600 dark:text-blue-400 block">
                  Clinician Credentials
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Medical License # (e.g. MCI-MH-992)"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded"
                  />
                  <input
                    type="text"
                    placeholder="Specialization (e.g. Cardiologist)"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Hospital / Clinic Affiliation"
                  value={hospitalAffiliation}
                  onChange={(e) => setHospitalAffiliation(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded text-xs"
                />
              </div>
            )}

            {/* Insurance Agent Specific Fields */}
            {role === 'insurance_agent' && (
              <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 space-y-2.5">
                <span className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400 block">
                  Insurance Provider Affiliation
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Insurance Company (e.g. Star Health)"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded"
                  />
                  <input
                    type="text"
                    placeholder="Agent Identifier / Code"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="button-primary w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Complete Registration</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
        )}

        <p className="text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link
            to={signInPath}
            className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
          >
            Sign in to your portal
          </Link>
        </p>
      </div>
    </div>
  );
};
