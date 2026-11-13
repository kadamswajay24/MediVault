import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, Building2, CheckCircle2, Clock3, Loader2, Plus, XCircle } from 'lucide-react';
import { pharmacyOrganizationAPI } from '../services/api';
import type { PharmacyOrganization, User } from '../types';
import { PostalAddressFields } from '../components/PostalAddressFields';

type ManagedPharmacist = Pick<User, 'id' | 'name' | 'email' | 'phone' | 'approvalStatus' | 'isActive' | 'pharmacyMembershipStatus' | 'credentialVerification' | 'createdAt'> & {
  _id?: string;
  medicalStaffDetails?: { licenseNumber?: string };
};

const dateLabel = (value?: string) => value
  ? new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })
  : 'Not provided';

export const PharmacyOrganizationManagerPage: React.FC = () => {
  const [organization, setOrganization] = useState<PharmacyOrganization | null>(null);
  const [pharmacists, setPharmacists] = useState<ManagedPharmacist[]>([]);
  const [branches, setBranches] = useState<PharmacyOrganization[]>([]);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchType, setBranchType] = useState<'hospital' | 'independent_pharmacy'>('independent_pharmacy');
  const [branchRegistration, setBranchRegistration] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchCity, setBranchCity] = useState('');
  const [branchState, setBranchState] = useState('');
  const [branchPostalCode, setBranchPostalCode] = useState('');
  const [branchDistrict, setBranchDistrict] = useState('');
  const [branchPostOffice, setBranchPostOffice] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchHours, setBranchHours] = useState('');
  const [branchExpiresAt, setBranchExpiresAt] = useState('');
  const [branchDocument, setBranchDocument] = useState<File | null>(null);
  const [renewalDates, setRenewalDates] = useState<Record<string, string>>({});
  const [renewalDocuments, setRenewalDocuments] = useState<Record<string, File | undefined>>({});
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await pharmacyOrganizationAPI.getMine();
      setOrganization(response.organization);
      setPharmacists(response.pharmacists);
      setBranches(response.branches || []);
      setPhone(response.organization.phone);
      setOpeningHours(response.organization.openingHours);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to load the pharmacy organization workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const updateOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await pharmacyOrganizationAPI.updateMine({ phone: `+91${phone.replace(/\D/g, '').slice(-10)}`, openingHours });
      setNotice(response.message);
      await refresh();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not update pharmacy contact details.');
    } finally {
      setBusy(false);
    }
  };

  const decideMembership = async (pharmacistId: string, decision: 'approved' | 'rejected') => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await pharmacyOrganizationAPI.decidePharmacist(pharmacistId, decision);
      setNotice(response.message);
      await refresh();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not update pharmacist membership.');
    } finally {
      setBusy(false);
    }
  };

  const setMembershipActive = async (pharmacistId: string, isActive: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const response = await pharmacyOrganizationAPI.setPharmacistStatus(pharmacistId, isActive);
      setNotice(response.message);
      await refresh();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not update pharmacist status.');
    } finally {
      setBusy(false);
    }
  };

  const submitBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!branchDocument || branchDocument.size > 4 * 1024 * 1024 ||
        !['application/pdf', 'image/jpeg', 'image/png'].includes(branchDocument.type)) {
      setError('Choose a PDF, PNG, or JPEG branch registration document up to 4 MB.');
      return;
    }
    if (!branchExpiresAt || new Date(`${branchExpiresAt}T23:59:59`) <= new Date()) {
      setError('The branch registration expiry must be in the future.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await pharmacyOrganizationAPI.createBranch({
        name: branchName.trim(),
        organizationType: branchType,
        registrationNumber: branchRegistration.trim(),
        address: branchAddress.trim(),
        city: branchCity.trim(),
        state: branchState.trim(),
        postalCode: branchPostalCode.trim(),
        district: branchDistrict.trim(),
        postOffice: branchPostOffice.trim(),
        phone: `+91${branchPhone.replace(/\D/g, '').slice(-10)}`,
        openingHours: branchHours.trim(),
        credentialExpiresAt: branchExpiresAt,
        credentialDocument: branchDocument,
      });
      setNotice(response.message);
      setBranchName('');
      setBranchRegistration('');
      setBranchAddress('');
      setBranchCity('');
      setBranchState('');
      setBranchPostalCode('');
      setBranchDistrict('');
      setBranchPostOffice('');
      setBranchPhone('');
      setBranchHours('');
      setBranchExpiresAt('');
      setBranchDocument(null);
      setShowBranchForm(false);
      await refresh();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not submit the pharmacy branch.');
    } finally {
      setBusy(false);
    }
  };

  const resubmitBranch = async (branch: PharmacyOrganization) => {
    if (!branch.id) return;
    const document = renewalDocuments[branch.id];
    const expiresAt = renewalDates[branch.id];
    if (!document || document.size > 4 * 1024 * 1024 ||
        !['application/pdf', 'image/jpeg', 'image/png'].includes(document.type)) {
      setError('Choose a PDF, PNG, or JPEG branch registration document up to 4 MB.');
      return;
    }
    if (!expiresAt || new Date(`${expiresAt}T23:59:59`) <= new Date()) {
      setError('The branch registration expiry must be in the future.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await pharmacyOrganizationAPI.resubmitBranchCredentials(branch.id, expiresAt, document);
      setNotice(response.message);
      await refresh();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not resubmit branch documents.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>;

  const verificationStatus = organization?.verification?.status;
  const isVerified = verificationStatus === 'verified' && Boolean(organization?.verification?.expiresAt) &&
    new Date(organization?.verification?.expiresAt || 0) > new Date();

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300"><Building2 className="h-3.5 w-3.5" />Pharmacy organization manager</div>
        <h1 className="text-2xl font-bold">{organization?.name || 'Organization workspace'}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Manage the pharmacy listing and staff linked to this organization.</p>
      </header>

      {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}

      {organization && (
        <>
          <section className="surface-card space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-base font-semibold">MediVault organization status</h2><p className="mt-1 text-sm text-slate-500">{organization.organizationType === 'hospital' ? 'Hospital / in-house pharmacy' : organization.organizationType === 'franchise' ? 'Pharmacy franchise parent' : 'Independent pharmacy'} · Registration {organization.registrationNumber}</p></div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isVerified ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                {isVerified ? <BadgeCheck className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                {isVerified ? 'MediVault verified' : verificationStatus === 'needs_changes' ? 'Changes requested' : verificationStatus === 'rejected' ? 'Not approved' : 'Under review'}
              </span>
            </div>
            <p className="text-xs text-slate-500">Verification confirms that submitted registration documents were reviewed and are currently valid. It is not a guarantee of dispensing quality or clinical outcomes.</p>
            {organization.verification?.reviewNote && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{organization.verification.reviewNote}</p>}
            <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Address</dt><dd>{organization.address}, {organization.city}, {organization.state} {organization.postalCode}</dd></div><div><dt className="text-xs text-slate-500">Registration expires</dt><dd>{dateLabel(organization.verification?.expiresAt)}</dd></div></dl>
          </section>

          <form onSubmit={updateOrganization} className="surface-card space-y-3 p-5">
            <h2 className="text-base font-semibold">Directory contact details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">Phone
                <div className="mt-1 flex rounded-lg border border-slate-300 dark:border-slate-700"><span className="border-r px-3 py-2 text-sm text-slate-500">+91</span><input required inputMode="numeric" pattern="[6-9][0-9]{9}" value={phone.replace(/^\+91/, '')} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} className="min-w-0 flex-1 rounded-r-lg bg-white px-3 py-2 text-sm dark:bg-slate-950" /></div>
              </label>
              <label className="text-xs font-medium">Opening hours
                <input required maxLength={200} value={openingHours} onChange={(event) => setOpeningHours(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
            </div>
            <button type="submit" disabled={busy || !isVerified} className="button-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save listing details'}</button>
            {!isVerified && <p className="text-xs text-slate-500">Directory details can be edited after MediVault verification.</p>}
          </form>

          {organization.organizationType === 'franchise' && (
            <section className="surface-card space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-base font-semibold">Franchise branches</h2><p className="mt-1 text-xs text-slate-500">Your chain admin approval adds each branch to the pharmacy directory after you submit its registration document.</p></div>
                <button type="button" onClick={() => setShowBranchForm((current) => !current)} disabled={!isVerified} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-700 px-3 py-2 text-xs font-semibold text-teal-800 disabled:opacity-50 dark:border-teal-500 dark:text-teal-200"><Plus className="h-4 w-4" />Add branch</button>
              </div>
              {!isVerified && <p className="text-xs text-slate-500">Branch onboarding unlocks after the franchise parent is verified.</p>}
              {showBranchForm && (
                <form onSubmit={submitBranch} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="text-sm font-semibold">Branch registration</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-medium">Branch type
                      <select value={branchType} onChange={(event) => setBranchType(event.target.value as typeof branchType)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="independent_pharmacy">Pharmacy branch</option><option value="hospital">Hospital / in-house pharmacy</option></select>
                    </label>
                    <label className="text-xs font-medium">Branch name *<input required maxLength={150} value={branchName} onChange={(event) => setBranchName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>
                    <label className="text-xs font-medium">Branch registration number *<input required maxLength={100} value={branchRegistration} onChange={(event) => setBranchRegistration(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>
                    <PostalAddressFields className="sm:col-span-2" value={{ address: branchAddress, city: branchCity, state: branchState, postalCode: branchPostalCode, district: branchDistrict, postOffice: branchPostOffice }} onChange={(postal) => { setBranchAddress(postal.address); setBranchCity(postal.city); setBranchState(postal.state); setBranchPostalCode(postal.postalCode); setBranchDistrict(postal.district); setBranchPostOffice(postal.postOffice); }} />
                    <label className="text-xs font-medium">Branch mobile *<span className="mt-1 flex rounded-lg border border-slate-300 dark:border-slate-700"><span className="border-r px-3 py-2 text-sm text-slate-500">+91</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} value={branchPhone} onChange={(event) => setBranchPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} className="min-w-0 flex-1 rounded-r-lg bg-white px-3 py-2 text-sm dark:bg-slate-950" /></span></label>
                    <label className="text-xs font-medium">Opening hours *<input required maxLength={200} value={branchHours} onChange={(event) => setBranchHours(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>
                    <label className="text-xs font-medium">Registration expiry *<input required type="date" value={branchExpiresAt} onChange={(event) => setBranchExpiresAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>
                    <label className="text-xs font-medium sm:col-span-2">Branch registration document (PDF, PNG, JPEG; up to 4 MB) *<input required type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setBranchDocument(event.target.files?.[0] || null)} className="mt-1 block w-full text-sm" /></label>
                  </div>
                  <button type="submit" disabled={busy} className="button-primary rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50">{busy ? 'Submitting…' : 'Add and approve branch'}</button>
                </form>
              )}
              {branches.length ? <div className="space-y-3">
                {branches.map((branch) => {
                  const status = branch.verification?.status || 'pending';
                  const needsResubmission = status === 'needs_changes' || Boolean(branch.verification?.expiresAt && new Date(branch.verification.expiresAt) <= new Date());
                  return <article key={branch.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold">{branch.name}</h3><p className="mt-1 text-xs text-slate-500">{branch.organizationType === 'hospital' ? 'Hospital pharmacy' : 'Pharmacy branch'} · {branch.address}, {branch.city}, {branch.state}</p>{branch.verification?.reviewNote && <p className="mt-1 text-xs text-amber-700">{branch.verification.reviewNote}</p>}</div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800">{status.replace('_', ' ')}</span></div>
                    {needsResubmission && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs font-medium">New expiry<input type="date" value={renewalDates[branch.id] || ''} onChange={(event) => setRenewalDates((current) => ({ ...current, [branch.id]: event.target.value }))} className="mt-1 block w-full rounded border px-2 py-1.5 dark:bg-slate-950" /></label><label className="text-xs font-medium">Updated document<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setRenewalDocuments((current) => ({ ...current, [branch.id]: event.target.files?.[0] }))} className="mt-1 block w-full text-xs" /></label><button type="button" onClick={() => void resubmitBranch(branch)} disabled={busy} className="self-end rounded-lg border border-teal-700 px-3 py-2 text-xs font-semibold text-teal-800 disabled:opacity-50 dark:border-teal-500 dark:text-teal-200">Resubmit</button></div>}
                  </article>;
                })}
              </div> : <p className="text-sm text-slate-500">No branches have been submitted yet.</p>}
            </section>
          )}

          <section className="surface-card p-5">
            <div className="mb-4"><h2 className="text-base font-semibold">Pharmacist accounts</h2><p className="mt-1 text-xs text-slate-500">Pharmacists must be individually credential-verified by MediVault and approved by this organization before they can use pharmacy tools.</p></div>
            {pharmacists.length ? <div className="space-y-3">
              {pharmacists.map((pharmacist) => {
                const pharmacistId = pharmacist.id || pharmacist._id || '';
                const membership = pharmacist.pharmacyMembershipStatus || 'pending';
                const credentialsVerified = pharmacist.credentialVerification?.status === 'verified' &&
                  (!pharmacist.credentialVerification.expiresAt || new Date(pharmacist.credentialVerification.expiresAt) > new Date());
                return (
                  <article key={pharmacistId} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div><h3 className="text-sm font-semibold">{pharmacist.name}</h3><p className="mt-1 text-xs text-slate-500">{pharmacist.email} · License {pharmacist.medicalStaffDetails?.licenseNumber || 'not provided'}</p><p className="mt-1 text-xs text-slate-500">MediVault credentials: {credentialsVerified ? 'verified' : pharmacist.credentialVerification?.status || 'pending'} · Organization membership: {membership}</p></div>
                      <div className="flex flex-wrap gap-2">
                        {membership === 'pending' && <><button type="button" onClick={() => void decideMembership(pharmacistId, 'approved')} disabled={busy || !credentialsVerified || !isVerified} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" />Approve member</button><button type="button" onClick={() => void decideMembership(pharmacistId, 'rejected')} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"><XCircle className="h-3.5 w-3.5" />Decline</button></>}
                        {membership === 'approved' && pharmacist.approvalStatus === 'approved' && <button type="button" onClick={() => void setMembershipActive(pharmacistId, !pharmacist.isActive)} disabled={busy || !isVerified} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700">{pharmacist.isActive ? 'Suspend' : 'Reactivate'}</button>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div> : <p className="py-6 text-sm text-slate-500">No pharmacist accounts have applied to join this organization.</p>}
          </section>
        </>
      )}
    </main>
  );
};
