import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Clipboard, Loader2, Pill, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { medicalStaffAPI, pharmacyAPI } from '../services/api';
import type {
  MedicalNote,
  PrescriptionDispenseRecord,
  PrescriptionShareInfo,
  SharedPrescription,
  PharmacyOrganization,
} from '../types';

type DispenseStatus = 'dispensed' | 'partially_dispensed' | 'unavailable';
type DispenseDraft = { status: DispenseStatus; quantityDispensed: string };

const formatDate = (value: string) => new Date(value).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata',
  dateStyle: 'medium',
  timeStyle: 'short',
});

const statusLabel = (status: DispenseStatus) => ({
  dispensed: 'Dispensed',
  partially_dispensed: 'Partially dispensed',
  unavailable: 'Unavailable',
}[status]);

export const PharmacyPage: React.FC = () => {
  const { user, activeDependent } = useAuth();
  const patientMediVaultId = user?.mediVaultId;
  const isPharmacist = user?.role === 'medical_staff' &&
    user.medicalStaffDetails?.professionalType === 'pharmacist';
  const [prescriptions, setPrescriptions] = useState<MedicalNote[]>([]);
  const [shares, setShares] = useState<PrescriptionShareInfo[]>([]);
  const [records, setRecords] = useState<PrescriptionDispenseRecord[]>([]);
  const [directory, setDirectory] = useState<PharmacyOrganization[]>([]);
  const [organizationShares, setOrganizationShares] = useState<{
    id: string;
    patientName: string;
    prescriptionTitle: string;
    sharedAt: string;
    expiresAt: string;
    openedByCurrentUser: boolean;
  }[]>([]);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState('');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [lookupCode, setLookupCode] = useState('');
  const [sharedPrescription, setSharedPrescription] = useState<SharedPrescription | null>(null);
  const [dispenseDraft, setDispenseDraft] = useState<DispenseDraft[]>([]);
  const [dispenseNotes, setDispenseNotes] = useState('');

  const loadPatientData = useCallback(async () => {
    if (!patientMediVaultId) return;
    try {
      const [notesResponse, sharesResponse, recordsResponse, directoryResponse] = await Promise.all([
        medicalStaffAPI.getPatientNotes(patientMediVaultId),
        pharmacyAPI.getPrescriptionShares(),
        pharmacyAPI.getMyDispenseRecords(),
        pharmacyAPI.getDirectory(),
      ]);
      setPrescriptions(notesResponse.notes.filter((note) =>
        note.noteType === 'Prescription' && !note.deletedAt && note.prescriptionItems.length > 0
      ));
      setShares(sharesResponse.shares);
      setRecords(recordsResponse.records);
      setDirectory(directoryResponse.organizations);
    } catch {
      setError('Unable to load prescription sharing and dispensing history.');
    } finally {
      setLoading(false);
    }
  }, [patientMediVaultId]);

  useEffect(() => {
    if (user?.role === 'patient' && !activeDependent) {
      void loadPatientData();
    }
  }, [activeDependent, loadPatientData, user?.role]);

  useEffect(() => {
    if (!isPharmacist) return;
    pharmacyAPI.getOrganizationShares()
      .then((response) => setOrganizationShares(response.shares))
      .catch(() => setError('Unable to load prescription requests for your pharmacy organization.'))
      .finally(() => setLoading(false));
  }, [isPharmacist]);

  const createShare = async (prescriptionId: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setIssuedCode(null);
    try {
      const result = await pharmacyAPI.createPrescriptionShare(prescriptionId);
      if (!result.token) throw new Error('The server did not return a pharmacy access code.');
      setIssuedCode(result.token);
      setMessage(result.message);
      await loadPatientData();
    } catch {
      setError('Unable to create a prescription access code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const revokeShare = async (shareId: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await pharmacyAPI.revokePrescriptionShare(shareId);
      setMessage(result.message);
      await loadPatientData();
    } catch {
      setError('Unable to revoke this prescription access code.');
    } finally {
      setBusy(false);
    }
  };

  const shareWithOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPrescriptionId || !selectedOrganizationId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await pharmacyAPI.shareWithOrganization(selectedPrescriptionId, selectedOrganizationId);
      setMessage(response.message);
      await loadPatientData();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to share this prescription with the selected pharmacy.');
    } finally {
      setBusy(false);
    }
  };

  const openOrganizationShare = async (shareId: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await pharmacyAPI.openOrganizationShare(shareId);
      setSharedPrescription(result);
      setDispenseDraft(result.prescription.items.map(() => ({ status: 'dispensed', quantityDispensed: '' })));
      setDispenseNotes('');
      setOrganizationShares((current) => current.map((share) => share.id === shareId ? { ...share, openedByCurrentUser: true } : share));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to open this organization-shared prescription.');
    } finally {
      setBusy(false);
    }
  };

  const lookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setSharedPrescription(null);
    try {
      const result = await pharmacyAPI.lookupSharedPrescription(lookupCode.trim());
      setSharedPrescription(result);
      setDispenseDraft(result.prescription.items.map(() => ({
        status: 'dispensed',
        quantityDispensed: '',
      })));
      setDispenseNotes('');
    } catch {
      setError('Unable to open that prescription. Check the code or ask the patient to share it again.');
    } finally {
      setBusy(false);
    }
  };

  const saveDispenseRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sharedPrescription) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await pharmacyAPI.createDispenseRecord(sharedPrescription.shareId, {
        items: dispenseDraft,
        notes: dispenseNotes.trim(),
      });
      setMessage(result.message);
      setSharedPrescription(null);
      setLookupCode('');
      setDispenseDraft([]);
      setDispenseNotes('');
      if (user?.role === 'patient') await loadPatientData();
    } catch {
      setError('Unable to create the dispensing record. Verify each medicine status and quantity.');
    } finally {
      setBusy(false);
    }
  };

  if (isPharmacist) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Prescription-specific access
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pharmacy workspace</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Open only a prescription the patient has explicitly shared. Dispensing records never edit the prescriber’s order.
          </p>
        </header>

        {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</p>}

        <form onSubmit={lookup} className="surface-card space-y-3 p-5">
          <label htmlFor="prescription-access-code" className="block text-sm font-semibold">Patient access code</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="prescription-access-code" value={lookupCode} onChange={(event) => setLookupCode(event.target.value)} required minLength={64} maxLength={64} autoComplete="off" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="64-character code supplied by the patient" />
            <button type="submit" disabled={busy || lookupCode.trim().length !== 64} className="button-primary inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pill className="h-4 w-4" />} Open prescription
            </button>
          </div>
        </form>

        <section className="surface-card p-5">
          <div className="mb-3"><h2 className="text-base font-semibold">Requests for your pharmacy</h2><p className="mt-1 text-xs text-slate-500">Patients may share a prescription directly with your verified hospital or independent pharmacy using the MediVault directory.</p></div>
          {loading ? <div className="flex justify-center py-5"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div> : organizationShares.length ? <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {organizationShares.map((share) => <article key={share.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-semibold">{share.prescriptionTitle}</h3><p className="mt-1 text-xs text-slate-500">Shared by {share.patientName} · expires {formatDate(share.expiresAt)}</p></div><button type="button" onClick={() => void openOrganizationShare(share.id)} disabled={busy || (share.openedByCurrentUser && sharedPrescription?.shareId === share.id)} className="rounded-lg border border-teal-300 px-3 py-2 text-xs font-semibold text-teal-800 disabled:opacity-50 dark:border-teal-800 dark:text-teal-200">{share.openedByCurrentUser ? 'Reopen prescription' : 'Open prescription'}</button></article>)}
          </div> : <p className="py-4 text-sm text-slate-500">No active directory shares right now.</p>}
        </section>

        {sharedPrescription && (
          <section className="surface-card space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold">{sharedPrescription.prescription.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Patient: {sharedPrescription.patientName} · Prescriber: {sharedPrescription.prescription.doctorName} · Expires {formatDate(sharedPrescription.expiresAt)}
              </p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">This view contains only the shared prescription. It does not grant access to the patient’s profile or other records.</p>
            </div>
            <form onSubmit={saveDispenseRecord} className="space-y-4">
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {sharedPrescription.prescription.items.map((item, index) => (
                  <div key={`${item.medicineName}-${index}`} className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_190px_180px] sm:items-center">
                    <div>
                      <p className="text-sm font-semibold">{item.medicineName}</p>
                      <p className="mt-1 text-xs text-slate-500">{[item.dosage, item.frequency, item.duration, item.instructions].filter(Boolean).join(' · ')}</p>
                    </div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Dispensing status
                      <select value={dispenseDraft[index]?.status || 'dispensed'} onChange={(event) => setDispenseDraft((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, status: event.target.value as DispenseStatus, quantityDispensed: event.target.value === 'unavailable' ? '' : entry.quantityDispensed } : entry))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                        <option value="dispensed">Dispensed</option>
                        <option value="partially_dispensed">Partially dispensed</option>
                        <option value="unavailable">Unavailable</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Quantity dispensed
                      <input value={dispenseDraft[index]?.quantityDispensed || ''} onChange={(event) => setDispenseDraft((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantityDispensed: event.target.value } : entry))} disabled={dispenseDraft[index]?.status === 'unavailable'} required={dispenseDraft[index]?.status !== 'unavailable'} maxLength={100} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900" placeholder="e.g. 10 tablets" />
                    </label>
                  </div>
                ))}
              </div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Pharmacy note (optional)
                <textarea value={dispenseNotes} onChange={(event) => setDispenseNotes(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <button type="submit" disabled={busy} className="button-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create dispensing record
              </button>
            </form>
          </section>
        )}
      </div>
    );
  }

  if (user?.role !== 'patient') return null;
  if (activeDependent) {
    return <div className="mx-auto max-w-3xl px-4 py-8"><p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Prescription sharing is available from the patient’s own account. Switch back to your personal vault to manage your prescriptions.</p></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300">
          <ShieldCheck className="h-3.5 w-3.5" /> You control access
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pharmacy sharing</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Share one prescription at a time with a pharmacist. The access code expires after 24 hours, can be revoked early, and does not expose your other records.</p>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</p>}
      {issuedCode && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Share this code with your pharmacist</h2><p className="mt-1 text-xs text-amber-900 dark:text-amber-200">This code is shown only once. The first pharmacist account to open it gets access until it expires or you revoke it.</p></div>
            <button type="button" onClick={() => setIssuedCode(null)} aria-label="Dismiss access code" className="rounded p-1 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white p-3 text-xs dark:border-amber-800 dark:bg-slate-950">{issuedCode}</code>
            <button type="button" onClick={() => void navigator.clipboard.writeText(issuedCode).then(() => setMessage('Access code copied.')).catch(() => setError('Clipboard access is unavailable. Select and copy the code manually.'))} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-900"><Clipboard className="h-4 w-4" />Copy code</button>
          </div>
        </section>
      )}

      <section className="surface-card p-5">
        <h2 className="text-base font-semibold">Your digital prescriptions</h2>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div> : prescriptions.length ? (
          <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
            {prescriptions.map((prescription) => (
              <article key={prescription._id} className="flex flex-col gap-3 py-4 first:pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-sm font-semibold">{prescription.title}</h3><p className="mt-1 text-xs text-slate-500">Issued {formatDate(prescription.createdAt)} · {prescription.prescriptionItems.length} medicine(s)</p></div>
                <button type="button" onClick={() => void createShare(prescription._id)} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-300 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-800 dark:text-teal-200 dark:hover:bg-teal-950/30"><Pill className="h-3.5 w-3.5" />Create 24-hour access code</button>
              </article>
            ))}
          </div>
        ) : !loading && <p className="py-6 text-sm text-slate-500">No active digital prescriptions are available to share.</p>}
      </section>

      <section className="surface-card space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold">MediVault pharmacy directory</h2>
          <p className="mt-1 text-xs text-slate-500">Choose a verified hospital pharmacy or independent pharmacy and a prescription. The pharmacy sees only the prescription you select for 24 hours. Verification means registration documents were reviewed; it does not guarantee dispensing quality or clinical outcomes.</p>
        </div>
        {directory.length ? (
          <form onSubmit={shareWithOrganization} className="space-y-3">
            <label className="block text-xs font-medium">
              Prescription
              <select required value={selectedPrescriptionId} onChange={(event) => setSelectedPrescriptionId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">Choose one of your digital prescriptions</option>
                {prescriptions.map((prescription) => <option key={prescription._id} value={prescription._id}>{prescription.title}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {directory.map((organization) => (
                <label key={organization.id} className={`cursor-pointer rounded-lg border p-3 ${selectedOrganizationId === organization.id ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                  <span className="flex items-start gap-2"><input type="radio" name="pharmacyOrganization" required value={organization.id} checked={selectedOrganizationId === organization.id} onChange={() => setSelectedOrganizationId(organization.id)} className="mt-1" /><span><span className="block text-sm font-semibold">{organization.name}</span><span className="mt-0.5 block text-[11px] text-teal-700 dark:text-teal-300">MediVault verified · {organization.organizationType === 'hospital' ? 'Hospital / in-house pharmacy' : 'Independent pharmacy'}</span><span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">{organization.address}, {organization.city}, {organization.state} {organization.postalCode}</span><span className="mt-1 block text-xs text-slate-500">{organization.phone} · {organization.openingHours}</span></span></span>
                </label>
              ))}
            </div>
            <button type="submit" disabled={busy || !selectedPrescriptionId || !selectedOrganizationId} className="button-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">Share selected prescription for 24 hours</button>
          </form>
        ) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950">No pharmacy organizations are currently in the verified directory. You can still share a code directly with an approved pharmacist.</p>}
      </section>

      <section className="surface-card p-5">
        <h2 className="text-base font-semibold">Prescription access codes</h2>
        {loading ? <p className="py-5 text-sm text-slate-500">Loading…</p> : shares.length ? (
          <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
            {shares.map((share) => (
              <article key={share.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-sm font-medium">{share.prescriptionTitle}</h3><p className="mt-1 text-xs text-slate-500">{share.channel === 'directory' && share.pharmacyOrganization ? `Shared with ${share.pharmacyOrganization.name} · ` : 'Direct pharmacist code · '}{share.active ? `Active until ${formatDate(share.expiresAt)}` : share.revokedAt ? 'Revoked' : 'Expired or prescription changed'}</p></div>
                {share.active && <button type="button" onClick={() => void revokeShare(share.id)} disabled={busy} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">Revoke access</button>}
              </article>
            ))}
          </div>
        ) : <p className="py-5 text-sm text-slate-500">You have not shared a prescription.</p>}
      </section>

      <section className="surface-card p-5">
        <h2 className="text-base font-semibold">Dispensing history</h2>
        {loading ? <p className="py-5 text-sm text-slate-500">Loading…</p> : records.length ? (
          <div className="mt-3 space-y-3">
            {records.map((record) => (
              <article key={record.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-semibold">{record.prescriptionTitle}</h3><time className="text-xs text-slate-500">{formatDate(record.createdAt)}</time></div>
                <p className="mt-1 text-xs text-slate-500">{record.pharmacistName}{record.pharmacyName ? ` · ${record.pharmacyName}` : ''}</p>
                <ul className="mt-3 space-y-1 text-xs text-slate-700 dark:text-slate-300">{record.items.map((item, index) => <li key={`${item.medicineName}-${index}`}>{item.medicineName}: {statusLabel(item.status)}{item.quantityDispensed ? ` (${item.quantityDispensed})` : ''}</li>)}</ul>
                {record.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">{record.notes}</p>}
              </article>
            ))}
          </div>
        ) : <p className="py-5 text-sm text-slate-500">No pharmacy dispensing records yet.</p>}
      </section>
    </div>
  );
};
