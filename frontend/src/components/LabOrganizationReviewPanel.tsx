import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, Building2, FileText, Loader2 } from 'lucide-react';
import { adminAPI } from '../services/api';
import type { LabOrganization } from '../types';
import { ChainAdminProvisioningForm } from './ChainAdminProvisioningForm';

export const LabOrganizationReviewPanel: React.FC = () => {
  const [organizations, setOrganizations] = useState<LabOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await adminAPI.getLabOrganizations();
      setOrganizations(response.organizations);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to load laboratory applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const review = async (organization: LabOrganization, decision: 'verified' | 'needs_changes' | 'rejected') => {
    if (!organization.id) return;
    const reviewNote = reviewNotes[organization.id] || '';
    if (decision !== 'verified' && !reviewNote.trim()) {
      setError('Add a review note when requesting changes or rejecting a laboratory.');
      return;
    }
    setBusyId(organization.id);
    setError(null);
    setNotice(null);
    try {
      const response = await adminAPI.reviewLabOrganization(organization.id, decision, reviewNote);
      setNotice(response.message);
      await refresh();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not save this laboratory review.');
    } finally {
      setBusyId(null);
    }
  };

  const openDocument = async (organization: LabOrganization) => {
    if (!organization.id) return;
    try {
      const blob = await adminAPI.getLabOrganizationDocument(organization.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not open the laboratory registration document.');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>;

  return (
    <section className="space-y-4">
      {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}
      {organizations.length ? organizations.map((organization) => {
        const verification = organization.verification;
        const canReview = verification?.status === 'pending';
        return (
          <article key={organization.id} className="surface-card space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold"><Building2 className="h-4 w-4 text-teal-700" />{organization.name}</h2>
                <p className="mt-1 text-xs text-slate-500">{organization.organizationType === 'hospital_lab' ? `In-house hospital laboratory · ${organization.hospitalName || 'Hospital not specified'}` : organization.organizationType === 'franchise' ? 'Laboratory chain parent' : 'Independent laboratory'} · Registration {organization.registrationNumber}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{organization.address}, {organization.city}, {organization.state} {organization.postalCode}</p>
                <p className="mt-1 text-xs text-slate-500">Manager: {organization.manager?.name || 'Unknown'} · {organization.manager?.email || 'No email'} · Expires {verification?.expiresAt ? new Date(verification.expiresAt).toLocaleDateString('en-IN') : '—'}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800">{verification?.status?.replace('_', ' ') || 'pending'}</span>
            </div>
            <button type="button" onClick={() => void openDocument(organization)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"><FileText className="h-4 w-4" />View registration document</button>
            {verification?.reviewNote && <p className="text-xs text-amber-700 dark:text-amber-300">Previous review: {verification.reviewNote}</p>}
            {canReview && <>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Review note (required to request changes or reject)
                <textarea maxLength={1000} rows={2} value={reviewNotes[organization.id] || ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [organization.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void review(organization, 'verified')} disabled={busyId === organization.id} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><BadgeCheck className="h-4 w-4" />Verify laboratory</button>
                <button type="button" onClick={() => void review(organization, 'needs_changes')} disabled={busyId === organization.id} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50 dark:border-amber-900 dark:text-amber-200">Request changes</button>
                <button type="button" onClick={() => void review(organization, 'rejected')} disabled={busyId === organization.id} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300">Reject</button>
              </div>
            </>}
            {organization.organizationType === 'franchise' && verification?.status === 'verified' && organization.id && <ChainAdminProvisioningForm chainId={organization.id} chainType="lab" />}
          </article>
        );
      }) : <div className="surface-card p-8 text-center text-sm text-slate-500">No laboratory organization applications.</div>}
    </section>
  );
};
