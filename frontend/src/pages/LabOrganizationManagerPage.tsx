import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, Building2, CheckCircle2, Clock3, Loader2, Plus, XCircle } from 'lucide-react';
import { labAPI } from '../services/api';
import type { LabOrganization, User } from '../types';
import { PostalAddressFields } from '../components/PostalAddressFields';

type LabStaffMember = Pick<User, 'id' | 'name' | 'email' | 'approvalStatus' | 'labMembershipStatus' | 'credentialVerification' | 'createdAt'> & {
  _id?: string;
  medicalStaffDetails?: { licenseNumber?: string };
};

const dateLabel = (value?: string) => value
  ? new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })
  : 'Not provided';

export const LabOrganizationManagerPage: React.FC = () => {
  const [organization, setOrganization] = useState<LabOrganization | null>(null);
  const [staff, setStaff] = useState<LabStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branch, setBranch] = useState({ name: '', registrationNumber: '', address: '', city: '', district: '', state: '', postalCode: '', postOffice: '', credentialExpiresAt: '' });
  const [branchDocument, setBranchDocument] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await labAPI.getMine();
      setOrganization({ ...response.organization, branches: response.branches || [] });
      setStaff(response.staff);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to load the laboratory workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const decideMembership = async (staffId: string, decision: 'approved' | 'rejected') => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await labAPI.decideStaff(staffId, decision);
      setNotice(response.message);
      await refresh();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not update laboratory membership.');
    } finally {
      setBusy(false);
    }
  };

  const submitBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!branchDocument || branchDocument.size > 4 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(branchDocument.type)) return setError('Choose a PDF, PNG, or JPEG registration document up to 4 MB.');
    if (new Date(`${branch.credentialExpiresAt}T23:59:59`) <= new Date()) return setError('The branch registration expiry must be in the future.');
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await labAPI.createBranch({ ...branch, credentialDocument: branchDocument });
      setNotice(response.message); setBranch({ name: '', registrationNumber: '', address: '', city: '', district: '', state: '', postalCode: '', postOffice: '', credentialExpiresAt: '' }); setBranchDocument(null); setShowBranchForm(false);
      await refresh();
    } catch (requestError: any) { setError(requestError.response?.data?.message || 'Could not add the laboratory branch.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>;

  const verificationStatus = organization?.verification?.status;
  const isVerified = verificationStatus === 'verified' && Boolean(organization?.verification?.expiresAt) &&
    new Date(organization?.verification?.expiresAt || 0) > new Date();

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300"><Building2 className="h-3.5 w-3.5" />Laboratory manager</div>
        <h1 className="text-2xl font-bold">{organization?.name || 'Laboratory workspace'}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Manage laboratory staff membership. Lab report and test-order workflows are not part of this onboarding release.</p>
      </header>
      {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}
      {organization && (
        <>
          <section className="surface-card space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">MediVault organization status</h2>
                <p className="mt-1 text-sm text-slate-500">{organization.organizationType === 'hospital_lab' ? `In-house hospital laboratory${organization.hospitalName ? ` · ${organization.hospitalName}` : ''}` : organization.organizationType === 'franchise' ? 'Laboratory chain parent' : organization.franchiseParent ? 'Laboratory chain branch' : 'Independent laboratory'} · Registration {organization.registrationNumber}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isVerified ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                {isVerified ? <BadgeCheck className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                {isVerified ? 'MediVault verified' : verificationStatus === 'needs_changes' ? 'Changes requested' : verificationStatus === 'rejected' ? 'Not approved' : 'Under review'}
              </span>
            </div>
            <p className="text-xs text-slate-500">Verification confirms only that the submitted registration documents were reviewed and are currently valid.</p>
            {organization.verification?.reviewNote && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{organization.verification.reviewNote}</p>}
            <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Address</dt><dd>{organization.address}, {organization.city}, {organization.state} {organization.postalCode}</dd></div><div><dt className="text-xs text-slate-500">Registration expires</dt><dd>{dateLabel(organization.verification?.expiresAt)}</dd></div></dl>
          </section>
          {organization.organizationType === 'franchise' && <section className="surface-card space-y-4 p-5">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Laboratory locations</h2><p className="mt-1 text-xs text-slate-500">Adding a location approves it under your verified chain.</p></div><button type="button" disabled={!isVerified} onClick={() => setShowBranchForm((value) => !value)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"><Plus className="h-4 w-4" />Add location</button></div>
            {showBranchForm && <form onSubmit={submitBranch} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 dark:border-slate-800">
              {([['name','Location name'],['registrationNumber','Registration number']] as const).map(([key,label]) => <label key={key} className="text-xs font-medium">{label} *<input required maxLength={key === 'name' ? 150 : 100} value={branch[key]} onChange={(event) => setBranch((value) => ({ ...value, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950" /></label>)}
              <PostalAddressFields className="sm:col-span-2" value={{ address: branch.address, city: branch.city, district: branch.district, state: branch.state, postalCode: branch.postalCode, postOffice: branch.postOffice }} onChange={(postal) => setBranch((value) => ({ ...value, ...postal }))} />
              <label className="text-xs font-medium">Registration expiry *<input required type="date" value={branch.credentialExpiresAt} onChange={(event) => setBranch((value) => ({ ...value, credentialExpiresAt: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950" /></label>
              <label className="text-xs font-medium sm:col-span-2">Registration document (PDF, PNG, JPEG; up to 4 MB) *<input required type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setBranchDocument(event.target.files?.[0] || null)} className="mt-1 block w-full text-sm" /></label>
              <button disabled={busy} className="button-primary rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 sm:col-span-2">{busy ? 'Adding…' : 'Add and approve location'}</button>
            </form>}
            {organization.branches?.length ? <ul className="space-y-2">{organization.branches.map((location) => <li key={location.id} className="rounded-lg border p-3 text-sm dark:border-slate-800"><strong>{location.name}</strong><span className="ml-2 text-xs text-emerald-700 dark:text-emerald-300">Approved</span><p className="mt-1 text-xs text-slate-500">{location.address}, {location.city}, {location.state} · Registration {location.registrationNumber}</p></li>)}</ul> : <p className="text-sm text-slate-500">No locations have been added yet.</p>}
          </section>}
          <section className="surface-card p-5">
            <div className="mb-4"><h2 className="text-base font-semibold">Laboratory staff</h2><p className="mt-1 text-xs text-slate-500">Staff need MediVault credential verification and your membership approval before lab access is granted.</p></div>
            {staff.length ? <div className="space-y-3">
              {staff.map((member) => {
                const staffId = member.id || member._id || '';
                const membership = member.labMembershipStatus || 'pending';
                const credentialsVerified = member.credentialVerification?.status === 'verified' &&
                  (!member.credentialVerification.expiresAt || new Date(member.credentialVerification.expiresAt) > new Date());
                return (
                  <article key={staffId} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div><h3 className="text-sm font-semibold">{member.name}</h3><p className="mt-1 text-xs text-slate-500">{member.email} · License {member.medicalStaffDetails?.licenseNumber || 'not provided'}</p><p className="mt-1 text-xs text-slate-500">MediVault credentials: {credentialsVerified ? 'verified' : member.credentialVerification?.status || 'pending'} · Organization membership: {membership}</p></div>
                      {membership === 'pending' && <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void decideMembership(staffId, 'approved')} disabled={busy || !credentialsVerified || !isVerified} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" />Approve member</button>
                        <button type="button" onClick={() => void decideMembership(staffId, 'rejected')} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"><XCircle className="h-3.5 w-3.5" />Decline</button>
                      </div>}
                    </div>
                  </article>
                );
              })}
            </div> : <p className="py-6 text-sm text-slate-500">No laboratory staff membership applications.</p>}
          </section>
        </>
      )}
    </main>
  );
};
