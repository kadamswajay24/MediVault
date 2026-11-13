import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CalendarPlus, Loader2, Plus } from 'lucide-react';
import { appointmentsAPI, type AppointmentEntry } from '../services/api';
import { NursingOperationsPanel } from './NursingOperationsPanel';
import { NurseAppointmentBookingModal } from './NurseAppointmentBookingModal';

type NursingEntry = { _id: string; entryType: string; note: string; vitals?: Record<string, number>; createdAt: string; nurse?: { name: string } };
type PatientBasics = { allergies: string[]; medicalConditions: string[]; medications: string[]; emergencyContact: { name: string; relationship: string; phone: string } };
const personName = (appointment: AppointmentEntry) => typeof appointment.patient === 'object' ? appointment.patient.name : 'Patient details hidden until access opens';
const dateLabel = (value?: string) => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const NursingWorkspace: React.FC = () => {
  const [appointments, setAppointments] = useState<AppointmentEntry[]>([]);
  const [selected, setSelected] = useState<AppointmentEntry | null>(null);
  const [profile, setProfile] = useState<PatientBasics | null>(null);
  const [entries, setEntries] = useState<NursingEntry[]>([]);
  const [note, setNote] = useState('');
  const [entryType, setEntryType] = useState<'observation' | 'nursing_note'>('observation');
  const [vitals, setVitals] = useState<Record<string, number | ''>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<'appointments' | 'operations'>('appointments');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const refreshAppointments = useCallback(async () => {
    try { const result = await appointmentsAPI.getMyNursingAppointments(); setAppointments(result.appointments); }
    catch (err: any) { setError(err.response?.data?.message || 'Could not load assigned appointments.'); }
  }, []);

  useEffect(() => {
    void refreshAppointments();
    const timer = window.setInterval(() => { setNow(Date.now()); void refreshAppointments(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refreshAppointments]);

  useEffect(() => {
    if (selected && !appointments.some(appointment => appointment._id === selected._id)) {
      setSelected(null); setProfile(null); setEntries([]);
    }
  }, [appointments, selected]);

  const loadCareRecord = async (appointment: AppointmentEntry) => {
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await appointmentsAPI.getNursingEntries(appointment._id);
      setSelected(result.appointment); setProfile(result.profile); setEntries(result.entries);
    } catch (err: any) { setError(err.response?.data?.message || 'This appointment’s nursing access is not open.'); setSelected(null); setProfile(null); setEntries([]); }
    finally { setLoading(false); }
  };

  const saveEntry = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected) return;
    setLoading(true); setError(''); setMessage('');
    try {
      await appointmentsAPI.addNursingEntry(selected._id, { entryType, note, vitals: entryType === 'observation' ? vitals : {} });
      setNote(''); setVitals({}); setMessage('Entry added to the appointment record.');
      const result = await appointmentsAPI.getNursingEntries(selected._id); setEntries(result.entries);
    } catch (err: any) { setError(err.response?.data?.message || 'Could not save entry.'); }
    finally { setLoading(false); }
  };

  const measurementFields: [string, string, number, number][] = [
    ['temperatureC', 'Temperature °C', 25, 45], ['pulseBpm', 'Pulse / min', 20, 300], ['respiratoryRatePerMin', 'Respiratory rate / min', 1, 100],
    ['systolicMmHg', 'Systolic mmHg', 40, 300], ['diastolicMmHg', 'Diastolic mmHg', 20, 200], ['oxygenSaturationPercent', 'O₂ saturation %', 0, 100],
  ];

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-teal-600" /><h1 className="text-xl font-semibold">Nursing care</h1></div><p className="mt-1 text-sm text-slate-500">{view === 'appointments' ? 'Access for assigned, confirmed appointments opens 30 minutes before the visit and closes 30 minutes after it ends. Patients can revoke access.' : 'Manage your shifts, training, team roster and non-patient operational resources.'}</p></header>
    <nav className="flex gap-2 border-b border-slate-200 dark:border-slate-800" aria-label="Nursing workspace sections">
      <button type="button" aria-current={view === 'appointments' ? 'page' : undefined} onClick={() => setView('appointments')} className={`border-b-2 px-3 py-2 text-sm font-medium ${view === 'appointments' ? 'border-teal-600 text-teal-700 dark:text-teal-300' : 'border-transparent text-slate-500'}`}>Appointments</button>
      <button type="button" aria-current={view === 'operations' ? 'page' : undefined} onClick={() => setView('operations')} className={`border-b-2 px-3 py-2 text-sm font-medium ${view === 'operations' ? 'border-teal-600 text-teal-700 dark:text-teal-300' : 'border-transparent text-slate-500'}`}>My shifts &amp; team</button>
    </nav>
    {view === 'operations' ? <NursingOperationsPanel /> : <>
    {error && <p role="alert" className="rounded-lg border border-rose-300 p-3 text-sm text-rose-700">{error}</p>}{message && <p role="status" className="rounded-lg border border-emerald-300 p-3 text-sm text-emerald-700">{message}</p>}
    <section className="surface-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Your assigned appointments</h2>
        <button
          type="button"
          onClick={() => setIsBookingModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg button-primary px-3 py-1.5 text-xs font-semibold"
        >
          <CalendarPlus className="h-4 w-4" /> Book for patient
        </button>
      </div>
      {appointments.length ? appointments.map(appointment => {
      const opensAt = new Date(appointment.nursingAccessOpensAt || '').getTime(); const closesAt = new Date(appointment.nursingAccessClosesAt || '').getTime();
      const open = appointment.status === 'confirmed' && now >= opensAt && now < closesAt && !appointment.nursingAccessRevokedAt;
      return <article key={appointment._id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <div><p className="font-semibold">{personName(appointment)}</p><p className="text-slate-500">{appointment.hospitalName} · Dr. {typeof appointment.doctor === 'object' ? appointment.doctor.name : 'care team'}</p><p className="text-xs text-slate-500">Visit: {dateLabel(appointment.startsAt)} · Access {open ? 'open' : `opens ${dateLabel(appointment.nursingAccessOpensAt)}`}</p></div>
        <button type="button" disabled={!open || loading} onClick={() => void loadCareRecord(appointment)} className="button-primary rounded-lg px-3 py-2 text-xs disabled:opacity-50">{loading && selected?._id === appointment._id ? <Loader2 className="inline h-4 w-4 animate-spin" /> : open ? 'Open care record' : 'Access not open'}</button>
      </article>;
    }) : <p className="text-sm text-slate-500">No confirmed appointments have been assigned to you with patient-approved nursing access.</p>}</section>
    {selected && <>
      <section className="surface-card space-y-3 p-4"><h2 className="font-semibold">Patient-approved basics</h2><div className="grid gap-3 text-sm sm:grid-cols-2"><div><p className="font-medium">Allergies</p><p className="text-slate-600">{profile?.allergies?.join(', ') || 'None recorded'}</p></div><div><p className="font-medium">Conditions</p><p className="text-slate-600">{profile?.medicalConditions?.join(', ') || 'None recorded'}</p></div><div><p className="font-medium">Current medications</p><p className="text-slate-600">{profile?.medications?.join(', ') || 'None recorded'}</p></div><div><p className="font-medium">Emergency contact</p><p className="text-slate-600">{profile?.emergencyContact?.name ? `${profile.emergencyContact.name} (${profile.emergencyContact.relationship}) · ${profile.emergencyContact.phone}` : 'None recorded'}</p></div></div></section>
      <form onSubmit={saveEntry} className="surface-card space-y-4 p-4"><h2 className="font-semibold">Add care entry</h2>
        <label className="block text-sm">Entry type<select value={entryType} onChange={e => setEntryType(e.target.value as typeof entryType)} className="mt-1 block rounded-lg border p-2"><option value="observation">Observation</option><option value="nursing_note">Nursing note</option></select></label>
        {entryType === 'observation' && <div className="grid gap-3 sm:grid-cols-3">{measurementFields.map(([key, label, min, max]) => <label key={key} className="text-xs">{label}<input type="number" min={min} max={max} step="any" value={vitals[key] ?? ''} onChange={e => setVitals(current => ({ ...current, [key]: e.target.value === '' ? '' : Number(e.target.value) }))} className="mt-1 w-full rounded-lg border p-2" /></label>)}</div>}
        <label className="block text-sm">{entryType === 'observation' ? 'Context (optional)' : 'Nursing note'}<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={4000} rows={3} className="mt-1 w-full rounded-lg border p-2" /></label>
        <button disabled={loading} className="button-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"><Plus className="h-4 w-4" />Save entry</button>
      </form>
      <section className="surface-card space-y-3 p-4"><h2 className="font-semibold">Recent nursing entries</h2>{entries.length ? entries.map(entry => <article key={entry._id} className="border-t pt-3 text-sm"><div className="flex justify-between gap-4"><strong>{entry.entryType === 'observation' ? 'Observation' : 'Nursing note'}</strong><time className="text-xs text-slate-500">{dateLabel(entry.createdAt)}</time></div>{entry.note && <p className="mt-2 whitespace-pre-wrap">{entry.note}</p>}{entry.vitals && <p className="mt-2 text-xs text-slate-600">{Object.entries(entry.vitals).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>}<p className="mt-1 text-xs text-slate-500">Recorded by {entry.nurse?.name || 'nurse'}</p></article>) : <p className="text-sm text-slate-500">No entries for this appointment yet.</p>}</section>
    </>}
    </>}
    <NurseAppointmentBookingModal
      isOpen={isBookingModalOpen}
      onClose={() => setIsBookingModalOpen(false)}
      onSuccess={() => void refreshAppointments()}
    />
  </main>;
};
