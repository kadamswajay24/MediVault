import React, { useEffect, useState } from 'react';
import { adminAPI, hospitalAPI } from '../services/api';
import { useAuth } from '../context/useAuth';
import { PostalAddressFields, emptyPostalAddress } from '../components/PostalAddressFields';

export const HospitalManagementPage: React.FC = () => {
  const { user } = useAuth();
  const main = user?.role === 'admin';
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [workspace, setWorkspace] = useState<any>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', registrationNumber: '', ...emptyPostalAddress() });
  const [admin, setAdmin] = useState({ name: '', email: '', phone: '', temporaryPassword: '' });

  const loadApplications = async () => {
    if (!main) {
      const result = await hospitalAPI.applications();
      setApplications(result.applications);
    }
  };

  const load = async () => {
    try {
      const result = main ? await adminAPI.getHospitals() : await hospitalAPI.mine();
      setHospitals(result.hospitals);
      if (!selected && !main && result.hospitals[0]) setSelected(String(result.hospitals[0]._id || result.hospitals[0].id));
      await loadApplications();
    } catch {
      setError('Unable to load hospital management data.');
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (selected && !main) hospitalAPI.workspace(selected).then(setWorkspace).catch(() => setError('You are not assigned to this hospital.'));
  }, [selected, main]);


  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await adminAPI.createHospital(form);
      setMessage('Hospital created for onboarding review.');
      setForm({ name: '', registrationNumber: '', ...emptyPostalAddress() });
      await load();
    } catch (error: any) { setError(error.response?.data?.message || 'Unable to create hospital.'); }
  };

  const createAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^[6-9]\d{9}$/.test(admin.phone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    try {
      const result = await adminAPI.createHospitalAdmin(selected, { ...admin, phone: `+91${admin.phone}` });
      setMessage(`Hospital administrator created for ${result.user.email}. Share the temporary password securely.`);
      setAdmin({ name: '', email: '', phone: '', temporaryPassword: '' });
    } catch (error: any) {
      setError(error.response?.data?.message || 'Unable to create hospital administrator.');
    }
  };

  const reviewCredential = async (userId: string, decision: 'verified' | 'needs_changes' | 'rejected') => {
    const reviewNote = decision === 'verified' ? '' : window.prompt(decision === 'rejected' ? 'Reason for rejecting these credentials:' : 'What must the applicant change?') || '';
    if (decision !== 'verified' && !reviewNote.trim()) return;
    setError('');
    try {
      await hospitalAPI.reviewStaffCredential(userId, decision, reviewNote);
      setMessage(`Credentials marked ${decision.replace('_', ' ')}.`);
      await loadApplications();
    } catch (err: any) { setError(err.response?.data?.message || 'Unable to save credential review.'); }
  };

  const activeStaff = (workspace?.staff || []).filter((staffMember: any) =>
    staffMember.isActive &&
    staffMember.approvalStatus === 'approved' &&
    staffMember.credentialVerification?.status === 'verified' &&
    (!staffMember.credentialVerification?.expiresAt || new Date(staffMember.credentialVerification.expiresAt) > new Date())
  );

  const approveStaff = async (userId: string) => {
    setError('');
    try {
      await hospitalAPI.approveStaff(userId);
      setMessage('Staff account approved.');
      await loadApplications();
    } catch (err: any) { setError(err.response?.data?.message || 'Unable to approve staff account.'); }
  };

  const openCredential = async (userId: string) => {
    try {
      const file = await hospitalAPI.staffCredentialDocument(userId);
      const url = URL.createObjectURL(file);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setError('Unable to open the credential document.'); }
  };


  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
    <h1 className="text-2xl font-semibold">{main ? 'Hospital administration' : 'Hospital workspace'}</h1>
    {message && <p role="status" className="text-emerald-700">{message}</p>}
    {error && <p role="alert" className="text-rose-700">{error}</p>}

    {main && <form onSubmit={create} className="surface-card grid gap-3 p-5 sm:grid-cols-2">
      <h2 className="font-semibold sm:col-span-2">Create hospital for onboarding</h2>
      {(['name', 'registrationNumber'] as const).map((key) => <input key={key} required maxLength={key === 'name' ? 150 : 100} placeholder={key} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="rounded-lg border p-2" />)}
      <PostalAddressFields value={{ address: form.address, city: form.city, state: form.state, postalCode: form.postalCode, district: form.district, postOffice: form.postOffice }} onChange={(postal) => setForm((current) => ({ ...current, ...postal }))} className="sm:col-span-2" />
      <button className="button-primary rounded p-2 sm:col-span-2">Create hospital</button>
    </form>}

    <section className="surface-card space-y-4 p-5">
      <label>Hospital<select value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">Choose hospital</option>{hospitals.map((hospital) => <option key={hospital._id || hospital.id} value={hospital._id || hospital.id}>{hospital.name} · {hospital.city}</option>)}</select></label>
      {main && selected && <form onSubmit={createAdmin} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Create dedicated hospital administrator</h2>
        <p className="text-sm text-slate-500 sm:col-span-2">The new administrator must replace the temporary password at first login.</p>
        {(['name', 'email', 'temporaryPassword'] as const).map((key) => <input key={key} required type={key === 'temporaryPassword' ? 'password' : key === 'email' ? 'email' : 'text'} minLength={key === 'temporaryPassword' ? 8 : undefined} maxLength={key === 'name' ? 100 : key === 'email' ? 254 : undefined} placeholder={key === 'temporaryPassword' ? 'Temporary password' : key} value={admin[key]} onChange={(event) => setAdmin({ ...admin, [key]: event.target.value })} className="rounded border p-2" />)}
        <label className="flex items-center rounded border focus-within:ring-2 focus-within:ring-teal-600">
          <span className="border-r px-3 py-2 text-sm text-slate-500">+91</span>
          <input required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit mobile number" value={admin.phone} onChange={(event) => setAdmin({ ...admin, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} className="min-w-0 flex-1 rounded-r bg-transparent p-2 outline-none" />
        </label>
        <button className="button-primary rounded px-3 py-2 sm:col-span-2">Create administrator</button>
      </form>}
      {workspace && <h2 className="text-lg font-semibold">{workspace.hospital.name}</h2>}
    </section>
    {!main && workspace && <section className="surface-card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Active staff</h2>
        <p className="mt-1 text-sm text-slate-500">Approved physicians and nurses with current verified credentials at this hospital.</p>
      </div>
      {activeStaff.length === 0 ? <p className="text-sm text-slate-500">No active staff are assigned to this hospital yet.</p> : <div className="divide-y divide-slate-200 dark:divide-slate-700">{activeStaff.map((staffMember: any) => <article key={staffMember._id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"><div><h3 className="font-medium">{staffMember.name}</h3><p className="text-sm text-slate-500">{staffMember.email}{staffMember.phone ? ` · ${staffMember.phone}` : ''}</p></div><div className="text-right text-xs text-slate-500"><span className="font-medium text-slate-700 dark:text-slate-300">{staffMember.medicalStaffDetails?.professionalType === 'nurse' ? 'Nurse' : 'Physician'}</span>{staffMember.medicalStaffDetails?.specialization && <span className="block">{staffMember.medicalStaffDetails.specialization}</span>}</div></article>)}</div>}
    </section>}
    {!main && <section className="surface-card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Staff applications</h2>
        <p className="mt-1 text-sm text-slate-500">Review credentials and approve physicians and nurses assigned to your hospital.</p>
      </div>
      {applications.length === 0 ? <p className="text-sm text-slate-500">No hospital staff applications need review.</p> : applications.map((application) => {
        const credentialStatus = application.credentialVerification?.status || 'pending';
        const credentialCurrent = credentialStatus === 'verified' && application.credentialVerification?.expiresAt && new Date(application.credentialVerification.expiresAt) > new Date();
        return <article key={application.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-medium">{application.name} · {application.medicalStaffDetails?.professionalType === 'nurse' ? 'Nurse' : 'Physician'}</h3>
              <p className="text-sm text-slate-500">{application.email} · {application.medicalStaffDetails?.specialization || 'General practice'}</p>
              <p className="mt-1 text-xs text-slate-500">Account: {application.approvalStatus} · Credentials: {credentialStatus}{application.credentialVerification?.expiresAt ? ` · Expires ${new Date(application.credentialVerification.expiresAt).toLocaleDateString('en-IN')}` : ''}</p>
              {application.credentialVerification?.reviewNote && <p className="mt-1 text-xs text-amber-700">Review note: {application.credentialVerification.reviewNote}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {application.credentialVerification?.documentFileName && <button type="button" onClick={() => void openCredential(application.id)} className="rounded border px-3 py-1.5 text-xs font-semibold">View credentials</button>}
              {credentialStatus === 'pending' && <button type="button" onClick={() => void reviewCredential(application.id, 'verified')} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Verify credentials</button>}
              {credentialStatus !== 'needs_changes' && <button type="button" onClick={() => void reviewCredential(application.id, 'needs_changes')} className="rounded border px-3 py-1.5 text-xs font-semibold">Request changes</button>}
              {credentialStatus !== 'rejected' && <button type="button" onClick={() => void reviewCredential(application.id, 'rejected')} className="rounded border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700">Reject credentials</button>}
              {application.approvalStatus === 'pending' && <button type="button" disabled={!credentialCurrent} onClick={() => void approveStaff(application.id)} className="button-primary rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Approve account</button>}
            </div>
          </div>
        </article>;
      })}
    </section>}
  </main>;
};
