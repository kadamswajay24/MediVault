import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ArrowRightLeft,
  Trash2,
  CheckCircle2,
  Loader2,
  Heart,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { proxyAPI } from '../services/api';
import type { ProxyDelegation } from '../types';

export const CaregiversPage: React.FC = () => {
  const { activeDependent, setActiveDependent } = useAuth();

  const [proxies, setProxies] = useState<ProxyDelegation[]>([]);
  const [dependents, setDependents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delegate Modal
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [proxyMediVaultId, setProxyMediVaultId] = useState('');
  const [relationship, setRelationship] = useState('Caregiver');
  const [accessLevel, setAccessLevel] = useState<'full' | 'read_only'>('full');
  const [notes, setNotes] = useState('');
  const [delegating, setDelegating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [proxiesRes, dependentsRes] = await Promise.all([
        proxyAPI.getMyProxies(),
        proxyAPI.getMyDependents(),
      ]);

      setError(null);
      if (proxiesRes.success) setProxies(proxiesRes.proxies);
      if (dependentsRes.success) setDependents(dependentsRes.dependents);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load caregivers and dependents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const handleDelegateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proxyMediVaultId.trim()) {
      setModalError('Caregiver MediVault ID is required.');
      return;
    }

    setDelegating(true);
    setModalError(null);

    try {
      const res = await proxyAPI.delegateAccess({
        proxyMediVaultId: proxyMediVaultId.trim(),
        relationship,
        accessLevel,
        notes: notes.trim(),
      });

      if (res.success) {
        setIsDelegateModalOpen(false);
        setProxyMediVaultId('');
        setNotes('');
        fetchData();
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to grant proxy access.');
    } finally {
      setDelegating(false);
    }
  };

  const handleRevokeProxy = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke caregiver access for ${name}?`)) return;

    try {
      await proxyAPI.revokeProxy(id);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to revoke proxy delegation.');
    }
  };

  const handleSwitchToDependent = (dep: any) => {
    setActiveDependent({
      mediVaultId: dep.patient.mediVaultId,
      name: dep.patient.name,
      relationship: dep.relationship,
      accessLevel: dep.accessLevel,
    });
  };

  const handleClearActiveDependent = () => {
    setActiveDependent(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Family &amp; Caregiver Delegation
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
              Dual-Context Access
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Authorize trusted family members or legal guardians to manage records and file insurance claims on your behalf.
          </p>
        </div>

        <button
          onClick={() => {
            setIsDelegateModalOpen(true);
            setModalError(null);
          }}
          className="button-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Authorize New Caregiver
        </button>
      </div>

      {/* Active Management Banner (If acting as caregiver) */}
      {activeDependent && (
        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-teal-800 dark:text-teal-200">
          <div className="flex items-center gap-3">
            <Heart className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold">
                Currently Managing: <span className="underline">{activeDependent.name}</span> ({activeDependent.relationship})
              </p>
              <p className="text-xs text-teal-700/80 dark:text-teal-300/80">
                You are performing actions on behalf of this patient with {activeDependent.accessLevel === 'read_only' ? 'read-only' : 'full'} authority.
              </p>
            </div>
          </div>
          <button
            onClick={handleClearActiveDependent}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-100"
          >
            Exit to My Personal Vault
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/80 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
          <p className="text-sm">Loading delegation records...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Section 1: Dependents I Am Authorized to Manage */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                Dependents I Manage ({dependents.length})
              </h2>
            </div>

            {dependents.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-500 text-xs">
                You have not been appointed as a caregiver for any dependent yet. When a family member grants you proxy access, they will appear here.
              </div>
            ) : (
              <div className="space-y-3">
                {dependents.map((dep) => {
                  const isActive = activeDependent?.mediVaultId === dep.patient.mediVaultId;
                  return (
                    <div
                      key={dep.delegationId}
                      className={`p-4 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-500/40 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {dep.patient.name}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                              {dep.relationship}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">
                            MediVault ID: {dep.patient.mediVaultId}
                          </p>

                          {dep.profile && (
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                Blood: {dep.profile.bloodGroup || 'Unknown'}
                              </span>
                              {dep.profile.allergies && dep.profile.allergies.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                  Allergies: {dep.profile.allergies.join(', ')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {isActive ? (
                          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-700 text-white flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active Vault
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSwitchToDependent(dep)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-1.5"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Switch to Patient
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Caregivers Authorized for My Account */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                My Authorized Caregivers ({proxies.length})
              </h2>
            </div>

            {proxies.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-500 text-xs">
                No caregivers currently have proxy access to your account. Click "Authorize New Caregiver" to grant access to a trusted family member.
              </div>
            ) : (
              <div className="space-y-3">
                {proxies.map((del) => (
                  <div
                    key={del._id}
                    className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {del.proxyUser.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                          {del.relationship}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                            del.accessLevel === 'read_only'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {del.accessLevel === 'read_only' ? 'Read-Only' : 'Full Access'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">
                        MediVault ID: {del.proxyUser.mediVaultId}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Granted {new Date(del.grantedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRevokeProxy(del._id, del.proxyUser.name)}
                      title="Revoke caregiver access"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Authorize New Caregiver Modal */}
      {isDelegateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Authorize Caregiver / Proxy
              </h3>
              <button
                onClick={() => setIsDelegateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-600 dark:text-rose-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleDelegateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Caregiver MediVault ID *
                </label>
                <input
                  type="text"
                  required
                  maxLength={19}
                  pattern="MV-[A-F0-9]{16}"
                  title="Enter the caregiver's 19-character MediVault ID."
                  value={proxyMediVaultId}
                  onChange={(e) => setProxyMediVaultId(e.target.value.toUpperCase())}
                  placeholder="MV-1A2B3C4D5E6F7A8B"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The caregiver must already have a MediVault account and use their MediVault ID.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Relationship *
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="Parent">Parent</option>
                  <option value="Child">Child / Daughter / Son</option>
                  <option value="Spouse">Spouse / Partner</option>
                  <option value="Guardian">Legal Guardian</option>
                  <option value="Caregiver">Caregiver / Nurse</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Access Level *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAccessLevel('full')}
                    className={`p-3 rounded-lg border text-left text-xs transition-all ${
                      accessLevel === 'full'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-bold">Full Access</div>
                    <div className="text-[10px] opacity-80 mt-0.5">Can upload, view &amp; file claims</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccessLevel('read_only')}
                    className={`p-3 rounded-lg border text-left text-xs transition-all ${
                      accessLevel === 'read_only'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-bold">Read-Only</div>
                    <div className="text-[10px] opacity-80 mt-0.5">Can only view records &amp; profile</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Authorization Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Authorized to handle hospital bills"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDelegateModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={delegating}
                  className="button-primary px-4 py-2 text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {delegating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Delegation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
