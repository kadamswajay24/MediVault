import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, X } from 'lucide-react';
import { adminAPI } from '../services/api';
import type { ManagedInsurancePolicyPlan } from '../types';

type PlanForm = {
  name: string;
  provider: string;
  description: string;
  coverageAmount: string;
  monthlyPremium: string;
  highlights: string;
  status: ManagedInsurancePolicyPlan['status'];
};

const emptyForm: PlanForm = {
  name: '',
  provider: '',
  description: '',
  coverageAmount: '',
  monthlyPremium: '',
  highlights: '',
  status: 'draft',
};

const toPlanForm = (plan: ManagedInsurancePolicyPlan): PlanForm => ({
  name: plan.name,
  provider: plan.provider,
  description: plan.description,
  coverageAmount: String(plan.coverageAmount),
  monthlyPremium: String(plan.monthlyPremium),
  highlights: plan.highlights.join('\n'),
  status: plan.status,
});

const getErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export const AdminPolicyPlans: React.FC = () => {
  const [plans, setPlans] = useState<ManagedInsurancePolicyPlan[] | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [editingPlan, setEditingPlan] = useState<ManagedInsurancePolicyPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    try {
      setError(null);
      const response = await adminAPI.getPolicyPlans();
      setPlans(response.plans);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to load marketplace plans.'));
      setPlans([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPlans();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPlans]);

  const startNewPlan = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setError(null);
    setNotice(null);
  };

  const startEditing = (plan: ManagedInsurancePolicyPlan) => {
    setEditingPlan(plan);
    setForm(toPlanForm(plan));
    setError(null);
    setNotice(null);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const data = {
      name: form.name,
      provider: form.provider,
      description: form.description,
      coverageAmount: Number(form.coverageAmount),
      monthlyPremium: Number(form.monthlyPremium),
      highlights: form.highlights.split('\n').map((item) => item.trim()).filter(Boolean),
      status: editingPlan ? form.status : 'draft' as const,
    };

    try {
      if (editingPlan) {
        await adminAPI.updatePolicyPlan(editingPlan.planId, data);
        setNotice('Marketplace plan updated.');
      } else {
        await adminAPI.createPolicyPlan(data);
        setNotice('Plan created as a draft. Publish it when it is ready to appear in the marketplace.');
        setForm(emptyForm);
      }
      await loadPlans();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to save the marketplace plan.'));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (
    plan: ManagedInsurancePolicyPlan,
    status: ManagedInsurancePolicyPlan['status']
  ) => {
    setBusyPlanId(plan._id);
    setError(null);
    setNotice(null);
    try {
      await adminAPI.updatePolicyPlan(plan.planId, { status });
      setNotice(`Plan ${status}.`);
      await loadPlans();
      if (editingPlan?._id === plan._id) {
        setEditingPlan((current) => current ? { ...current, status } : current);
        setForm((current) => ({ ...current, status }));
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to update plan status.'));
    } finally {
      setBusyPlanId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Marketplace plans</h2>
          <p className="text-sm text-slate-500 mt-1">
            Create illustrative listings. New plans stay hidden until published.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewPlan}
          className="button-primary inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> New plan
        </button>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        All marketplace listings are demonstrations only. Publishing a listing does not confirm
        insurance coverage or enable real payments.
      </div>

      {(error || notice) && (
        <div
          role={error ? 'alert' : 'status'}
          className={`rounded-lg border p-3 text-sm ${
            error
              ? 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {error || notice}
        </div>
      )}

      {plans === null ? (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading marketplace plans...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] gap-5 items-start">
          <div className="space-y-3">
            {plans.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                No custom plans yet. Create a plan to start building the marketplace.
              </div>
            ) : plans.map((plan) => (
              <article
                key={plan._id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400">
                      {plan.provider}
                    </p>
                    <h3 className="font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatINR(plan.coverageAmount)} example cover · {formatINR(plan.monthlyPremium)}/month
                    </p>
                  </div>
                  <span className="rounded border border-slate-300 px-2 py-1 text-[10px] font-semibold uppercase text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {plan.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{plan.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEditing(plan)}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Edit
                  </button>
                  {plan.status !== 'published' ? (
                    <button
                      type="button"
                      onClick={() => void updateStatus(plan, 'published')}
                      disabled={busyPlanId !== null}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {busyPlanId === plan._id ? 'Saving...' : 'Publish'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void updateStatus(plan, 'draft')}
                      disabled={busyPlanId !== null}
                      className="rounded border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-50 dark:text-amber-300"
                    >
                      Unpublish
                    </button>
                  )}
                  {plan.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => void updateStatus(plan, 'archived')}
                      disabled={busyPlanId !== null}
                      className="rounded border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:opacity-50 dark:border-rose-900 dark:text-rose-400"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <form
            onSubmit={(event) => void handleSave(event)}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {editingPlan ? 'Edit marketplace plan' : 'Create marketplace plan'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {editingPlan ? 'Changes apply to future demo enrollments.' : 'The plan is saved as a draft.'}
                </p>
              </div>
              {editingPlan && (
                <button type="button" onClick={startNewPlan} aria-label="Create new plan" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Plan name
              <input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
            </label>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Provider
              <input required maxLength={120} value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
            </label>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Description
              <textarea required maxLength={1000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Example cover (₹)
                <input required type="number" min="1" step="1" value={form.coverageAmount} onChange={(event) => setForm({ ...form, coverageAmount: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
              </label>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Example monthly premium (₹)
                <input required type="number" min="0" step="1" value={form.monthlyPremium} onChange={(event) => setForm({ ...form, monthlyPremium: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Highlights (one per line, up to 12)
              <textarea rows={4} value={form.highlights} onChange={(event) => setForm({ ...form, highlights: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
            </label>
            {editingPlan && (
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Listing status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PlanForm['status'] })} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            )}
            <button
              type="submit"
              disabled={saving}
              className="button-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : editingPlan ? 'Save changes' : 'Create draft'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
