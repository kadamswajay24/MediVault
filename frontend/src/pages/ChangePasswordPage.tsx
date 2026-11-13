import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/useAuth';

export const ChangePasswordPage: React.FC = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    try { await authAPI.changePassword({ currentPassword, newPassword }); setMessage('Password changed. Redirecting…'); setTimeout(() => { window.location.href = '/'; }, 500); }
    catch (e: any) { setError(e?.response?.data?.message || 'Unable to change password.'); }
  };
  return <main className="mx-auto max-w-lg px-4 py-16"><div className="surface-card space-y-5 p-6"><h1 className="text-2xl font-semibold">Set your password</h1><p className="text-sm text-slate-600">Your hospital administrator account was created with a temporary password. Choose your own password before opening the workspace.</p>{error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}{message&&<p role="status" className="text-sm text-emerald-700">{message}</p>}<form onSubmit={submit} className="space-y-4"><label className="block text-sm">Temporary password<input required type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className="mt-1 w-full rounded border p-2" /></label><label className="block text-sm">New password<input required minLength={8} type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="mt-1 w-full rounded border p-2" /></label><button className="button-primary rounded px-4 py-2">Save password</button></form><p className="text-xs text-slate-500">Signed in as {user?.email}</p></div></main>;
};
