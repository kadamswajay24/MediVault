import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, Loader2, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { clinicalAccessAPI } from '../services/api';
import type { ClinicalAccessRequest } from '../services/api';

const toDateTimeInput = (date: string) => {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
};

export const AccessRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [requests, setRequests] = useState<ClinicalAccessRequest[]>([]);
  const [expiryInputs, setExpiryInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const response = await clinicalAccessAPI.getRequests();
      if (response.success) {
        setRequests(response.requests);
        setExpiryInputs((current) => {
          const next = { ...current };
          response.requests.forEach((request) => {
            if (request.status === 'pending' && !next[request._id]) {
              next[request._id] = toDateTimeInput(request.requestedUntil);
            }
          });
          return next;
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to load clinical access requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchRequests();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchRequests]);

  const handleDecision = async (
    request: ClinicalAccessRequest,
    decision: 'approved' | 'denied'
  ) => {
    setBusyRequestId(request._id);
    setError(null);
    try {
      await clinicalAccessAPI.decideRequest(request._id, {
        decision,
        expiresAt: decision === 'approved' ? new Date(expiryInputs[request._id]).toISOString() : undefined,
      });
      await fetchRequests();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to update this access request.');
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleRevoke = async (request: ClinicalAccessRequest) => {
    if (!confirm('Revoke this staff member’s access to the patient’s clinical data now?')) return;

    setBusyRequestId(request._id);
    setError(null);
    try {
      await clinicalAccessAPI.revokeRequest(request._id);
      await fetchRequests();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to revoke this access grant.');
    } finally {
      setBusyRequestId(null);
    }
  };

  const isStaff = user?.role === 'medical_staff';
  const canDecide = (request: ClinicalAccessRequest) =>
    request.status === 'pending' && !isStaff;
  const canRevoke = (request: ClinicalAccessRequest) =>
    request.status === 'approved' &&
    !request.isExpired &&
    (isStaff ||
      user?.role === 'patient' ||
      user?.role === 'admin');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isStaff ? 'Patient Access Requests' : 'Clinical Data Access'}
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {isStaff
            ? 'Track requests and active, time-limited access grants for specific patients.'
            : user?.role === 'admin'
            ? 'Review requests and active grants. Approve for a duration you select, deny requests, or revoke access.'
            : 'Review clinical access requests. You or an authorized full-access proxy can approve them; administrators can also review pending requests.'}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
          No clinical access requests to display.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const expired =
              request.isExpired ||
              (request.expiresAt ? new Date(request.expiresAt).getTime() <= currentTime : false);
            const status = expired ? 'expired' : request.status;
            return (
              <section
                key={request._id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-900 dark:text-white">
                        {isStaff ? request.patient.name : request.medicalStaff.name}
                      </h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {isStaff ? request.patient.email : request.medicalStaff.email}
                    </p>
                    {!isStaff && (
                      <p className="text-xs text-slate-500">
                        Patient: {request.patient.name}
                      </p>
                    )}
                    <p className="text-sm text-slate-700 dark:text-slate-300">{request.reason}</p>
                    <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock3 className="w-3.5 h-3.5" />
                      {request.status === 'approved' && request.expiresAt
                        ? `Access ends ${new Date(request.expiresAt).toLocaleString()}`
                        : `Requested until ${new Date(request.requestedUntil).toLocaleString()}`}
                    </p>
                    {request.decidedBy && (
                      <p className="text-xs text-slate-500">
                        Decision by {request.decidedBy.name}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canDecide(request) && (
                      <>
                        {request.status === 'pending' && (
                          <>
                            <label className="sr-only" htmlFor={`grant-expiry-${request._id}`}>
                              Grant access until
                            </label>
                            <input
                              id={`grant-expiry-${request._id}`}
                              type="datetime-local"
                              min={toDateTimeInput(new Date(currentTime).toISOString())}
                              value={expiryInputs[request._id] || ''}
                              onChange={(event) =>
                                setExpiryInputs((current) => ({
                                  ...current,
                                  [request._id]: event.target.value,
                                }))
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                              required
                            />
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDecision(request, 'approved')}
                          disabled={busyRequestId === request._id || !expiryInputs[request._id]}
                          className="button-primary inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          {busyRequestId === request._id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(request, 'denied')}
                          disabled={busyRequestId === request._id}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <X className="w-3.5 h-3.5" />
                          Deny
                        </button>
                      </>
                    )}
                    {canRevoke(request) && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(request)}
                        disabled={busyRequestId === request._id}
                        className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                      >
                        Revoke access
                      </button>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
