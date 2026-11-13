import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, History, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { auditAPI } from '../services/api';
import type { AuditLog } from '../types';

const PAGE_SIZE = 20;
const ACTION_OPTIONS = [
  ['ALL', 'All activity'],
  ['LOGIN', 'Sign in'], ['LOGOUT', 'Sign out'], ['PROFILE_UPDATE', 'Profile update'],
  ['RECORD_UPLOAD', 'Record added'], ['RECORD_VIEW', 'Record accessed'], ['RECORD_DELETE', 'Record removed'], ['RECORD_AI_SUMMARIZED', 'Record summary created'], ['AI_SUMMARY_FEEDBACK', 'Summary feedback'],
  ['MEDICATION_REMINDER_SET', 'Medicine reminder added'], ['MEDICATION_REMINDER_REMOVED', 'Medicine reminder removed'],
  ['PRESCRIPTION_SHARED', 'Prescription shared'], ['PRESCRIPTION_SHARE_ACCESSED', 'Shared prescription accessed'],
  ['PRESCRIPTION_SHARE_REVOKED', 'Prescription access revoked'], ['PRESCRIPTION_DISPENSE_RECORDED', 'Dispensing recorded'],
  ['PHARMACY_MEMBERSHIP_REVIEWED', 'Pharmacy membership reviewed'], ['PHARMACY_ORGANIZATION_REVIEWED', 'Pharmacy organization reviewed'],
  ['ACCESS_REQUESTED', 'Access requested'], ['ACCESS_REQUEST_DECIDED', 'Access decision'], ['ACCESS_REVOKED', 'Access ended'],
  ['APPOINTMENT_BOOKED', 'Appointment booked'], ['APPOINTMENT_REVIEWED', 'Appointment reviewed'], ['APPOINTMENT_CANCELLED', 'Appointment cancelled'],
  ['NURSING_ENTRY_ADDED', 'Nursing entry added'], ['CLINICAL_NOTE_ADDED', 'Clinical note added'], ['CLINICAL_NOTE_UPDATED', 'Clinical note updated'],
  ['NURSING_OPERATIONS_UPDATED', 'Nursing profile updated'], ['NURSING_TEAM_RESOURCE_ADDED', 'Nursing team resource added'], ['NURSING_TEAM_RESOURCE_REMOVED', 'Nursing team resource removed'],
  ['CLINICAL_NOTE_DELETION_REQUESTED', 'Note removal requested'], ['CLINICAL_NOTE_DELETION_DECIDED', 'Note removal decision'],
  ['CLAIM_SUBMITTED', 'Claim submitted'], ['CLAIM_REVIEWED', 'Claim reviewed'],
  ['PROXY_GRANTED', 'Caregiver access granted'], ['PROXY_REVOKED', 'Caregiver access changed'], ['PROXY_ACTION', 'Caregiver activity'],
  ['POLICY_PLAN_CREATED', 'Plan created'], ['POLICY_PLAN_UPDATED', 'Plan updated'], ['ADMIN_USER_UPDATED', 'Account updated'],
] as const;

const EVENT_LABELS: Record<string, string> = {
  LOGIN: 'Signed in', LOGOUT: 'Signed out', PROFILE_UPDATE: 'Profile updated',
  RECORD_UPLOAD: 'Record added', RECORD_VIEW: 'Record accessed', RECORD_AI_SUMMARIZED: 'Record summary created', RECORD_DELETE: 'Record removed',
  PROXY_GRANTED: 'Caregiver access granted', PROXY_REVOKED: 'Caregiver access changed', PROXY_ACTION: 'Caregiver activity',
  ACCESS_REQUESTED: 'Clinical access requested', ACCESS_REQUEST_DECIDED: 'Clinical access decision', ACCESS_REVOKED: 'Clinical access ended',
  CLAIM_SUBMITTED: 'Claim submitted', CLAIM_REVIEWED: 'Claim reviewed', CLINICAL_NOTE_ADDED: 'Clinical note added',
  CLINICAL_NOTE_UPDATED: 'Clinical note updated', CLINICAL_NOTE_DELETION_REQUESTED: 'Note removal requested',
  CLINICAL_NOTE_DELETION_DECIDED: 'Note removal decision', NURSING_ENTRY_ADDED: 'Nursing entry added',
  NURSING_OPERATIONS_UPDATED: 'Nursing shifts or training updated', NURSING_TEAM_RESOURCE_ADDED: 'Nursing team resource added', NURSING_TEAM_RESOURCE_REMOVED: 'Nursing team resource removed',
  APPOINTMENT_BOOKED: 'Appointment booked', APPOINTMENT_REVIEWED: 'Appointment reviewed', APPOINTMENT_CANCELLED: 'Appointment cancelled',
  MEDICATION_REMINDER_SET: 'Medicine reminder added', MEDICATION_REMINDER_REMOVED: 'Medicine reminder removed',
  PRESCRIPTION_SHARED: 'Prescription shared', PRESCRIPTION_SHARE_ACCESSED: 'Shared prescription accessed',
  PRESCRIPTION_SHARE_REVOKED: 'Prescription access revoked', PRESCRIPTION_DISPENSE_RECORDED: 'Dispensing recorded',
  PHARMACY_MEMBERSHIP_REVIEWED: 'Pharmacy membership reviewed', PHARMACY_ORGANIZATION_REVIEWED: 'Pharmacy organization reviewed',
  POLICY_PLAN_CREATED: 'Insurance plan created', POLICY_PLAN_UPDATED: 'Insurance plan updated', ADMIN_USER_UPDATED: 'Account updated',
  AI_SUMMARY_FEEDBACK: 'Summary feedback submitted',
};

