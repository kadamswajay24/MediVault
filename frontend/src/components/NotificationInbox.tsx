import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/useAuth';
type Notice = { id: string; message: string; at: string; href: string; read: boolean };
export function NotificationInbox() {
  const { activeDependent } = useAuth();
  const [items, setItems] = useState<Notice[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [version, setVersion] = useState(0);
  const readOnly = activeDependent?.accessLevel === 'read_only';
  useEffect(() => {
    let current = true;
    const refresh = async () => {
      try {
        const response = await api.get('/notifications');
        if (current) { setItems(response.data.notifications); setError(''); }
      } catch { if (current) setError('Unable to refresh notifications.'); }
      finally { if (current) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => { current = false; window.clearInterval(timer); };
  }, [version]);
  const markRead = async (id: string) => {
    setBusy(id);
    try { await api.put(`/notifications/${id}/read`); setItems(current => current.map(item => item.id === id ? { ...item, read: true } : item)); }
    catch { setError('Unable to mark notification as read.'); }
    finally { setBusy(''); }
  };
  const unread = items.filter(item => !item.read).length;
  return <details className="surface-card mx-4 mt-4 p-4 sm:mx-6">
    <summary className="cursor-pointer text-sm font-semibold"><Bell className="mr-2 inline h-4 w-4" />Notifications {unread > 0 && <span className="ml-2 rounded bg-[var(--mv-accent-soft)] px-2 py-1 text-[var(--mv-accent)]">{unread} unread</span>}</summary>
    <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
      <p className="text-xs text-slate-500">Latest 50 updates. Refreshes every 30 seconds.</p>
      {error && <p role="alert" className="text-sm text-rose-600">{error} <button onClick={() => setVersion(value => value + 1)} className="underline">Retry</button></p>}
      {loading ? <p className="text-sm">Loading notifications...</p> : !items.length && !error ? <p className="text-sm text-slate-500">No updates yet.</p> : null}
      {items.map(item => <article key={item.id} className="border-t border-slate-200 pt-3 dark:border-slate-700">
        <Link to={item.href} className={`block text-sm ${item.read ? 'text-slate-500' : 'font-semibold'}`}>{item.message}</Link>
        <div className="mt-1 flex items-center justify-between gap-3"><time className="text-xs text-slate-500">{new Date(item.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' })}</time>
          {!item.read && !readOnly && <button disabled={!!busy} onClick={() => void markRead(item.id)} className="text-xs text-[var(--mv-accent)] disabled:opacity-50">{busy === item.id ? 'Saving...' : 'Mark as read'}</button>}
        </div>
      </article>)}
    </div>
  </details>;
}
