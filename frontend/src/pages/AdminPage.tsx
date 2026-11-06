import { formatIndianNumber } from '../utils/indiaFormat';
import React, { useCallback, useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { adminAPI } from '../services/api';
import type { User, UserRole, AdminStatsResponse, AuditLog } from '../types';
import { MEDICAL_SPECIALIZATIONS } from '../constants/medicalSpecializations';
import { HOSPITAL_AFFILIATIONS } from '../constants/hospitalAffiliations';
import { INSURANCE_COMPANIES } from '../constants/insuranceCompanies';
import { PolicyPlanManager } from '../components/AdminPolicyPlans';

export const AdminPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStatsResponse['stats'] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<'users' | 'policies' | 'audit'>('users');
  const [roleFilter, setRoleFilter] = useState('All');
  const [userSearch, setUserSearch] = useState('');

  // Role Edit Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('patient');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [customSpecialization, setCustomSpecialization] = useState('');
  const [hospitalAffiliation, setHospitalAffiliation] = useState('');
  const [customHospitalAffiliation, setCustomHospitalAffiliation] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [customCompanyName, setCustomCompanyName] = useState('');
  const [updatingRole, setUpdatingRole] = useState(false);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [statusChangeUser, setStatusChangeUser] = useState<User | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [statusChangeError, setStatusChangeError] = useState<string | null>(null);
  const [credentialUser, setCredentialUser] = useState<User | null>(null);
  const [credentialReviewNote, setCredentialReviewNote] = useState('');
  const [credentialActionBusy, setCredentialActionBusy] = useState(false);

  const fetchAdminData = useCallback(async () => {
    try {
      const [statsRes, usersRes, logsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers({
          role: roleFilter === 'All' ? undefined : roleFilter,
          search: userSearch.trim() || undefined,
        }),
        activeTab === 'audit' ? adminAPI.getAuditLogs({ limit: 10 }) : Promise.resolve(null),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (usersRes.success) setUsers(usersRes.users);
      if (logsRes?.success) setAuditLogs(logsRes.logs);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, roleFilter, userSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAdminData();
    }, 350);
    return () => clearTimeout(timer);
  }, [fetchAdminData]);

  const requestStatusChange = (user: User) => {
    if (!user.id) {
      alert('This user record is missing its database ID. Refresh the page and try again.');
      return;
    }

    setStatusChangeError(null);
    setStatusChangeUser(user);
  };

  const handleToggleStatus = async () => {
    if (!statusChangeUser?.id) return;
    const user = statusChangeUser;
    const nextStatus = !user.isActive;
    setChangingStatus(true);
    setStatusChangeError(null);
    try {
      const res = await adminAPI.toggleUserStatus(user.id, nextStatus);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isActive: nextStatus } : u))
        );
        setStatusChangeUser(null);
      }
    } catch (err: any) {
      setStatusChangeError(err.response?.data?.message || 'Failed to update user status.');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleApproveUser = async (user: User) => {
    if (!user.id) {
      alert('This user record is missing its database ID. Refresh the page and try again.');
      return;
    }

    try {
      setApprovingUserId(user.id);
      await adminAPI.approveUser(user.id);
      await fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve staff account.');
    } finally {
      setApprovingUserId(null);
    }
  };

  const handleCredentialDecision = async (decision: 'verified' | 'rejected') => {
    if (!credentialUser?.id) return;
    if (decision === 'rejected' && !credentialReviewNote.trim()) {
      alert('Add a reason so the staff applicant knows why the credential was rejected.');
      return;
    }
    setCredentialActionBusy(true);
    try {
      await adminAPI.reviewCredential(credentialUser.id, decision, credentialReviewNote);
      setCredentialUser(null);
      setCredentialReviewNote('');
      await fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Could not save the credential review.');
    } finally {
      setCredentialActionBusy(false);
    }
  };

  const handleViewCredential = async (user: User) => {
    if (!user.id) return;
    try {
      const blob = await adminAPI.getCredentialDocument(user.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      alert('Could not open the credential document.');
    }
  };

  const handleOpenRoleModal = (u: User) => {
    setEditingUser(u);
    setTargetRole(u.role);
    setLicenseNumber(u.medicalStaffDetails?.licenseNumber || '');
    const existingSpecialization = u.medicalStaffDetails?.specialization || '';
    const isStandardSpecialization = MEDICAL_SPECIALIZATIONS.includes(
      existingSpecialization as (typeof MEDICAL_SPECIALIZATIONS)[number]
    );
    setSpecialization(
      existingSpecialization && !isStandardSpecialization ? 'Other' : existingSpecialization
    );
    setCustomSpecialization(
      existingSpecialization && !isStandardSpecialization ? existingSpecialization : ''
    );
    const existingHospital = u.medicalStaffDetails?.hospitalAffiliation || '';
    const isKnownHospital = HOSPITAL_AFFILIATIONS.includes(
      existingHospital as (typeof HOSPITAL_AFFILIATIONS)[number]
    );
    setHospitalAffiliation(existingHospital && !isKnownHospital ? 'Other' : existingHospital);
    setCustomHospitalAffiliation(existingHospital && !isKnownHospital ? existingHospital : '');
    const existingCompany = u.insuranceDetails?.companyName || '';
    const isKnownCompany = INSURANCE_COMPANIES.includes(existingCompany);
    setCompanyName(existingCompany && !isKnownCompany ? 'Other' : existingCompany);
    setCustomCompanyName(existingCompany && !isKnownCompany ? existingCompany : '');
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editingUser.id) {
      alert('This user record is missing its database ID. Refresh the page and try again.');
      return;
    }

    setUpdatingRole(true);
    try {
      const res = await adminAPI.updateUserRole(editingUser.id, {
        role: targetRole,
        medicalStaffDetails: {
          licenseNumber,
          specialization: specialization === 'Other' ? customSpecialization.trim() : specialization,
          hospitalAffiliation:
            hospitalAffiliation === 'Other'
              ? customHospitalAffiliation.trim()
              : hospitalAffiliation,
        },
        insuranceDetails: {
          companyName: companyName === 'Other' ? customCompanyName.trim() : companyName,
          licenseNumber,
        },
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
          Manage accounts and role permissions, review platform activity, and audit security events.
        </p>
      </div>

      {/* Metrics Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 font-semibold uppercase">Total Users</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {formatIndianNumber(stats.totalUsers)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {formatIndianNumber(stats.usersByRole.patient)} Patients • {formatIndianNumber(stats.usersByRole.medical_staff)} Staff
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 font-semibold uppercase">Insurers</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {formatIndianNumber(stats.usersByRole.insurance_agent)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {formatIndianNumber(stats.totalClaims)} Claims Processed
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 font-semibold uppercase">Total Records</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {formatIndianNumber(stats.totalRecords)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Medical records stored</div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs text-slate-500 font-semibold uppercase">Caregiver Proxies</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {formatIndianNumber(stats.activeDelegations)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Active Delegations</div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 lg:col-span-1">
            <span className="text-xs text-slate-500 font-semibold uppercase">Audit Events</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {formatIndianNumber(stats.totalAuditLogs)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Recorded platform activity</div>
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
          Global Audit Trail
        </button>
        <button
          onClick={() => setActiveTab('policies')}
          className={`pb-3 px-1 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'policies'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Marketplace Plans
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
                      <tr key={u.id || u.email} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900 dark:text-white text-xs">
                            {u.name}
                          </div>
                          <div className="text-xs text-slate-500 font-sans mt-0.5">{u.email}</div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-sans font-bold uppercase ${
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
                                <span className="block text-[11px] font-sans text-slate-500">
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
                          {['medical_staff', 'insurance_agent'].includes(u.role) && (
                            <div className="mt-1">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                u.credentialVerification?.status === 'verified' && (!u.credentialVerification.expiresAt || new Date(u.credentialVerification.expiresAt) > new Date())
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : u.credentialVerification?.status === 'rejected'
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              }`}>
                                Credential: {u.credentialVerification?.expiresAt && new Date(u.credentialVerification.expiresAt) <= new Date() ? 'expired' : u.credentialVerification?.status || 'verified'}
                              </span>
                              {u.credentialVerification?.expiresAt && (
                                <span className="mt-1 block text-[10px]">Expires {new Date(u.credentialVerification.expiresAt).toLocaleDateString('en-IN')}</span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {u.approvalStatus === 'pending' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                              <Loader2 className="w-3.5 h-3.5" /> Pending approval
                            </span>
                          ) : u.isActive ? (
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
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                          {['medical_staff', 'insurance_agent'].includes(u.role) && u.credentialVerification?.documentFileName && (
                            <button
                              onClick={() => { setCredentialUser(u); setCredentialReviewNote(u.credentialVerification?.reviewNote || ''); }}
                              className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 rounded"
                            >
                              Review credentials
                            </button>
                          )}
                          {u.approvalStatus === 'pending' && (
                            <button
                              onClick={() => handleApproveUser(u)}
                              disabled={!u.id || approvingUserId === u.id || (['medical_staff', 'insurance_agent'].includes(u.role) && (u.credentialVerification?.status !== 'verified' || Boolean(u.credentialVerification.expiresAt && new Date(u.credentialVerification.expiresAt) <= new Date())))}
                              className="button-primary px-2.5 py-1 text-xs font-semibold disabled:opacity-50 rounded"
                              title={['medical_staff', 'insurance_agent'].includes(u.role) && u.credentialVerification?.status !== 'verified' ? 'Verify credentials before approving this account.' : undefined}
                            >
                              {approvingUserId === u.id ? 'Approving...' : 'Approve'}
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenRoleModal(u)}
                            disabled={!u.id}
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded"
                          >
                            Edit Role
                          </button>

                          {u.approvalStatus !== 'pending' && (
                            <button
                              onClick={() => requestStatusChange(u)}
                              disabled={!u.id}
                              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                                u.isActive
                                  ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                              }`}
                            >
                              {u.isActive ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'policies' ? (
        <PolicyPlanManager audience="admin" />
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
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-sans">
                {auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' })}
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
                <p className="text-xs text-slate-500 font-sans">{editingUser.email}</p>
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
                    <select
                      aria-label="Medical specialization"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded mt-0.5"
                    >
                      <option value="">Select specialization</option>
                      {MEDICAL_SPECIALIZATIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {specialization === 'Other' && (
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400">
                        Enter Specialization
                      </label>
                      <input
                        type="text"
                        value={customSpecialization}
                        onChange={(e) => setCustomSpecialization(e.target.value)}
                        placeholder="Enter specialization"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded mt-0.5"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400">Hospital Affiliation</label>
                    <select
                      aria-label="Hospital or clinic affiliation"
                      value={hospitalAffiliation}
                      onChange={(e) => setHospitalAffiliation(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded mt-0.5"
                    >
                      <option value="">Select hospital / clinic</option>
                      {HOSPITAL_AFFILIATIONS.map((hospital) => (
                        <option key={hospital} value={hospital}>{hospital}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {hospitalAffiliation === 'Other' && (
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400">
                        Enter Hospital / Clinic
                      </label>
                      <input
                        type="text"
                        value={customHospitalAffiliation}
                        onChange={(e) => setCustomHospitalAffiliation(e.target.value)}
                        placeholder="Enter hospital / clinic name"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded mt-0.5"
                      />
                    </div>
                  )}
                </div>
              )}

              {targetRole === 'insurance_agent' && (
                <div className="space-y-3 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                  <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                    Insurance Provider Details
                  </span>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400">Insurance Company Name</label>
                    <select
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded mt-0.5"
                    >
                      <option value="">Select insurance company</option>
                      {INSURANCE_COMPANIES.map((company) => (
                        <option key={company} value={company}>{company}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                    {companyName === 'Other' && (
                      <input
                        type="text"
                        required
                        value={customCompanyName}
                        onChange={(e) => setCustomCompanyName(e.target.value)}
                        placeholder="Enter insurance company name"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded mt-1"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400">Portal-generated Agent ID</label>
                    <p className="mt-1 font-sans text-xs text-slate-700 dark:text-slate-300">
                      {editingUser?.insuranceDetails?.agentId || 'Generated when company is saved'}
                    </p>
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
      {statusChangeUser && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !changingStatus) {
              setStatusChangeUser(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-status-title"
            aria-describedby="account-status-description"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !changingStatus) {
                setStatusChangeUser(null);
              }
            }}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <h2 id="account-status-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {statusChangeUser.isActive ? 'Deactivate account?' : 'Reactivate account?'}
            </h2>
            <p id="account-status-description" className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {statusChangeUser.isActive
                ? `This will prevent ${statusChangeUser.name} from signing in until the account is reactivated.`
                : `This will allow ${statusChangeUser.name} to sign in again.`}
            </p>
            {statusChangeError && (
            <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
              {statusChangeError}
            </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              autoFocus
              disabled={changingStatus}
                onClick={() => setStatusChangeUser(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={changingStatus}
                onClick={() => void handleToggleStatus()}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  statusChangeUser.isActive
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {changingStatus
                  ? 'Updating...'
                  : statusChangeUser.isActive
                    ? 'Deactivate account'
                    : 'Reactivate account'}
              </button>
            </div>
          </section>
        </div>
      )}
      {credentialUser && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="credential-review-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h2 id="credential-review-title" className="text-lg font-bold text-slate-900 dark:text-white">Review staff credentials</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{credentialUser.name} · {credentialUser.role === 'medical_staff' ? credentialUser.medicalStaffDetails?.licenseNumber : credentialUser.insuranceDetails?.licenseNumber}</p>
            <p className="mt-1 text-xs text-slate-500">Expires: {credentialUser.credentialVerification?.expiresAt ? new Date(credentialUser.credentialVerification.expiresAt).toLocaleDateString('en-IN') : 'Not provided'}</p>
            {credentialUser.credentialVerification?.reviewNote && <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Previous review: {credentialUser.credentialVerification.reviewNote}</p>}
            <button type="button" onClick={() => void handleViewCredential(credentialUser)} className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Open submitted document</button>
            <label htmlFor="credential-review-note" className="mt-4 block text-xs font-semibold text-slate-700 dark:text-slate-300">Review note {credentialUser.credentialVerification?.status === 'rejected' ? '(required for rejection)' : '(optional)'}</label>
            <textarea id="credential-review-note" value={credentialReviewNote} onChange={(event) => setCredentialReviewNote(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Record what was checked or what needs correction." />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={credentialActionBusy} onClick={() => setCredentialUser(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Close</button>
              <button type="button" disabled={credentialActionBusy} onClick={() => void handleCredentialDecision('rejected')} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Reject</button>
              <button type="button" disabled={credentialActionBusy || !credentialUser.credentialVerification?.expiresAt || new Date(credentialUser.credentialVerification.expiresAt) <= new Date()} onClick={() => void handleCredentialDecision('verified')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Verify credentials</button>
            </div>
            {credentialUser.credentialVerification?.status === 'rejected' && <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">Rejected documents cannot be resubmitted in-app yet. The applicant must contact an administrator.</p>}
          </section>
        </div>
      )}
    </div>
  );
};