const formatTimestamp = (timestamp: string) => new Date(timestamp).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', timeZoneName: 'short', hour12: true,
  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const eventLabel = (log: AuditLog) => {
  if (log.action === 'RECORD_VIEW' && log.resourceType === 'PatientOverview') return 'Clinical overview viewed';
  if (log.action === 'RECORD_VIEW' && /claim-attached document/i.test(log.details)) return 'Claim document downloaded';
  if (log.action === 'RECORD_VIEW' && /download/i.test(log.details)) return 'Document downloaded';
  return EVENT_LABELS[log.action] || log.action.replaceAll('_', ' ').toLowerCase();
};

const actorLabel = (log: AuditLog) => {
  if (!log.performedBy || typeof log.performedBy === 'string') return 'You';
  const role = log.performedBy.role === 'medical_staff' ? 'Clinical staff'
    : log.performedBy.role === 'insurance_agent' ? 'Insurance'
      : log.performedBy.role === 'admin' ? 'Administrator' : '';
  return role ? `${log.performedBy.name} · ${role}` : log.performedBy.name;
};

export const AuditLogsPage: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await auditAPI.getLogs({
        action: actionFilter === 'ALL' ? undefined : actionFilter,
        page,
        limit: PAGE_SIZE,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      if (result.success) {
        setLogs(result.logs);
        setTotal(result.total);
        setPages(result.pages);
        setError(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load activity.');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, dateFrom, dateTo, page]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  const clearDates = () => { setDateFrom(''); setDateTo(''); setPage(1); };
  const subtitle = user?.role === 'patient'
    ? 'Activity in your vault, including when records are accessed and by whom.'
    : 'A record of actions taken by your account.';

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300"><ShieldCheck className="h-3.5 w-3.5" />Private activity log</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{user?.role === 'patient' ? 'Vault activity' : 'My activity'}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>
        <button type="button" onClick={() => void fetchLogs()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </header>

      <section aria-label="Activity filters" className="surface-card flex flex-wrap items-end gap-3 p-4">
        <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          Event type
          <select value={actionFilter} onChange={event => { setActionFilter(event.target.value); setPage(1); }} className="min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            {ACTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          From
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => { setDateFrom(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          To
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => { setDateTo(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>
        {(dateFrom || dateTo) && <button type="button" onClick={clearDates} className="rounded-lg px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-slate-800">Clear dates</button>}
        <p className="ml-auto text-xs text-slate-500 dark:text-slate-400">Dates shown in India time</p>
      </section>

      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm dark:border-slate-800 dark:bg-slate-900/80" aria-label="Activity events">
        {loading ? <div className="flex flex-col items-center gap-3 py-16"><Loader2 className="h-7 w-7 animate-spin text-teal-600" /><p className="text-sm text-slate-500">Loading activity…</p></div>
          : logs.length === 0 ? <div className="py-16 text-center"><History className="mx-auto mb-3 h-9 w-9 text-slate-300 dark:text-slate-700" /><h2 className="font-semibold text-slate-900 dark:text-white">No activity found</h2><p className="mt-1 text-sm text-slate-500">Try a different event type or date range.</p></div>
            : <ol className="divide-y divide-slate-200 dark:divide-slate-800">{logs.map(log => <li key={log._id} className="flex gap-3 px-4 py-4 sm:px-5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"><History className="h-4 w-4" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{eventLabel(log)}</h2><time className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(log.timestamp)}</time></div>
                <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">{log.details}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400"><span>By {actorLabel(log)}</span>{log.resourceType && log.resourceType !== 'General' && <span>{log.resourceType.replaceAll(/([a-z])([A-Z])/g, '$1 $2')}</span>}</div>
              </div>
            </li>)}</ol>}
        {!loading && total > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5"><p className="text-xs text-slate-500 dark:text-slate-400">{total} {total === 1 ? 'event' : 'events'} · Page {page} of {pages}</p><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700">Previous</button><button type="button" disabled={page >= pages} onClick={() => setPage(current => Math.min(pages, current + 1))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700">Next</button></div></footer>}
      </section>
    </main>
  );
};
