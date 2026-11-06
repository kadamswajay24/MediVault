import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, FileCheck2, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { authAPI } from '../services/api';

export const StaffApplicationPage: React.FC = () => {
  const { user, updateUserContext, logout } = useAuth();
  const navigate = useNavigate();
  const [licenseNumber, setLicenseNumber] = useState(
    user?.role === 'medical_staff' ? user.medicalStaffDetails?.licenseNumber || '' : user?.insuranceDetails?.licenseNumber || ''
  );
  const [expiresAt, setExpiresAt] = useState(user?.credentialVerification?.expiresAt?.slice(0, 10) || '');
  const [document, setDocument] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user || !['medical_staff', 'insurance_agent'].includes(user.role)) return null;

  const credentialStatus = user.credentialVerification?.status || 'verified';
  const expired = Boolean(user.credentialVerification?.expiresAt && new Date(user.credentialVerification.expiresAt) <= new Date());
  const canResubmit = credentialStatus === 'needs_changes' || expired;
  const portalPath = user.role === 'medical_staff' ? '/medical-staff' : '/claims';

  const refreshStatus = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await authAPI.getMe();
      updateUserContext(response.user);
      if (response.user.approvalStatus === 'approved' && response.user.credentialVerification?.status === 'verified' &&
        (!response.user.credentialVerification.expiresAt || new Date(response.user.credentialVerification.expiresAt) > new Date())) {
        navigate(portalPath, { replace: true });
      } else {
        setNotice('Your application is still being reviewed.');
      }
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not refresh your application status.');
    } finally {
      setBusy(false);
    }
  };

  const submitChanges = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!document || !licenseNumber.trim() || !expiresAt) {
      setError('Enter your license number and expiry date, then attach the updated credential.');
      return;
    }
    if (document.size > 4 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(document.type)) {
      setError('Choose a PDF, PNG, or JPEG document no larger than 4 MB.');
      return;
    }
    if (new Date(`${expiresAt}T23:59:59`) <= new Date()) {
      setError('The credential expiry date must be in the future.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await authAPI.resubmitCredential({
        licenseNumber: licenseNumber.trim(),
        credentialExpiresAt: expiresAt,
        credentialDocument: document,
      });
      updateUserContext(response.user);
      setDocument(null);
      setNotice('Your updated credential was submitted. Staff tools remain locked while an administrator reviews it.');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not submit the updated credential.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-2xl items-center px-4 py-10">
      <section className="surface-card w-full p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#914B54]">Staff application</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Limited account access</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">You can review and update your application here. Clinical and insurance tools stay unavailable until the required approvals are complete.</p>
          </div>
          <button type="button" onClick={() => { logout(); navigate('/', { replace: true }); }} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
            {canResubmit ? <AlertCircle className="h-5 w-5" /> : credentialStatus === 'verified' ? <Clock3 className="h-5 w-5" /> : <FileCheck2 className="h-5 w-5" />}
            {canResubmit ? (expired ? 'Credential renewal required' : 'Changes requested') : credentialStatus === 'verified' ? 'Account approval pending' : 'Credential review in progress'}
          </div>
          <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
            {user.credentialVerification?.reviewNote || (canResubmit
              ? 'Your credential needs an update before staff access can be granted.'
              : credentialStatus === 'verified'
                ? 'Your credential is verified. An administrator still needs to approve your staff account.'
                : 'Your updated credential has been received and is awaiting administrator review.')}
          </p>
          {user.approvalStatus !== 'approved' && <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">Staff account approval: pending</p>}
          {credentialStatus === 'verified' && <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">Credential verification: complete</p>}
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle2 className="mr-2 inline h-4 w-4" />{notice}</p>}

        {canResubmit ? (
          <form onSubmit={submitChanges} className="mt-6 space-y-4">
            <div>
              <label htmlFor="resubmit-license" className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-200">License / registration number</label>
              <input id="resubmit-license" required value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <div>
              <label htmlFor="resubmit-expiry" className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-200">Credential expiry date</label>
              <input id="resubmit-expiry" required type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <div>
              <label htmlFor="resubmit-document" className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-200">Updated credential document</label>
              <input id="resubmit-document" required type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setDocument(event.target.files?.[0] || null)} className="w-full text-sm text-slate-700 dark:text-slate-300" />
              <p className="mt-1 text-xs text-slate-500">PDF, PNG, or JPEG, up to 4 MB.</p>
            </div>
            <button type="submit" disabled={busy} className="button-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting...</> : 'Resubmit credential'}
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => void refreshStatus()} disabled={busy} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Check application status
          </button>
        )}
      </section>
    </main>
  );
};
