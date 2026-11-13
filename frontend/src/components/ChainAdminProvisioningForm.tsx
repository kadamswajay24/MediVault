import React, { useState } from 'react';
import { adminAPI } from '../services/api';

export const ChainAdminProvisioningForm: React.FC<{ chainId: string; chainType: 'pharmacy' | 'lab' }> = ({ chainId, chainType }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await adminAPI.createChainAdmin({ chainType, chainId, name, email, phone: `+91${phone.replace(/\D/g, '').slice(-10)}`, temporaryPassword });
      setMessage(result.message || 'Chain admin created. They must change the temporary password at first login.');
      setName(''); setEmail(''); setPhone(''); setTemporaryPassword(''); setOpen(false);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not create this chain admin.');
    } finally { setBusy(false); }
  };

  return <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
    {message && <p role="status" className="mb-2 text-xs text-emerald-700 dark:text-emerald-300">{message}</p>}
    {error && <p role="alert" className="mb-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    {!open ? <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-teal-700 px-3 py-2 text-xs font-semibold text-teal-800 dark:border-teal-500 dark:text-teal-200">Create another chain admin</button> :
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2">
        <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Admin name" aria-label="Admin name" className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-950" />
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" aria-label="Admin email" className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-950" />
        <label className="flex items-center rounded-lg border dark:border-slate-700"><span className="border-r px-3 py-2 text-sm text-slate-500">+91</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" aria-label="Admin mobile number" className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 py-2 text-sm" /></label>
        <input required minLength={8} type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} placeholder="Temporary password (8+ characters)" aria-label="Temporary password" className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-950" />
        <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="button-primary rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50">{busy ? 'Creating…' : 'Create admin'}</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-xs">Cancel</button><span className="self-center text-xs text-slate-500">They must change this password at first sign in.</span></div>
      </form>}
  </div>;
};
