import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { insuranceCompanyAPI } from '../services/api';
import { PostalAddressFields, emptyPostalAddress, type PostalAddress } from '../components/PostalAddressFields';

export const InsuranceCompanyRegisterPage: React.FC = () => {
  const [form, setForm] = useState({ companyName: '', registrationNumber: '', name: '', email: '', phone: '', password: '', credentialExpiresAt: '' });
  const [postalAddress, setPostalAddress] = useState<PostalAddress>(emptyPostalAddress);
  const [document, setDocument] = useState<File>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Choose a password with at least 8 characters.');
    if (!/^[6-9]\d{9}$/.test(form.phone)) return setError('Enter a valid 10-digit Indian mobile number.');
    if (!document || document.size > 4 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(document.type)) return setError('Upload a PDF, PNG, or JPEG registration document up to 4 MB.');
    if (!form.credentialExpiresAt || new Date(`${form.credentialExpiresAt}T23:59:59`) <= new Date()) return setError('The company registration expiry must be in the future.');
    setBusy(true);
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    payload.append('postalAddress', JSON.stringify(postalAddress));
    payload.append('credentialDocument', document);
    try {
      payload.set('phone', `+91${form.phone}`);
      const result = await insuranceCompanyAPI.apply(payload);
      setMessage(result.message);
    } catch (requestError: any) { setError(requestError.response?.data?.message || 'Could not submit the insurer application.'); }
    finally { setBusy(false); }
  };

  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
    <header><h1 className="text-2xl font-semibold">Enroll an insurance company</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">A platform administrator reviews the company registration before the initial company admin can sign in. The admin keeps the password chosen here.</p></header>
    {message ? <section className="surface-card space-y-3 p-6"><h2 className="font-semibold">Application submitted</h2><p className="text-sm text-slate-600 dark:text-slate-400">{message}</p><Link to="/insurance/admin/login" className="text-sm font-semibold underline">Company admin sign in</Link></section> : <form onSubmit={(event) => void submit(event)} className="surface-card grid gap-3 p-5 sm:grid-cols-2">
      {error && <p role="alert" className="rounded bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}
      <h2 className="font-semibold sm:col-span-2">Company details</h2>
      {([['companyName','Legal company name'],['registrationNumber','Registration number']] as const).map(([key,label]) => <label key={key} className="text-xs font-medium">{label}<input required maxLength={key === 'companyName' ? 150 : 100} value={form[key]} onChange={(event) => update(key,event.target.value)} className="mt-1 w-full rounded border bg-white p-2 text-sm dark:bg-slate-950" /></label>)}
      <PostalAddressFields value={postalAddress} onChange={setPostalAddress} className="sm:col-span-2" addressLabel="Registered address" />
      <label className="text-xs font-medium">Registration document expiry<input required type="date" value={form.credentialExpiresAt} onChange={(event) => update('credentialExpiresAt',event.target.value)} className="mt-1 w-full rounded border bg-white p-2 text-sm dark:bg-slate-950" /></label>
      <label className="text-xs font-medium sm:col-span-2">Company registration document<input required type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setDocument(event.target.files?.[0])} className="mt-1 block w-full text-sm" /></label>
      <h2 className="border-t pt-3 font-semibold sm:col-span-2">Initial company admin account</h2>
      {([['name','Admin name'],['email','Email'],['password','Password']] as const).map(([key,label]) => <label key={key} className="text-xs font-medium">{label}<input required type={key === 'email' ? 'email' : key === 'password' ? 'password' : 'text'} minLength={key === 'password' ? 8 : undefined} maxLength={key === 'name' ? 100 : undefined} value={form[key]} onChange={(event) => update(key,event.target.value)} className="mt-1 w-full rounded border bg-white p-2 text-sm dark:bg-slate-950" /></label>)}
      <label className="text-xs font-medium">Admin mobile number *
        <div className="mt-1 flex rounded border border-slate-300 dark:border-slate-700"><span className="border-r px-3 py-2 text-sm text-slate-500">+91</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} title="Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9." value={form.phone} onChange={(event) => update('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} className="min-w-0 flex-1 rounded-r bg-white p-2 text-sm dark:bg-slate-950" /></div>
      </label>
      <button disabled={busy} className="button-primary rounded px-4 py-2 sm:col-span-2">{busy ? 'Submitting…' : 'Submit company enrollment'}</button>
    </form>}
  </main>;
};
