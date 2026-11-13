import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { labAPI } from '../services/api';
import type { LabStaffOrder } from '../types';

export const LabStaffPage: React.FC = () => {
  const [orders, setOrders] = useState<LabStaffOrder[]>([]);
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => { try { setOrders((await labAPI.getStaffOrders()).orders); } catch { setError('Unable to load your laboratory requests.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const submit = async (event: React.FormEvent, order: LabStaffOrder) => {
    event.preventDefault(); const file = files[order.id]; if (!file || !titles[order.id]?.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try { const result = await labAPI.submitResult(order.id, titles[order.id].trim(), file); setMessage(result.message); await load(); }
    catch (e: any) { setError(e.response?.data?.message || 'Unable to submit this report.'); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
    <header className="surface-card space-y-3 p-6"><div className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300"><FlaskConical className="h-4 w-4" />Laboratory staff portal</div><h1 className="text-2xl font-semibold">Patient-authorized test requests</h1><p className="text-sm text-slate-600 dark:text-slate-400">Only patients who selected your verified laboratory appear here. Reports are added to the requesting patient’s medical records.</p><p className="inline-flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" />No access to patient search or unrelated records.</p></header>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <section className="surface-card p-5"><h2 className="text-base font-semibold">Requests</h2>{loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div> : orders.length ? <div className="divide-y divide-slate-200 dark:divide-slate-800">{orders.map((order) => <article key={order.id} className="space-y-3 py-4"><div><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{order.tests.join(', ')}</h3><span className="text-xs text-slate-500">{order.status === 'requested' ? 'Awaiting report' : order.status === 'cancelled' ? 'Cancelled' : 'Report submitted'}</span></div><p className="mt-1 text-xs text-slate-500">{order.patientName} · {new Date(order.createdAt).toLocaleDateString('en-IN')}</p>{order.clinicalNote && <p className="mt-2 whitespace-pre-wrap text-sm">{order.clinicalNote}</p>}{order.resultTitle && <p className="mt-2 text-sm text-emerald-700">{order.resultTitle}</p>}</div>{order.status === 'requested' && <form onSubmit={(event) => void submit(event, order)} className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-950 sm:grid-cols-2"><label className="text-xs font-medium">Report title<input required maxLength={150} value={titles[order.id] || ''} onChange={(e) => setTitles((v) => ({ ...v, [order.id]: e.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="e.g. Complete blood count" /></label><label className="text-xs font-medium">Report file (PDF, PNG, JPG)<input required type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setFiles((v) => ({ ...v, [order.id]: e.target.files?.[0] }))} className="mt-1 block w-full text-sm" /></label><button disabled={busy || !files[order.id] || !titles[order.id]?.trim()} className="button-primary inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 sm:col-span-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Submit result</button></form>}</article>)}</div> : <p className="py-5 text-sm text-slate-500">No requests have been shared with your laboratory.</p>}</section>
  </main>;
};
