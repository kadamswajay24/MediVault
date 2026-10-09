import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { adminAPI } from '../services/api';
import type { User, UserRole, AdminStatsResponse, AuditLog } from '../types';

export const AdminPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStatsResponse['stats'] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [roleFilter, setRoleFilter] = useState('All');
  const [userSearch, setUserSearch] = useState('');

  // Role Edit Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('patient');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [hospitalAffiliation, setHospitalAffiliation] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [updatingRole, setUpdatingRole] = useState(false);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, logsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers({
          role: roleFilter === 'All' ? undefined : roleFilter,
          search: userSearch.trim() || undefined,
        }),
        adminAPI.getAuditLogs({ limit: 40 }),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (usersRes.success) setUsers(usersRes.users);
      if (logsRes.success) setAuditLogs(logsRes.logs);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [roleFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAdminData();
    }, 350);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const handleToggleStatus = async (user: User) => {
    const nextStatus = !user.isActive;
    if (
      !confirm(
        `Are you sure you want to ${nextStatus ? 'activate' : 'deactivate'} account: ${user.name}?`
      )
    ) {
      return;
    }

    try {
      const res = await adminAPI.toggleUserStatus(user.id, nextStatus);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isActive: nextStatus } : u))
        );
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user status.');
    }
  };

  const handleOpenRoleModal = (u: User) => {
    setEditingUser(u);
    setTargetRole(u.role);
    setLicenseNumber(u.medicalStaffDetails?.licenseNumber || '');
    setSpecialization(u.medicalStaffDetails?.specialization || '');
    setHospitalAffiliation(u.medicalStaffDetails?.hospitalAffiliation || '');
    setCompanyName(u.insuranceDetails?.companyName || '');
    setAgentId(u.insuranceDetails?.agentId || '');
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setUpdatingRole(true);
    try {
      const res = await adminAPI.updateUserRole(editingUser.id, {
        role: targetRole,
        medicalStaffDetails: { licenseNumber, specialization, hospitalAffiliation },
        insuranceDetails: { companyName, agentId, licenseNumber },
      });

      if (res.success) {
        setEditingUser(null);
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user role.');
    } finally {
      setUpdatingRole(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            System Administration &amp; Governance
          </h1>
          <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium">
            Platform Governor
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Oversee all registered stakeholders, configure role permissions, monitor system-wide compliance, and audit security events.
        </p>
      </div>

      {/* Metrics Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 font-semibold uppercase">Total Users</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.totalUsers}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats.usersByRole.patient} Patients • {stats.usersByRole.medical_staff} Staff
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 font-semibold uppercase">Insurers</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.usersByRole.insurance_agent}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats.totalClaims} Claims Processed
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 font-semibold uppercase">Total Records</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.totalRecords}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Encrypted on Disk</div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 font-semibold uppercase">Caregiver Proxies</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.activeDelegations}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Active Delegations</div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 lg:col-span-1">
            <span className="text-xs text-slate-500 font-semibold uppercase">Compliance Logs</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.totalAuditLogs}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">HIPAA Compliant</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-1 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'users'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Stakeholder Directory ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-1 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'audit'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Global Audit Trail ({auditLogs.length})
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user by name or email..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {['All', 'patient', 'medical_staff', 'insurance_agent', 'admin'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    roleFilter === r
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {r === 'All' ? 'All Roles' : r.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* User Table */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 text-sm">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-2" />
              Loading user directory...
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-3.5">User</th>
                      <th className="px-4 py-3.5">Assigned Role</th>
                      <th className="px-4 py-3.5">Role Metadata</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Registered</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900 dark:text-white text-xs">
                            {u.name}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{u.email}</div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                              u.role === 'admin'
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                : u.role === 'medical_staff'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                : u.role === 'insurance_agent'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                          {u.role === 'medical_staff' && (
                            <div>
                              <span>Lic: {u.medicalStaffDetails?.licenseNumber || '—'}</span>
                              {u.medicalStaffDetails?.specialization && (
                                <span className="block text-[11px] text-slate-500">
                                  {u.medicalStaffDetails.specialization}
                                </span>
                              )}
                            </div>
                          )}
                          {u.role === 'insurance_agent' && (
                            <div>
                              <span>Co: {u.insuranceDetails?.companyName || '—'}</span>
                              {u.insuranceDetails?.agentId && (
                                <span className="block text-[11px] font-mono text-slate-500">
                                  ID: {u.insuranceDetails.agentId}
                                </span>
                              )}
                            </div>
                          )}
                          {u.role === 'patient' && (
                            <span className="text-slate-400 italic">Personal Vault Owner</span>
                          )}
                          {u.role === 'admin' && (
                            <span className="text-purple-600 font-semibold text-[11px]">
                              Full System Authority
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                              <XCircle className="w-3.5 h-3.5" /> Suspended
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => handleOpenRoleModal(u)}
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded"
                          >
                            Edit Role
                          </button>

                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${
                              u.isActive
                                ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            }`}
                          >
                            {u.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Global Compliance Audit Log */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Target User</th>
                  <th className="px-4 py-3">Performed By</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Details &amp; Audit Trail</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                {auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                      {typeof log.user === 'object' && log.user?.name ? log.user.name : String(log.user)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {log.performedBy && typeof log.performedBy === 'object' && log.performedBy.name
                        ? log.performedBy.name
                        : 'Self'}
                    </td>
                    <td className="px-4 py-3 font-bold text-purple-600 dark:text-purple-400">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-700 dark:text-slate-300 max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{log.ipAddress || '127.0.0.1'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Modifier Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reassign Role for {editingUser.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Stakeholder Role *
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                >
                  <option value="patient">Patient (Vault Owner)</option>
                  <option value="medical_staff">Medical Staff (Doctor / Clinician)</option>
                  <option value="insurance_agent">Insurance Agent (Claims Adjuster)</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              {targetRole === 'medical_staff' && (
                <div className="space-y-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                  <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">
                    Medical Staff Credentials
                  </span>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400">Medical License Number</label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="e.g. MCI-MH-9921"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400">Specialization</label>
                    <input
                      type="text"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="e.g. Cardiologist"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400">Hospital Affiliation</label>
                    <input
                      type="text"
                      value={hospitalAffiliation}
                      onChange={(e) => setHospitalAffiliation(e.target.value)}
                      placeholder="e.g. Apollo Hospital"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded mt-0.5"
                    />
                  </div>
                </div>
              )}

              {targetRole === 'insurance_agent' && (
                <div className="space-y-3 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                  <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                    Insurance Provider Details
                  </span>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400">Insurance Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Star Health"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400">Agent Identifier</label>
                    <input
                      type="text"
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      placeholder="e.g. AGT-STAR-881"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded mt-0.5"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingRole}
                  className="px-4 py-2 text-sm font-semibold bg-purple-600 text-white hover:bg-purple-500 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {updatingRole ? 'Updating...' : 'Save Role Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
