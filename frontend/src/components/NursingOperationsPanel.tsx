import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, ClipboardCheck, Plus, Save, Trash2, Users } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import {
  nursingOperationsAPI,
  type NurseShiftEntry,
  type NurseTeamResourceEntry,
  type NurseTrainingEntry,
} from '../services/api';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const emptyShifts = (): NurseShiftEntry[] => [];

export const NursingOperationsPanel: React.FC = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<NurseShiftEntry[]>(emptyShifts);
  const [trainingRecords, setTrainingRecords] = useState<NurseTrainingEntry[]>([]);
  const [team, setTeam] = useState<{ id: string; name: string; specialization: string; shiftToday: string; upcomingAppointmentCount: number }[]>([]);
  const [resources, setResources] = useState<NurseTeamResourceEntry[]>([]);
  const [resourceKind, setResourceKind] = useState<NurseTeamResourceEntry['kind']>('checklist_template');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceCategory, setResourceCategory] = useState<NurseTeamResourceEntry['category']>('unit_operations');
  const [resourceNotes, setResourceNotes] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [trainingDraft, setTrainingDraft] = useState<NurseTrainingEntry>({ title: '', provider: '', completedOn: '', expiresOn: '' });
  const [hospitalName, setHospitalName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadOperations = useCallback(async () => {
    setLoading(true); setError('');
    const [profileResult, teamResult, resourcesResult] = await Promise.allSettled([
      nursingOperationsAPI.getMine(), nursingOperationsAPI.getTeam(), nursingOperationsAPI.getResources(),
    ]);
    if (profileResult.status === 'fulfilled') {
      const data = profileResult.value;
      setHospitalName(data.hospitalName);
      setShifts(data.profile.shifts || []);
      setTrainingRecords(data.profile.trainingRecords || []);
    } else setError('Could not load your nursing work profile.');
    if (teamResult.status === 'fulfilled') setTeam(teamResult.value.nurses);
    if (resourcesResult.status === 'fulfilled') setResources(resourcesResult.value.resources);
    if (teamResult.status === 'rejected' || resourcesResult.status === 'rejected') {
      setError('Personal shifts and training are available. Team roster and shared resources need a hospital affiliation.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadOperations(); }, [loadOperations]);

  const toggleDay = (dayOfWeek: number, enabled: boolean) => {
    setShifts(current => enabled
      ? [...current, { dayOfWeek, startTime: '09:00', endTime: '17:00' }].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      : current.filter(shift => shift.dayOfWeek !== dayOfWeek));
  };

  const changeShift = (dayOfWeek: number, key: 'startTime' | 'endTime', value: string) => {
    setShifts(current => current.map(shift => shift.dayOfWeek === dayOfWeek ? { ...shift, [key]: value } : shift));
  };

  const addTraining = () => {
    if (!trainingDraft.title.trim() || !trainingDraft.completedOn) return;
    setTrainingRecords(current => [...current, { ...trainingDraft, title: trainingDraft.title.trim(), provider: trainingDraft.provider.trim() }]);
    setTrainingDraft({ title: '', provider: '', completedOn: '', expiresOn: '' });
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const result = await nursingOperationsAPI.updateMine({ shifts, trainingRecords });
      setShifts(result.profile.shifts); setTrainingRecords(result.profile.trainingRecords); setMessage(result.message);
    } catch (err: any) { setError(err.response?.data?.message || 'Could not save your nursing profile.'); }
    finally { setSaving(false); }
  };

  const createResource = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const checklistItems = checklistText.split('\n').map(item => item.trim()).filter(Boolean);
    try {
      const result = await nursingOperationsAPI.createResource({
        kind: resourceKind, title: resourceTitle, category: resourceCategory, notes: resourceNotes,
        checklistItems: resourceKind === 'checklist_template' ? checklistItems : [],
      });
      setResources(current => [result.resource, ...current]); setResourceTitle(''); setResourceNotes(''); setChecklistText('');
      setMessage(resourceKind === 'checklist_template' ? 'Checklist template shared with your nursing team.' : 'Shift handover posted to your nursing team.');
    } catch (err: any) { setError(err.response?.data?.message || 'Could not save this team resource.'); }
    finally { setSaving(false); }
  };

  const removeResource = async (resourceId: string) => {
    setSaving(true); setError('');
    try { await nursingOperationsAPI.deleteResource(resourceId); setResources(current => current.filter(item => item._id !== resourceId)); }
    catch (err: any) { setError(err.response?.data?.message || 'Could not remove this team resource.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-lg border border-rose-300 p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-emerald-300 p-3 text-sm text-emerald-700">{message}</p>}
    {loading ? <div className="surface-card p-8 text-center text-sm text-slate-500">Loading nursing operations…</div> : <>
      <form onSubmit={saveProfile} className="surface-card space-y-5 p-4 sm:p-5">
        <header><div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-teal-600" /><h2 className="font-semibold">My shifts &amp; training</h2></div><p className="mt-1 text-xs text-slate-500">Personal professional information only. Training records are self-reported and are not credential verification.</p></header>
        <div className="space-y-2">{WEEKDAYS.map((day, dayOfWeek) => {
          const shift = shifts.find(item => item.dayOfWeek === dayOfWeek);
          return <div key={day} className="grid items-center gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[1fr_1fr_1fr] dark:border-slate-800">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(shift)} onChange={event => toggleDay(dayOfWeek, event.target.checked)} />{day}</label>
            {shift ? <><label className="text-xs text-slate-500">From<input type="time" value={shift.startTime} onChange={event => changeShift(dayOfWeek, 'startTime', event.target.value)} className="mt-1 block w-full rounded border p-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-xs text-slate-500">To<input type="time" value={shift.endTime} onChange={event => changeShift(dayOfWeek, 'endTime', event.target.value)} className="mt-1 block w-full rounded border p-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" /></label></> : <p className="text-xs text-slate-400 sm:col-span-2">Not available</p>}
          </div>;
        })}</div>
        <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800"><h3 className="text-sm font-semibold">Training &amp; competency records</h3>
          <div className="grid gap-2 sm:grid-cols-2"><input value={trainingDraft.title} onChange={e => setTrainingDraft(current => ({ ...current, title: e.target.value }))} maxLength={120} placeholder="Course or competency" className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-950" /><input value={trainingDraft.provider} onChange={e => setTrainingDraft(current => ({ ...current, provider: e.target.value }))} maxLength={120} placeholder="Provider (optional)" className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-950" /><label className="text-xs text-slate-500">Completed on<input type="date" value={trainingDraft.completedOn} onChange={e => setTrainingDraft(current => ({ ...current, completedOn: e.target.value }))} className="mt-1 block w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-xs text-slate-500">Expires on (optional)<input type="date" value={trainingDraft.expiresOn} onChange={e => setTrainingDraft(current => ({ ...current, expiresOn: e.target.value }))} className="mt-1 block w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-950" /></label></div>
          <button type="button" onClick={addTraining} disabled={!trainingDraft.title.trim() || !trainingDraft.completedOn} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"><Plus className="h-3.5 w-3.5" />Add training</button>
          {trainingRecords.length > 0 && <ul className="divide-y divide-slate-200 dark:divide-slate-800">{trainingRecords.map((record, index) => <li key={record._id || `${record.title}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm"><span><strong>{record.title}</strong><span className="text-slate-500">{record.provider ? ` · ${record.provider}` : ''} · completed {record.completedOn}{record.expiresOn ? ` · expires ${record.expiresOn}` : ''}</span></span><button type="button" onClick={() => setTrainingRecords(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${record.title}`} className="text-slate-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></li>)}</ul>}
        </div>
        <button disabled={saving} className="button-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"><Save className="h-4 w-4" />Save shifts &amp; training</button>
      </form>

      <section className="surface-card space-y-3 p-4 sm:p-5"><header className="flex items-center gap-2"><Users className="h-4 w-4 text-teal-600" /><h2 className="font-semibold">Nursing team · {hospitalName || 'Hospital not set'}</h2></header>{team.length ? <div className="grid gap-2 sm:grid-cols-2">{team.map(nurse => <article key={nurse.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><p className="font-medium">{nurse.name}</p><p className="text-xs text-slate-500">{nurse.specialization} · {nurse.shiftToday}</p><p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{nurse.upcomingAppointmentCount} confirmed upcoming appointments</p></article>)}</div> : <p className="text-sm text-slate-500">No other approved nurses are listed at this hospital.</p>}</section>

      <section className="surface-card space-y-4 p-4 sm:p-5"><header className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-teal-600" /><h2 className="font-semibold">Team checklists &amp; shift handover</h2></header>
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">Operational team board only. Do not enter patient names, MediVault IDs, or health information here.</p>
        <form onSubmit={createResource} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs">Resource type<select value={resourceKind} onChange={e => setResourceKind(e.target.value as NurseTeamResourceEntry['kind'])} className="mt-1 block w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="checklist_template">Reusable checklist</option><option value="shift_handover">Shift handover</option></select></label><label className="text-xs">Title<input required value={resourceTitle} onChange={e => setResourceTitle(e.target.value)} maxLength={100} className="mt-1 block w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder={resourceKind === 'checklist_template' ? 'Opening shift checklist' : 'Evening shift handover'} /></label></div>
          {resourceKind === 'shift_handover' ? <><label className="block text-xs">Category<select value={resourceCategory} onChange={e => setResourceCategory(e.target.value as NurseTeamResourceEntry['category'])} className="mt-1 block rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="staffing">Staffing</option><option value="equipment">Equipment</option><option value="supplies">Supplies</option><option value="unit_operations">Unit operations</option></select></label><label className="block text-xs">Operational update<textarea value={resourceNotes} onChange={e => setResourceNotes(e.target.value)} maxLength={1200} rows={3} className="mt-1 w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Share staffing, equipment, supplies, or unit status only." /></label></> : <label className="block text-xs">Checklist items, one per line<textarea required value={checklistText} onChange={e => setChecklistText(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder={'Check equipment stock\nReview unit supplies\nConfirm shift coverage'} /></label>}
          <button disabled={saving || !resourceTitle.trim()} className="button-primary rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40">{saving ? 'Saving…' : 'Share with nursing team'}</button>
        </form>
        {resources.length ? <div className="space-y-2">{resources.map(resource => <article key={resource._id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{resource.title}</h3><p className="text-xs text-slate-500">{resource.kind === 'checklist_template' ? 'Reusable checklist' : `Shift handover · ${resource.category.replaceAll('_', ' ')}`} · {typeof resource.author === 'string' ? 'Nursing team' : resource.author.name} · {new Date(resource.createdAt).toLocaleDateString('en-IN')}</p></div>{typeof resource.author === 'object' && resource.author.id === user?.id && <button type="button" disabled={saving} onClick={() => void removeResource(resource._id)} aria-label={`Remove ${resource.title}`} className="text-slate-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}</div>{resource.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{resource.notes}</p>}{resource.checklistItems.length > 0 && <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">{resource.checklistItems.map((item, index) => <li key={`${item}-${index}`} className="flex items-start gap-2"><span className="mt-1 h-3.5 w-3.5 shrink-0 rounded border border-slate-400" />{item}</li>)}</ul>}</article>)}</div> : <p className="text-sm text-slate-500">No shared nursing checklists or handovers yet.</p>}
      </section>
    </>}
  </div>;
};
