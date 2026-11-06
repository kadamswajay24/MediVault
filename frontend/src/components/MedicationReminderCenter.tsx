import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, Clock3, Plus, Trash2, X } from 'lucide-react';
import { medicationReminderAPI, type MedicationReminder } from '../services/api';
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dueReminders, setDueReminders] = useState<MedicationReminder[]>([]);
  const firedSlots = useRef(new Set<string>());

  const loadReminders = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await medicationReminderAPI.getAll();
      setReminders(response.reminders);
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
        const response = await medicationReminderAPI.getAll();
        if (active) {
          setReminders(response.reminders);
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
      setMessage('Reminder removed.');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to remove this reminder.');
    } finally {
      setBusyId(null);
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

      <section className="surface-card mx-4 mt-4 rounded-xl p-4 sm:mx-6" aria-labelledby="medication-reminder-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="medication-reminder-title" className="text-sm font-semibold text-slate-900 dark:text-white">
            <Clock3 className="mr-2 inline h-4 w-4" />Medicine reminders
          </h2>
          <span className="text-[11px] text-slate-500">Daily · India Standard Time</span>
        </div>
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
      </section>
    </>
  );
};
