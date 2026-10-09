import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  FileText,
  AlertCircle,
  Loader2,
  Lock,
  TrendingUp,
  History,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { claimAPI, recordAPI } from '../services/api';
import type { InsuranceClaim, MedicalRecord, ClaimStatus, ClaimType } from '../types';
import { RecordViewerModal } from '../components/RecordViewerModal';

const CLAIM_TYPES: ClaimType[] = [
  'Hospitalization',
  'Outpatient',
  'Prescription Reimbursement',
  'Diagnostic Test',
  'Emergency Care',
  'Dental / Vision',
  'Other',
];

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);

export const ClaimsPage: React.FC = () => {
  const { user, activeDependent } = useAuth();
  const isAgent = user?.role === 'insurance_agent';
  const isAdmin = user?.role === 'admin';

  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [reviewingClaim, setReviewingClaim] = useState<InsuranceClaim | null>(null);
  const [selectedRecordToView, setSelectedRecordToView] = useState<MedicalRecord | null>(null);

  // Submit Claim Form State (Patient)
  const [availableRecords, setAvailableRecords] = useState<MedicalRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [policyNumber, setPolicyNumber] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState(
    isAgent && user?.insuranceDetails?.companyName ? user.insuranceDetails.companyName : ''
  );
  const [claimType, setClaimType] = useState<ClaimType>('Hospitalization');
  const [claimAmount, setClaimAmount] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Review Form State (Agent)
  const [reviewing, setReviewing] = useState(false);
  const [newStatus, setNewStatus] = useState<ClaimStatus>('Approved');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [agentRemarks, setAgentRemarks] = useState('');

  // Supplement Modal State
  const [supplementingClaim, setSupplementingClaim] = useState<InsuranceClaim | null>(null);
  const [supplementAmount, setSupplementAmount] = useState('');
  const [supplementReason, setSupplementReason] = useState('');
  const [supplementing, setSupplementing] = useState(false);
  const [supplementError, setSupplementError] = useState<string | null>(null);

  const fetchClaims = useCallback(async () => {
    try {
      setError(null);
      const res = await claimAPI.getClaims({
        status: statusFilter === 'All' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
      });
      if (res.success) {
        setClaims(res.claims);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load insurance claims.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClaims();
    }, 350);
    return () => clearTimeout(timer);
  }, [activeDependent, fetchClaims]);

  // Load patient's medical records for attaching to claim
  const handleOpenSubmitModal = async () => {
    setIsSubmitModalOpen(true);
    setFormError(null);
    try {
      const res = await recordAPI.getRecords();
      if (res.success) {
        setAvailableRecords(res.records);
      }
    } catch {
      // Fallback
    }
  };

  const handleToggleRecordSelection = (recordId: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]
    );
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyNumber || !insuranceCompany || !claimAmount) {
      setFormError('Policy Number, Insurance Company, and Claim Amount are required.');
      return;
    }

    const numericAmount = parseFloat(claimAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('Please enter a valid positive claim amount.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await claimAPI.submitClaim({
        policyNumber: policyNumber.trim(),
        insuranceCompany: insuranceCompany.trim(),
        claimType,
        claimAmount: numericAmount,
        records: selectedRecordIds,
        hospitalName: hospitalName.trim(),
        patientNotes: patientNotes.trim(),
      });

      if (res.success) {
        setIsSubmitModalOpen(false);
        // Reset form
        setPolicyNumber('');
        setClaimAmount('');
        setHospitalName('');
        setPatientNotes('');
        setSelectedRecordIds([]);
        fetchClaims();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit claim.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReviewModal = (claim: InsuranceClaim) => {
    setReviewingClaim(claim);
    setNewStatus(claim.status === 'Submitted' ? 'Under Review' : claim.status);
    setApprovedAmount(claim.approvedAmount > 0 ? String(claim.approvedAmount) : String(claim.claimAmount));
    setAgentRemarks(claim.agentRemarks || '');
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingClaim) return;

    setReviewing(true);
    try {
      const res = await claimAPI.reviewClaim(reviewingClaim._id, {
        status: newStatus,
        approvedAmount: parseFloat(approvedAmount) || 0,
        agentRemarks: agentRemarks.trim(),
      });

      if (res.success) {
        setReviewingClaim(null);
        fetchClaims();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update claim review.');
    } finally {
      setReviewing(false);
    }
  };

  const isAdjudicated = (claim: InsuranceClaim) =>
    claim.status === 'Approved' || claim.status === 'Rejected';

  const handleOpenSupplementModal = (claim: InsuranceClaim) => {
    setSupplementingClaim(claim);
    setSupplementAmount('');
    setSupplementReason('');
    setSupplementError(null);
  };

  const handleSaveSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplementingClaim) return;

    const numericAmount = parseFloat(supplementAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setSupplementError('Please enter a valid positive additional amount.');
      return;
    }

    const maxAllowed = supplementingClaim.claimAmount - supplementingClaim.approvedAmount;
    if (numericAmount > maxAllowed) {
      setSupplementError(
        `Additional amount cannot exceed ${formatINR(maxAllowed)} (original claim ceiling).`
      );
      return;
    }

    setSupplementing(true);
    setSupplementError(null);
    try {
      const res = await claimAPI.supplementClaim(supplementingClaim._id, {
        additionalAmount: numericAmount,
        reason: supplementReason.trim() || undefined,
      });

      if (res.success) {
        setSupplementingClaim(null);
        fetchClaims();
      }
    } catch (err: any) {
      setSupplementError(err.response?.data?.message || 'Failed to issue supplemental payment.');
    } finally {
      setSupplementing(false);
    }
  };

  const getStatusBadge = (status: ClaimStatus) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'Under Review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Clock className="w-3.5 h-3.5" />
            Under Review
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case 'More Information Needed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Info Needed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <Clock className="w-3.5 h-3.5" />
            Submitted
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isAgent ? 'Insurance Claims Review Portal' : 'Health Insurance Claims'}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-mono font-medium">
              {isAgent ? user?.insuranceDetails?.companyName || 'Claims Adjuster' : 'Reimbursement & Cashless'}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isAgent
              ? 'Verify hospital records, diagnostic bills, and policy coverages to adjudicate submitted claims.'
              : 'Submit claims to your insurer with attached diagnostic reports, discharge summaries, and bills.'}
          </p>
        </div>

        {!isAgent && (
          <button
            onClick={handleOpenSubmitModal}
            className="button-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            File New Claim
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search claim ref #, policy #, or hospital..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {['All', 'Submitted', 'Under Review', 'Approved', 'Rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Claims List Table / Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
          <p className="text-sm">Loading insurance claims...</p>
        </div>
      ) : claims.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-12 text-center bg-white/40 dark:bg-slate-900/40">
          <FileCheck2 className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No insurance claims found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {isAgent
              ? 'No incoming claims currently require review under the selected filter.'
              : 'You have not submitted any insurance claims yet. Attach medical records from your vault to file a new reimbursement.'}
          </p>
          {!isAgent && (
            <button
              onClick={handleOpenSubmitModal}
              className="button-primary mt-4 px-3.5 py-2 rounded-lg text-xs font-semibold"
            >
              Submit First Claim
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Claim Ref &amp; Policy</th>
                  <th className="px-4 py-3.5">Insurance Provider</th>
                  <th className="px-4 py-3.5">Type &amp; Hospital</th>
                  <th className="px-4 py-3.5">Claim Amount</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Attached Vault Docs</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {claims.map((claim) => (
                  <tr key={claim._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                        {claim.claimNumber}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        Pol: {claim.policyNumber}
                      </div>
                      {typeof claim.patient === 'object' && claim.patient?.name && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          Patient: {claim.patient.name}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {claim.insuranceCompany}
                      </div>
                      <div className="text-xs text-slate-400">
                        Filed {new Date(claim.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-slate-800 dark:text-slate-200 font-medium">
                        {claim.claimType}
                      </div>
                      <div className="text-xs text-slate-500">
                        {claim.hospitalName || 'Outpatient Facility'}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {formatINR(claim.claimAmount)}
                      </div>
                      {claim.approvedAmount > 0 && (
                        <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Approved: {formatINR(claim.approvedAmount)}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      {getStatusBadge(claim.status)}
                      {claim.agentRemarks && (
                        <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] truncate" title={claim.agentRemarks}>
                          "{claim.agentRemarks}"
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1 max-w-[220px]">
                        {claim.records && claim.records.length > 0 ? (
                          claim.records.map((rec) => (
                            <button
                              key={rec._id}
                              type="button"
                              onClick={() => setSelectedRecordToView(rec)}
                              className="text-left text-xs text-emerald-600 dark:text-emerald-400 hover:underline truncate flex items-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{rec.title}</span>
                            </button>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No attachments</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {isAgent || isAdmin ? (
                        isAdjudicated(claim) ? (
                          <div className="flex items-center justify-end gap-2">
                            {/* Locked adjudication badge */}
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 dark:text-slate-500">
                              <Lock className="w-3 h-3" />
                              Locked
                            </span>
                            {/* Modify Claim button — only if room for more */}
                            {claim.approvedAmount < claim.claimAmount && (
                              <button
                                onClick={() => handleOpenSupplementModal(claim)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                                Modify Claim
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenReviewModal(claim)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 transition-colors"
                          >
                            Adjudicate
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">
                          {claim.status === 'Approved' ? 'Settlement Ready' : 'In Adjudication'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Patient: Submit Claim Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  File Health Insurance Claim
                </h3>
                <p className="text-xs text-slate-500">
                  Attach clinical documents directly from your MediVault records.
                </p>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-600 dark:text-rose-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitClaim} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Policy Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    placeholder="e.g. POL-9920184-IN"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Insurance Provider *
                  </label>
                  <input
                    type="text"
                    required
                    value={insuranceCompany}
                    onChange={(e) => setInsuranceCompany(e.target.value)}
                    placeholder="e.g. Star Health, Aetna, Cigna"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Claim Type
                  </label>
                  <select
                    value={claimType}
                    onChange={(e) => setClaimType(e.target.value as ClaimType)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {CLAIM_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Claim Amount (INR) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={claimAmount}
                    onChange={(e) => setClaimAmount(e.target.value)}
                    placeholder="4500"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Hospital / Diagnostic Center Name
                </label>
                <input
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="e.g. Metro Specialty Hospital"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              {/* Attach Medical Records from Vault */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  Attach Medical Records from Vault ({selectedRecordIds.length} selected)
                </label>
                {availableRecords.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No records uploaded yet.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                    {availableRecords.map((rec) => (
                      <label
                        key={rec._id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRecordIds.includes(rec._id)}
                          onChange={() => handleToggleRecordSelection(rec._id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-medium text-slate-800 dark:text-slate-200 flex-1 truncate">
                          {rec.title}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          {rec.category}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Patient Notes &amp; Medical Diagnosis
                </label>
                <textarea
                  rows={3}
                  value={patientNotes}
                  onChange={(e) => setPatientNotes(e.target.value)}
                  placeholder="Include discharge details or treatment summary..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="button-primary px-4 py-2 text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Claim to Insurer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Insurance Agent: Adjudication Review Modal */}
      {reviewingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Adjudicate Claim: {reviewingClaim.claimNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Policy: {reviewingClaim.policyNumber} • Requested: {formatINR(reviewingClaim.claimAmount)}
                </p>
              </div>
              <button
                onClick={() => setReviewingClaim(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReview} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Adjudication Decision *
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ClaimStatus)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="Under Review">Under Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="More Information Needed">More Information Needed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Approved Payout Amount (INR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Adjuster Remarks &amp; Deductible Notes
                </label>
                <textarea
                  rows={3}
                  value={agentRemarks}
                  onChange={(e) => setAgentRemarks(e.target.value)}
                  placeholder="e.g. Diagnostic reports verified. Approved minus ₹200 copay."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReviewingClaim(null)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewing}
                  className="button-primary px-4 py-2 text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {reviewing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Adjudication
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Inspection Modal */}
      {selectedRecordToView && (
        <RecordViewerModal
          record={selectedRecordToView}
          isOpen={true}
          onClose={() => setSelectedRecordToView(null)}
        />
      )}

      {/* Supplemental Payment Modal */}
      {supplementingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Modify Claim — Supplemental Payment
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Ref: {supplementingClaim.claimNumber}</p>
              </div>
              <button
                onClick={() => setSupplementingClaim(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Adjudication Summary */}
            <div className="mb-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Original Claimed</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatINR(supplementingClaim.claimAmount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Initially Approved</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatINR(supplementingClaim.approvedAmount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Remaining Ceiling</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {formatINR(supplementingClaim.claimAmount - supplementingClaim.approvedAmount)}
                </span>
              </div>
              {/* Supplemental payment history */}
              {supplementingClaim.supplementalPayments && supplementingClaim.supplementalPayments.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-2 mt-1 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <History className="w-3 h-3" /> Supplement History
                  </span>
                  {supplementingClaim.supplementalPayments.map((sp) => (
                    <div key={sp._id} className="flex justify-between text-[11px] text-slate-500">
                      <span className="truncate max-w-[200px]">{sp.reason}</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400 ml-2">+{formatINR(sp.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {supplementError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {supplementError}
              </div>
            )}

            <form onSubmit={handleSaveSupplement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Additional Amount to Deposit (INR) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={supplementingClaim.claimAmount - supplementingClaim.approvedAmount}
                  required
                  autoFocus
                  value={supplementAmount}
                  onChange={(e) => setSupplementAmount(e.target.value)}
                  placeholder={`Max: ${formatINR(supplementingClaim.claimAmount - supplementingClaim.approvedAmount)}`}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Reason for Supplemental Payment
                </label>
                <textarea
                  rows={2}
                  value={supplementReason}
                  onChange={(e) => setSupplementReason(e.target.value)}
                  placeholder="e.g. Post-discharge physiotherapy approved. Additional ₹5,000 authorized."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSupplementingClaim(null)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={supplementing}
                  className="px-4 py-2 text-sm font-semibold bg-amber-500 text-white hover:bg-amber-400 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {supplementing && <Loader2 className="w-4 h-4 animate-spin" />}
                  <TrendingUp className="w-4 h-4" />
                  Deposit Supplement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
