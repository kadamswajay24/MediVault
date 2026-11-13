import { ClaimTimeline } from '../components/ClaimTimeline';
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
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { claimAPI, hospitalAPI, policyAPI } from '../services/api';
import type { InsuranceClaim, MedicalRecord, ClaimStatus, ClaimType, PolicyEnrollment } from '../types';
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
  const isInsurerAdmin = user?.role === 'insurer_admin';
  const isClaimsReviewer = isAgent || isInsurerAdmin;
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
  const [availablePolicies, setAvailablePolicies] = useState<PolicyEnrollment[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [claimType, setClaimType] = useState<ClaimType>('Hospitalization');
  const [claimAmount, setClaimAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [availableHospitals, setAvailableHospitals] = useState<{ id: string; name: string; city: string; state: string }[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('');

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

  const selectedPolicy = availablePolicies.find((policy) => policy._id === selectedPolicyId);

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

  // Load the patient's enrolled policies for selecting a policy on the claim.
  const handleOpenSubmitModal = async () => {
    setIsSubmitModalOpen(true);
    setFormError(null);
    setSelectedPolicyId('');
    setClaimAmount('');
    setClaimType('Hospitalization');
    setSelectedHospitalId('');
    setLoadingPolicies(true);
    try {
      const [res, hospitalRes] = await Promise.all([policyAPI.getMyPolicies(), hospitalAPI.directory()]);
      if (res.success) setAvailablePolicies(res.policies);
      else setFormError('Unable to load your policies. Please try again.');
      setAvailableHospitals(hospitalRes.hospitals);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Unable to load your policies. Please try again.');
    } finally {
      setLoadingPolicies(false);
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy || !claimAmount) {
      setFormError('Please select a policy and enter a claim amount.');
      return;
    }

    if (!/^\d+(?:\.\d{1,2})?$/.test(claimAmount.trim())) {
      setFormError('Please enter a valid positive claim amount.');
      return;
    }
    const numericAmount = Number(claimAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Please enter a valid positive claim amount.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await claimAPI.submitClaim({
        policyNumber: selectedPolicy.policyNumber,
        insuranceCompany: selectedPolicy.provider,
        hospitalId: selectedHospitalId || undefined,
        claimType,
        claimAmount: numericAmount,
      });

      if (res.success) {
        setIsSubmitModalOpen(false);
        // Reset form
        setSelectedPolicyId('');
        setClaimType('Hospitalization');
        setClaimAmount('');
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
    if (!/^\d+(?:\.\d{1,2})?$/.test(approvedAmount.trim()) || !Number.isFinite(Number(approvedAmount)) || Number(approvedAmount) < 0 || Number(approvedAmount) > reviewingClaim.claimAmount) {
      alert('Enter a valid payout amount up to the original claim amount, with no more than two decimal places.');
      return;
    }

    setReviewing(true);
    try {
      const res = await claimAPI.reviewClaim(reviewingClaim._id, {
        status: newStatus,
        approvedAmount: Number(approvedAmount),
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

    if (!/^\d+(?:\.\d{1,2})?$/.test(supplementAmount.trim())) {
      setSupplementError('Please enter a valid positive additional amount.');
      return;
    }
    const numericAmount = Number(supplementAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
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

  const renderClaimActions = (claim: InsuranceClaim) => {
    if (isClaimsReviewer || isAdmin) {
      if (isAdjudicated(claim)) {
        return (
          <div className="flex items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-sans text-slate-400 dark:text-slate-500">
              <Lock className="w-3 h-3" />
              Locked
            </span>
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
        );
      }

      return (
        <button
          onClick={() => handleOpenReviewModal(claim)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 transition-colors"
        >
          Adjudicate
        </button>
      );
    }

    return (
      <span className="text-xs text-slate-400">
        {claim.status === 'Approved' ? 'Approved' : claim.status === 'Rejected' ? 'Rejected' : claim.status === 'More Information Needed' ? 'Action needed' : 'Awaiting review'}
      </span>
    );
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
              {isClaimsReviewer ? 'Insurance Claims Review Portal' : 'Health Insurance Claims'}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-sans font-medium">
              {isClaimsReviewer ? user?.insuranceDetails?.companyName || 'Insurer' : 'Reimbursement & Cashless'}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isClaimsReviewer
              ? isInsurerAdmin ? 'Review all claims for your insurer, including claims without a hospital assignment.' : 'Review claims for hospitals assigned to your insurer account.'
              : 'Submit claims to your insurer with attached diagnostic reports, discharge summaries, and bills.'}
          </p>
        </div>

        {!isClaimsReviewer && (
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
          {['All', 'Submitted', 'Under Review', 'More Information Needed', 'Approved', 'Rejected'].map((status) => (
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
            {isClaimsReviewer
              ? 'No incoming claims currently require review under the selected filter.'
              : 'You have not submitted any insurance claims yet. Attach medical records from your vault to file a new reimbursement.'}
          </p>
          {!isClaimsReviewer && (
            <button
              onClick={handleOpenSubmitModal}
              className="button-primary mt-4 px-3.5 py-2 rounded-lg text-xs font-semibold"
            >
              Submit First Claim
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3 xl:hidden">
            {claims.map((claim) => (
              <article
                key={claim._id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <header className="flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="break-all font-sans text-sm font-bold text-slate-900 dark:text-white">
                      {claim.claimNumber}
                    </h2>
                    <p className="mt-1 break-all text-xs text-slate-500">
                      Policy {claim.policyNumber}
                    </p>
                    {typeof claim.patient === 'object' && claim.patient?.name && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        Patient: {claim.patient.name}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">{getStatusBadge(claim.status)}</div>
                </header>

                <dl className="grid grid-cols-1 gap-3 py-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-slate-500">Insurance provider</dt>
                    <dd className="mt-0.5 break-words font-medium text-slate-800 dark:text-slate-200">
                      {claim.insuranceCompany}
                    </dd>
                    <dd className="mt-0.5 text-xs text-slate-500">
                      Filed {new Date(claim.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-slate-500">Claim details</dt>
                    <dd className="mt-0.5 break-words font-medium text-slate-800 dark:text-slate-200">
                      {claim.claimType}
                    </dd>
                    <dd className="mt-0.5 break-words text-xs text-slate-500">
                      {claim.hospitalName || 'Outpatient Facility'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Claim amount</dt>
                    <dd className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                      {formatINR(claim.claimAmount)}
                    </dd>
                    {claim.approvedAmount > 0 && (
                      <dd className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Approved: {formatINR(claim.approvedAmount)}
                      </dd>
                    )}
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-slate-500">Attached vault documents</dt>
                    <dd className="mt-1 flex min-w-0 flex-col gap-1">
                      {claim.records?.length ? (
                        claim.records.map((record) => (
                          <button
                            key={record._id}
                            type="button"
                            onClick={() => setSelectedRecordToView(record)}
                            className="flex min-w-0 items-center gap-1.5 text-left text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{record.title}</span>
                          </button>
                        ))
                      ) : (
                        <span className="text-xs italic text-slate-400">No attachments</span>
                      )}
                    </dd>
                  </div>
                </dl>

                {claim.agentRemarks && (
                  <p className="border-t border-slate-200 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    {claim.agentRemarks}
                  </p>
                )}
                <footer className="mt-3 flex justify-end border-t border-slate-200 pt-3 dark:border-slate-800">
                  <div>{renderClaimActions(claim)}<ClaimTimeline claim={claim} /></div>
                </footer>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="w-[16%] px-4 py-3.5">Claim Ref &amp; Policy</th>
                  <th className="w-[14%] px-4 py-3.5">Insurance Provider</th>
                  <th className="w-[14%] px-4 py-3.5">Type &amp; Hospital</th>
                  <th className="w-[12%] px-4 py-3.5">Claim Amount</th>
                  <th className="w-[15%] px-4 py-3.5">Status</th>
                  <th className="w-[14%] px-4 py-3.5">Attached Vault Docs</th>
                  <th className="w-[15%] px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {claims.map((claim) => (
                  <tr key={claim._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-sans font-bold text-xs text-slate-900 dark:text-slate-100">
                        {claim.claimNumber}
                      </div>
                      <div className="break-all text-xs text-slate-500 font-sans mt-0.5">
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
                        Filed {new Date(claim.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="break-words text-slate-800 dark:text-slate-200 font-medium">
                        {claim.claimType}
                      </div>
                      <div className="break-words text-xs text-slate-500">
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
                      <div>{renderClaimActions(claim)}<ClaimTimeline claim={claim} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </>
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
                  Select one of your policies and enter the claim details.
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
              {availablePolicies.length === 0 && !loadingPolicies ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  You do not have any policies yet. Visit{' '}
                  <Link to="/policies" className="font-semibold underline">
                    My Policies
                  </Link>{' '}
                  to enroll before filing a claim.
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Policy Number *
                    </label>
                    <select
                      required
                      value={selectedPolicyId}
                      onChange={(e) => setSelectedPolicyId(e.target.value)}
                      disabled={loadingPolicies}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="">
                        {loadingPolicies ? 'Loading your policies...' : 'Select a policy'}
                      </option>
                      {availablePolicies.map((policy) => (
                        <option key={policy._id} value={policy._id}>
                          {policy.policyNumber} · {policy.planName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPolicy && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950">
                      <p className="text-xs text-slate-500">Insurance Provider</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {selectedPolicy.provider}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedPolicy.planName} · Coverage {formatINR(selectedPolicy.coverageAmount)}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Hospital (optional)</label>
                    <select value={selectedHospitalId} onChange={(event) => setSelectedHospitalId(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                      <option value="">No hospital / other facility</option>
                      {availableHospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name} · {hospital.city}, {hospital.state}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Claims without a selected hospital go to your insurer's admin queue.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Claim For *
                      </label>
                      <select
                        required
                        value={claimType}
                        onChange={(e) => setClaimType(e.target.value as ClaimType)}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      >
                        {CLAIM_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
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
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                    </div>
                  </div>
                </>
              )}

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
                  disabled={submitting || loadingPolicies || availablePolicies.length === 0}
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
                <span className="font-sans font-bold text-slate-900 dark:text-white">{formatINR(supplementingClaim.claimAmount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Initially Approved</span>
                <span className="font-sans font-bold text-emerald-600 dark:text-emerald-400">{formatINR(supplementingClaim.approvedAmount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Remaining Ceiling</span>
                <span className="font-sans font-bold text-amber-600 dark:text-amber-400">
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
                      <span className="font-sans text-amber-600 dark:text-amber-400 ml-2">+{formatINR(sp.amount)}</span>
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
                  maxLength={1000}
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
