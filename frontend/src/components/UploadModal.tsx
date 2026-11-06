import { indiaDateInput } from '../utils/indiaFormat';
import React, { useRef, useState } from 'react';
import { X, UploadCloud } from 'lucide-react';
import { RECORD_CATEGORIES } from '../types';
import type { MedicalRecord, RecordCategory } from '../types';
import { recordAPI } from '../services/api';
import { formatFileSize } from '../utils/formatFileSize';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (record: MedicalRecord) => void;
}
interface UploadEntry {
  id: number;
  file: File;
  title: string;
  category: RecordCategory;
  recordDate: string;
  description: string;
  status: 'ready' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const today = indiaDateInput;

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUploadSuccess }) => {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const busy = useRef(false);
  const update = (id: number, changes: Partial<UploadEntry>) => setEntries(current => current.map(entry => entry.id === id ? { ...entry, ...changes } : entry));

  const addFiles = (files: FileList | null) => {
    if (!files || busy.current) return;
    const messages: string[] = [];
    const added: UploadEntry[] = [];
    for (const file of Array.from(files)) {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size === 0 || file.size > 4 * 1024 * 1024) {
        messages.push(`${file.name}: select a nonempty PDF, PNG, or JPG up to 4 MB.`);
        continue;
      }
      if ([...entries, ...added].some(entry => entry.file.name === file.name && entry.file.size === file.size && entry.file.lastModified === file.lastModified)) {
        messages.push(`${file.name} is already in this queue.`);
        continue;
      }
      added.push({ id: nextId.current++, file, title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), category: 'Laboratory Report', recordDate: today(), description: '', status: 'ready', progress: 0 });
    }
    setEntries(current => [...current, ...added]);
    setNotice(messages.join(' '));
    if (picker.current) picker.current.value = '';
  };

  const close = () => {
    if (busy.current) return;
    setEntries([]);
    setNotice('');
    onClose();
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    const pending = entries.filter(entry => entry.status !== 'done');
    if (!pending.length) return;
    if (pending.some(entry => !entry.title.trim() || !entry.recordDate)) {
      setNotice('Give every document a title and record date.');
      return;
    }
    busy.current = true;
    setLoading(true);
    setNotice('');
    try {
      for (const entry of pending) {
        update(entry.id, { status: 'uploading', progress: 0, error: undefined });
        const form = new FormData();
        form.append('file', entry.file);
        form.append('title', entry.title.trim());
        form.append('category', entry.category);
        form.append('recordDate', entry.recordDate);
        form.append('description', entry.description.trim());
        try {
          const response = await recordAPI.uploadRecord(form, progress => update(entry.id, { progress }));
          if (!response.success || !response.record) throw new Error(response.message || 'Upload failed.');
          update(entry.id, { status: 'done', progress: 100 });
          onUploadSuccess(response.record);
        } catch (error: unknown) {
          const failure = error as { response?: { data?: { message?: string } }; message?: string };
          update(entry.id, { status: 'error', error: failure.response?.data?.message || failure.message || 'Upload failed. Please try again.' });
        }
      }
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  if (!isOpen) return null;
  const pendingCount = entries.filter(entry => entry.status !== 'done').length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="upload-heading" aria-busy={loading} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="upload-heading" className="text-lg font-semibold">Upload medical records</h2><p className="mt-1 text-sm text-slate-500">Add several documents. Review each title and date before uploading.</p></div>
          <button type="button" disabled={loading} onClick={close} aria-label="Close upload dialog" className="p-2 disabled:opacity-40"><X size={20} /></button>
        </div>
        <p className="my-4 text-sm text-slate-500">Documents are checked against the patient profile. Unreadable details or mismatches may need review; this does not verify document authenticity.</p>
        {notice && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}
        <form onSubmit={submit} className="space-y-4">
          <button type="button" disabled={loading} onClick={() => picker.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files); }} className="w-full rounded-xl border-2 border-dashed border-slate-300 p-5 text-center disabled:opacity-40 dark:border-slate-700">
            <UploadCloud className="mx-auto mb-2" /><span className="block text-sm font-medium">Choose files or drag them here</span><span className="text-sm text-slate-500">PDF, PNG, JPG - Up to 4 MB each</span>
          </button>
          <input ref={picker} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={event => addFiles(event.target.files)} className="hidden" />
          {entries.map(entry => <fieldset key={entry.id} disabled={loading || entry.status === 'done'} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <legend className="max-w-full truncate px-1 text-sm font-semibold">{entry.file.name}</legend>
            <div className="flex items-center justify-between text-sm"><span className="text-slate-500">{formatFileSize(entry.file.size)}</span>{entry.status !== 'done' && <button type="button" onClick={() => setEntries(current => current.filter(item => item.id !== entry.id))} className="text-rose-600">Remove</button>}</div>
            <label className="block text-sm">Record title<input required maxLength={200} value={entry.title} onChange={event => update(entry.id, { title: event.target.value })} className={inputClass} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">Category<select value={entry.category} onChange={event => update(entry.id, { category: event.target.value as RecordCategory })} className={inputClass}>{RECORD_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
              <label className="block text-sm">Record date<input required type="date" value={entry.recordDate} onChange={event => update(entry.id, { recordDate: event.target.value })} className={inputClass} /></label>
            </div>
            <label className="block text-sm">Notes (optional)<textarea rows={2} value={entry.description} onChange={event => update(entry.id, { description: event.target.value })} className={inputClass} /></label>
            <div aria-live="polite" className="text-sm">
              {entry.status === 'uploading' && <><progress className="w-full" value={entry.progress} max={100} aria-label={`Upload progress for ${entry.file.name}`} /><p>{entry.progress < 100 ? `Uploading ${entry.progress}%` : 'File transferred. Checking and saving...'}</p></>}
              {entry.status === 'done' && <p className="text-teal-700 dark:text-teal-300">Uploaded successfully</p>}
              {entry.status === 'error' && <p role="alert" className="text-rose-600">{entry.error}</p>}
            </div>
          </fieldset>)}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <p role="status" className="text-sm text-slate-500">{entries.filter(entry => entry.status === 'done').length} of {entries.length} uploaded</p>
            <div className="flex gap-3"><button type="button" disabled={loading} onClick={close} className="rounded-lg border px-4 py-2 disabled:opacity-40">{entries.length && !pendingCount ? 'Done' : 'Close'}</button>
              {!!pendingCount && <button type="submit" disabled={loading} className="button-primary rounded-lg px-4 py-2 disabled:opacity-50">{loading ? 'Uploading...' : `Upload ${pendingCount} remaining`}</button>}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
