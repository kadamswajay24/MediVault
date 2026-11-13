import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, CheckCircle2, ChevronDown, Clock3, Plus, RotateCcw, Trash2, X, XCircle } from 'lucide-react';
import {
  medicationReminderAPI,
  type MedicationReminder,
  type MedicationAdherenceItem,
} from '../services/api';
import { useAuth } from '../context/useAuth';

const getIndiaDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const getIndiaTime = () => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(new Date());

export const MedicationReminderCenter: React.FC = () => {
  const { activeDependent } = useAuth();
  const readOnly = activeDependent?.accessLevel === 'read_only';
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [medicationName, setMedicationName] = useState('');
  const [time, setTime] = useState('09:00');
  const [confirmedCurrentUse, setConfirmedCurrentUse] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dueReminders, setDueReminders] = useState<MedicationReminder[]>([]);
  const [adherenceData, setAdherenceData] = useState<{
    date: string;
    adherenceRate: number;
    totalScheduled: number;
    takenCount: number;
    items: MedicationAdherenceItem[];
  } | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const firedSlots = useRef(new Set<string>());

  const loadAdherence = useCallback(async () => {
    try {
      const data = await medicationReminderAPI.getTodayAdherence();
      setAdherenceData(data);
    } catch {
      // Non-blocking for adherence
    }
  }, []);

  const loadReminders = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [remResponse, adhResponse] = await Promise.all([
        medicationReminderAPI.getAll(),
        medicationReminderAPI.getTodayAdherence().catch(() => null),
      ]);
      setReminders(remResponse.reminders);
      if (adhResponse) setAdherenceData(adhResponse);
      setError(null);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to load medicine reminders.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [remResponse, adhResponse] = await Promise.all([
          medicationReminderAPI.getAll(),
          medicationReminderAPI.getTodayAdherence().catch(() => null),
        ]);
        if (active) {
          setReminders(remResponse.reminders);
          if (adhResponse) setAdherenceData(adhResponse);
          setError(null);
        }
      } catch (requestError: any) {
        if (active) setError(requestError.response?.data?.message || 'Unable to load medicine reminders.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    const checkDueReminders = () => {
      const currentTime = getIndiaTime();
      const slot = `${getIndiaDate()}-${currentTime}`;
      const due = reminders.filter((reminder) => {
        const key = `${reminder._id}-${slot}`;
        if (reminder.time !== currentTime || firedSlots.current.has(key)) return false;
        firedSlots.current.add(key);
        return true;
      });
      if (due.length) setDueReminders((current) => [...current, ...due]);
    };
    checkDueReminders();
    const timer = window.setInterval(checkDueReminders, 15_000);
    return () => window.clearInterval(timer);
  }, [reminders]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirmedCurrentUse || saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await medicationReminderAPI.create({
        medicationName: medicationName.trim(),
        time,
        confirmCurrentUse: confirmedCurrentUse,
      });
      setMedicationName('');
      setConfirmedCurrentUse(false);
      setMessage('Daily reminder added. It will alert you while MediVault is open.');
      await loadReminders();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to save this reminder.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (reminder: MedicationReminder) => {
    setBusyId(reminder._id);
    setError(null);
    setMessage(null);
    try {
      await medicationReminderAPI.remove(reminder._id);
      setReminders((current) => current.filter((item) => item._id !== reminder._id));
      setDueReminders((current) => current.filter((item) => item._id !== reminder._id));
      await loadAdherence();
      setMessage('Reminder removed.');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to remove this reminder.');
    } finally {
      setBusyId(null);
    }
  };

  const handleLogAdherence = async (reminderId: string, status: 'taken' | 'skipped') => {
    setLoggingId(reminderId);
    setError(null);
    try {
      await medicationReminderAPI.logAdherence({ reminderId, status });
      await loadAdherence();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to record medication adherence.');
    } finally {
      setLoggingId(null);
    }
  };

  const handleResetAdherence = async (reminderId: string) => {
    setLoggingId(reminderId);
    setError(null);
    try {
      await medicationReminderAPI.resetAdherence(reminderId);
      await loadAdherence();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to reset dose status.');
    } finally {
      setLoggingId(null);
    }
  };

  return (
    <>
      {dueReminders.length > 0 && (
        <div role="alert" aria-live="assertive" className="fixed inset-x-4 top-24 z-40 mx-auto max-w-2xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xl dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Medicine reminder</p>
              {dueReminders.map((reminder) => (
                <p key={reminder._id} className="mt-1 text-sm">It’s time for {reminder.medicationName} ({reminder.time} IST).</p>
              ))}
              <p className="mt-2 text-xs">Follow the instructions from your healthcare professional.</p>
            </div>
            <button type="button" aria-label="Dismiss medicine reminder" onClick={() => setDueReminders([])} className="rounded-md p-1 hover:bg-amber-100 dark:hover:bg-amber-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <details className="surface-card mx-4 mt-4 rounded-xl p-4 sm:mx-6" open={isExpanded} onToggle={(event) => setIsExpanded(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mv-accent)]">
          <span id="medication-reminder-title" className="text-sm font-semibold text-slate-900 dark:text-white">
            <Clock3 className="mr-2 inline h-4 w-4" />Medicine reminders
          </span>
          <span className="text-[11px] text-slate-500">Daily · India Standard Time</span>
          <span className="text-[11px] text-slate-500">{reminders.length} set</span>
          <ChevronDown className="medication-reminder-chevron h-4 w-4 text-slate-500" aria-hidden="true" />
        </summary>
        <div>
        <p className="mt-1 text-xs text-slate-500">
          Reminders run while MediVault is open. They may not alert you if the app or browser is closed.
        </p>

        {!readOnly && <form onSubmit={handleCreate} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Medicine you currently take
            <input
              value={medicationName}
              onChange={(event) => setMedicationName(event.target.value)}
              required
              minLength={2}
              maxLength={120}
              placeholder="Enter medicine name"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Reminder time (IST)
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <button type="submit" disabled={!confirmedCurrentUse || saving} className="inline-flex items-center justify-center gap-1.5 rounded-lg button-primary px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" />{saving ? 'Saving…' : 'Add reminder'}
          </button>
          <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 sm:col-span-3">
            <input
              type="checkbox"
              checked={confirmedCurrentUse}
              onChange={(event) => setConfirmedCurrentUse(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--mv-accent)]"
            />
            I confirm I currently take this medicine and chose this reminder time based on my clinician’s instructions.
          </label>
        </form>}

        {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        {message && <p role="status" className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">{message}</p>}

        {/* Today's Dose Checklist & Adherence Tracker */}
        {reminders.length > 0 && adherenceData && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Today's Doses ({adherenceData.date})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Check off doses as you take them to keep track of your daily routine.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Adherence:
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    adherenceData.adherenceRate === 100
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : adherenceData.adherenceRate >= 50
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {adherenceData.takenCount}/{adherenceData.totalScheduled} taken ({adherenceData.adherenceRate}%)
                </span>
              </div>
            </div>

            <ul className="mt-3 space-y-2">
              {adherenceData.items.map((item) => {
                const isLogging = loggingId === item.reminderId;
                return (
                  <li
                    key={item.reminderId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {item.medicationName}
                      </p>
                      <p className="text-[11px] text-slate-500">Scheduled: {item.time} IST</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'taken' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Taken
                        </span>
                      ) : item.status === 'skipped' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <XCircle className="h-3.5 w-3.5" /> Skipped
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          Pending
                        </span>
                      )}

                      {!readOnly && (
                        <div className="flex items-center gap-1 border-l border-slate-200 pl-2 dark:border-slate-800">
                          {item.status !== 'taken' && (
                            <button
                              type="button"
                              disabled={isLogging}
                              onClick={() => void handleLogAdherence(item.reminderId, 'taken')}
                              className="rounded px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                              title="Mark as taken"
                            >
                              Take
                            </button>
                          )}
                          {item.status !== 'skipped' && (
                            <button
                              type="button"
                              disabled={isLogging}
                              onClick={() => void handleLogAdherence(item.reminderId, 'skipped')}
                              className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
                              title="Mark as skipped"
                            >
                              Skip
                            </button>
                          )}
                          {item.status !== 'pending' && (
                            <button
                              type="button"
                              disabled={isLogging}
                              onClick={() => void handleResetAdherence(item.reminderId)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              title="Reset dose status"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Your daily reminders</h3>
          {loading ? <p className="mt-2 text-xs text-slate-500">Loading reminders…</p> : reminders.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No reminders set.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
              {reminders.map((reminder) => (
                <li key={reminder._id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 text-sm text-slate-800 dark:text-slate-200">{reminder.medicationName}</span>
                  <span className="shrink-0 text-xs text-slate-500">{reminder.time} IST</span>
                  {!readOnly && <button type="button" onClick={() => void handleRemove(reminder)} disabled={busyId === reminder._id} aria-label={`Remove reminder for ${reminder.medicationName}`} className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-300">
                    <Trash2 className="h-4 w-4" />
                  </button>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-2 text-[10px] text-slate-500">MediVault does not decide whether a medicine is appropriate or confirm that a dose was taken. Follow your prescription and ask your clinician or pharmacist about changes.</p>
        </div>
      </details>
    </>
  );
};
