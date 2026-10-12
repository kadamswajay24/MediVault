import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  Check,
  CreditCard,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { policyAPI } from '../services/api';
import type { InsurancePolicyPlan, PolicyEnrollment } from '../types';

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(date)
  );

export const PoliciesPage: React.FC = () => {
  const [plans, setPlans] = useState<InsurancePolicyPlan[]>([]);
  const [policies, setPolicies] = useState<PolicyEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const loadPolicies = useCallback(async () => {
    try {
      const [planResponse, policyResponse] = await Promise.all([
        policyAPI.getPlans(),
        policyAPI.getMyPolicies(),
      ]);
      setError(null);
      setPlans(planResponse.plans);
      setPolicies(policyResponse.policies);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'Unable to load policy options. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPolicies();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPolicies]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleEnroll = async (plan: InsurancePolicyPlan) => {
    setBusyId(plan.id);
    setError(null);
    setNotice(null);
    try {
      const response = await policyAPI.enroll(plan.id);
      setPolicies((current) => [response.policy, ...current]);
      setNotice(response.message);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'Unable to create the demo enrollment. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePayment = async (policy: PolicyEnrollment) => {
    setBusyId(policy._id);
    setError(null);
    setNotice(null);
    try {
      const response = await policyAPI.payMonthlyPremium(policy._id);
      setPolicies((current) =>
        current.map((item) => (item._id === policy._id ? response.policy : item))
      );
      setNotice(response.message);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'Unable to record the demo premium payment. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-sm text-slate-500">Loading policy options...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="flex flex-col gap-2 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-500" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Health Insurance Policies
          </h1>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Compare illustrative plans, keep your enrollments together, and review monthly premiums.
        </p>
      </header>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <strong>Demo marketplace:</strong> Plans and prices are examples only. Enrolling does not
        create insurance coverage. Monthly premium actions are simulated; no money is charged.
      </div>

      {error && (
        <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-600 dark:text-rose-400 text-sm flex items-center justify-between gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadPolicies();
            }}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-300 text-sm">
          {notice}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Explore plans</h2>
          <p className="text-xs text-slate-500 mt-1">Example monthly pricing in Indian rupees.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const alreadyEnrolled = policies.some((policy) => policy.planId === plan.id);
            return (
              <article key={plan.id} className="surface-card p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400">
                      {plan.provider}
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{plan.description}</p>
                <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                  <p className="text-xs text-slate-500">Example cover amount</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{formatINR(plan.coverageAmount)}</p>
                </div>
                <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  {plan.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {highlight}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-5">
                  <p className="mb-3 text-sm">
                    <strong className="text-xl text-slate-900 dark:text-white">{formatINR(plan.monthlyPremium)}</strong>
                    <span className="text-slate-500"> / month</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleEnroll(plan)}
                    disabled={alreadyEnrolled || busyId !== null}
                    className="button-primary w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {busyId === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                    {alreadyEnrolled ? 'Added to My Policies' : 'Explore & Enroll (Demo)'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">My policies</h2>
            <p className="text-xs text-slate-500 mt-1">Your demo enrollments and simulated monthly payments.</p>
          </div>
          <span className="text-xs text-slate-500">{policies.length} {policies.length === 1 ? 'policy' : 'policies'}</span>
        </div>
        {policies.length === 0 ? (
          <div className="surface-card p-8 text-center">
            <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No policies added yet</p>
            <p className="text-xs text-slate-500 mt-1">Choose an example plan above to see it here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {policies.map((policy) => {
              const premiumDue = Date.parse(policy.nextPremiumDue) <= currentTime;
              return (
              <article key={policy._id} className="surface-card p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-white">{policy.planName}</h3>
                      <span className="px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-semibold dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        DEMO ONLY
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{policy.provider} · Ref: {policy.policyNumber}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {formatINR(policy.monthlyPremium)} monthly · {formatINR(policy.coverageAmount)} example cover
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarClock className="w-3.5 h-3.5" />
                      Next premium date: {formatDate(policy.nextPremiumDue)}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {policy.payments.length} simulated {policy.payments.length === 1 ? 'payment' : 'payments'} recorded
                    </span>
                    <button
                      type="button"
                      onClick={() => void handlePayment(policy)}
                      disabled={busyId !== null || !premiumDue}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                      {busyId === policy._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                      {premiumDue ? 'Record demo premium' : 'Premium not due'}
                    </button>
                  </div>
                </div>
                {policy.payments.length > 0 && (
                  <div className="mt-4 border-t border-slate-200 dark:border-slate-800 pt-3 text-xs text-slate-500">
                    Latest simulated payment: {formatINR(policy.payments[policy.payments.length - 1].amount)} on{' '}
                    {formatDate(policy.payments[policy.payments.length - 1].paidAt)} (no charge)
                  </div>
                )}
              </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
