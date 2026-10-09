import React, { useCallback, useState, useEffect } from 'react';
import {
  History,
  ShieldCheck,
  RefreshCw,
  Filter,
  AlertCircle,
  Upload,
  Eye,
  Trash2,
  UserCheck,
  LogIn,
  Loader2,
} from 'lucide-react';
import { auditAPI } from '../services/api';
import type { AuditLog } from '../types';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await auditAPI.getLogs({
        action: actionFilter === 'ALL' ? undefined : actionFilter,
      });
      if (res.success) {
        setError(null);
        setLogs(res.logs);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchLogs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchLogs]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return {
          icon: LogIn,
          color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
          label: 'User Authentication',
        };
      case 'ACCESS_REQUESTED':
      case 'ACCESS_REQUEST_DECIDED':
      case 'ACCESS_REVOKED':
        return {
          icon: ShieldCheck,
          color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
          label: action.replaceAll('_', ' ').toLowerCase(),
        };
      case 'PROFILE_UPDATE':
        return {
          icon: UserCheck,
          color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
          label: 'Profile Modified',
        };
      case 'RECORD_UPLOAD':
        return {
          icon: Upload,
          color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
          label: 'Document Upload',
        };
      case 'RECORD_VIEW':
        return {
          icon: Eye,
          color: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20',
          label: 'Document Accessed',
        };
      case 'RECORD_DELETE':
        return {
          icon: Trash2,
          color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
          label: 'Document Deleted',
        };
      default:
        return {
          icon: History,
          color: 'bg-slate-100 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700/40',
          label: action,
        };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Compliance &amp; Traceability Trail</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            System Audit Logs
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Real-time audit records tracking sign-ins, document uploads, downloads, views, and profile modifications.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          id="refresh-audit-logs-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors self-start sm:self-auto shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/85 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md shadow-sm transition-colors duration-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Filter Action:
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            'ALL',
            'LOGIN',
            'ACCESS_REQUESTED',
            'ACCESS_REQUEST_DECIDED',
            'ACCESS_REVOKED',
            'RECORD_UPLOAD',
            'RECORD_VIEW',
            'RECORD_DELETE',
            'PROFILE_UPDATE',
          ].map(
            (act) => (
              <button
                key={act}
                onClick={() => setActionFilter(act)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  actionFilter === act
                    ? 'bg-teal-700 dark:bg-teal-500 text-white dark:text-slate-950 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {act.replace('_', ' ')}
              </button>
            )
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table / Cards */}
      <div className="bg-white/85 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md shadow-sm transition-colors duration-200">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            <p className="text-sm text-slate-600 dark:text-slate-400">Loading audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <History className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No audit records found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Events will be automatically logged when you interact with records or profile settings.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Action / Event</th>
                  <th className="py-3.5 px-4">Event Details</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Resource</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">IP Address</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70 font-sans">
                {logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  return (
                    <tr
                      key={log._id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/25 transition-colors group"
                    >
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.color}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{log.action}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200">
                        <p className="font-medium text-xs sm:text-sm">{log.details}</p>
                      </td>
                      <td className="py-3.5 px-4 hidden md:table-cell text-xs text-slate-500 dark:text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                          {log.resourceType || 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 hidden sm:table-cell text-xs font-mono text-slate-500 dark:text-slate-400">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
