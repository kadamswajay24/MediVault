const formatINR = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
import mongoose from 'mongoose';
import InsuranceClaim, { CLAIM_STATUSES, CLAIM_TYPES, ADJUDICATED_STATUSES } from '../models/InsuranceClaim.js';
import MedicalRecord from '../models/MedicalRecord.js';
import PolicyEnrollment from '../models/PolicyEnrollment.js';
import InsuranceCompany from '../models/InsuranceCompany.js';
import Hospital from '../models/Hospital.js';
import { createAuditLog } from '../services/auditService.js';
import { readFile, sendFile } from '../services/fileStorageService.js';
import { escapeRegex } from '../utils/regexSearch.js';

// Helper to generate human-readable unique claim ID
const generateClaimNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CLM-${new Date().getFullYear()}-${timestamp}${random}`;
};

const agentCanAccessClaim = (agent, claim) => {
  return Boolean(agent.insuranceCompany && claim.insuranceCompanyId && String(agent.insuranceCompany) === String(claim.insuranceCompanyId) && claim.hospital && agent.insuranceAgentHospitals?.some((hospitalId) => String(hospitalId) === String(claim.hospital)));
};
const companyAdminCanAccessClaim = (admin, claim) => Boolean(admin.insuranceCompany && claim.insuranceCompanyId && String(admin.insuranceCompany) === String(claim.insuranceCompanyId));
const parsePositiveAmount = (value) => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value.trim()))) return Number.NaN;
  const amount = Number(value);
  return Number.isFinite(amount) && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7 ? amount : Number.NaN;
};
const parseClaimDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};

// @desc    Submit a new insurance claim with attached records
// @route   POST /api/claims
// @access  Private (Patient or Authorized Caregiver)
export const submitClaim = async (req, res, next) => {
  try {
    const {
      policyNumber,
      hospitalId,
      claimType,
      claimAmount,
      records = [],
      patientNotes,
      admissionDate,
      dischargeDate,
    } = req.body;

    const patientId = req.effectivePatientId || req.user._id;

    if (typeof policyNumber !== 'string' || !policyNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Policy number is required.',
      });
    }

    const policy = await PolicyEnrollment.findOne({ patient: patientId, policyNumber: policyNumber.trim(), status: 'demo_active' });
    if (!policy?.insuranceCompany) return res.status(400).json({ success: false, message: 'Select an active policy enrollment before filing a claim.' });
    const company = await InsuranceCompany.findOne({ _id: policy.insuranceCompany, isActive: true, 'verification.status': 'verified', 'verification.expiresAt': { $gt: new Date() } });
    if (!company) return res.status(400).json({ success: false, message: 'The insurer for this policy is not currently active.' });
    let hospital = null;
    if (hospitalId) {
      if (!mongoose.Types.ObjectId.isValid(hospitalId)) return res.status(400).json({ success: false, message: 'Select an active hospital from the directory.' });
      hospital = await Hospital.findOne({ _id: hospitalId, isActive: true }).select('_id name');
      if (!hospital) return res.status(400).json({ success: false, message: 'The selected hospital is not currently available.' });
    }

    const numericAmount = parsePositiveAmount(claimAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > Number.MAX_SAFE_INTEGER) {
      return res.status(400).json({
        success: false,
        message: 'A valid positive claim amount is required.',
      });
    }

    if (!Array.isArray(records) || records.length > 20 || records.some((id) => !mongoose.Types.ObjectId.isValid(id)) || new Set(records.map(String)).size !== records.length) {
      return res.status(400).json({ success: false, message: 'Choose up to 20 distinct valid medical records.' });
    }
    if (!CLAIM_TYPES.includes(claimType || 'Hospitalization')) return res.status(400).json({ success: false, message: 'Select a valid claim type.' });
    if (typeof patientNotes !== 'undefined' && (typeof patientNotes !== 'string' || patientNotes.length > 1000)) return res.status(400).json({ success: false, message: 'Claim notes must be 1,000 characters or fewer.' });
    const parsedAdmissionDate = admissionDate ? parseClaimDate(admissionDate) : null;
    const parsedDischargeDate = dischargeDate ? parseClaimDate(dischargeDate) : null;
    if ((admissionDate && !parsedAdmissionDate) || (dischargeDate && !parsedDischargeDate) || (parsedAdmissionDate && parsedDischargeDate && parsedDischargeDate < parsedAdmissionDate)) {
      return res.status(400).json({ success: false, message: 'Enter valid admission and discharge dates, with discharge on or after admission.' });
    }

    // Verify attached records belong to this patient
    if (records.length > 0) {
      const validRecordsCount = await MedicalRecord.countDocuments({
        _id: { $in: records },
        user: patientId,
      });

      if (validRecordsCount !== records.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected medical records do not belong to this patient.',
        });
      }
    }

    const claimNumber = generateClaimNumber();

    const claim = await InsuranceClaim.create({
      patient: patientId,
      claimNumber,
      policyNumber: policyNumber.trim(),
      insuranceCompany: company.name,
      insuranceCompanyId: company._id,
      claimType: claimType || 'Hospitalization',
      claimAmount: numericAmount,
      approvedAmount: 0,
      status: 'Submitted',
      history: [{ status: 'Submitted', note: 'Claim submitted', actor: req.user._id }],
      records,
      patientNotes: patientNotes ? patientNotes.trim() : '',
      hospital: hospital?._id || null,
      hospitalName: hospital?.name || '',
      admissionDate: parsedAdmissionDate || undefined,
      dischargeDate: parsedDischargeDate || undefined,
    });

    // Audit log
    await createAuditLog({
      userId: patientId,
      performedBy: req.user._id,
      action: 'CLAIM_SUBMITTED',
      details: `Insurance claim ${claimNumber} submitted to ${company.name} for amount ${new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(numericAmount)}`,
      resourceId: claim._id,
      resourceType: 'InsuranceClaim',
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'Insurance claim submitted successfully.',
      claim,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get insurance claims (role-aware: patient sees own; insurance agent sees company's; admin sees all)
// @route   GET /api/claims
// @access  Private
export const getClaims = async (req, res, next) => {
  try {
    const { status, search, insuranceCompany } = req.query;
    let query = {};

    if (req.user.role === 'patient') {
      // Patient or caregiver viewing dependent
      query.patient = req.effectivePatientId || req.user._id;
    } else if (req.user.role === 'insurance_agent') {
      if (!req.user.insuranceCompany || !req.user.insuranceAgentHospitals?.length) return res.status(403).json({ success: false, message: 'Your insurer and hospital assignments are required to access claims.' });
      query.insuranceCompanyId = req.user.insuranceCompany;
      query.hospital = { $in: req.user.insuranceAgentHospitals || [] };
    } else if (req.user.role === 'insurer_admin') {
      if (!req.user.insuranceCompany) return res.status(403).json({ success: false, message: 'Your insurer assignment is required to access claims.' });
      query.insuranceCompanyId = req.user.insuranceCompany;
    } else if (req.user.role === 'admin') {
      // Admin can filter by company
      if (insuranceCompany) {
        query.insuranceCompany = { $regex: escapeRegex(String(insuranceCompany).trim()), $options: 'i' };
      }
    }

    if (status && status !== 'All' && CLAIM_STATUSES.includes(status)) {
      query.status = status;
    }

    if (search && search.trim()) {
      const sanitized = escapeRegex(search.trim());
      query.$or = [
        { claimNumber: { $regex: sanitized, $options: 'i' } },
        { policyNumber: { $regex: sanitized, $options: 'i' } },
        { hospitalName: { $regex: sanitized, $options: 'i' } },
      ];
    }

    const claims = await InsuranceClaim.find(query)
      .populate('patient', 'name email mediVaultId phone')
      .populate('assignedAgent', 'name email insuranceDetails')
      .populate('records', 'title category fileName fileSize fileType recordDate')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: claims.length,
      claims,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single claim details by ID
// @route   GET /api/claims/:id
// @access  Private
export const getClaimById = async (req, res, next) => {
  try {
    const claim = await InsuranceClaim.findById(req.params.id)
      .populate('patient', 'name email mediVaultId phone')
      .populate('assignedAgent', 'name email insuranceDetails')
      .populate('records');

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Insurance claim not found.',
      });
    }

    // Role-based authorization check
    const isPatient = claim.patient._id.toString() === req.user._id.toString();
    const isProxy =
      req.proxyDelegation &&
      req.proxyDelegation.patient._id.toString() === claim.patient._id.toString();
    const isAgent = req.user.role === 'insurance_agent';
    const isCompanyAdmin = req.user.role === 'insurer_admin';
    const isAdmin = req.user.role === 'admin';

    if ((isAgent && !agentCanAccessClaim(req.user, claim)) || (isCompanyAdmin && !companyAdminCanAccessClaim(req.user, claim))) {
      return res.status(404).json({ success: false, message: 'Insurance claim not found.' });
    }

    if (!isPatient && !isProxy && !isAgent && !isCompanyAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access. You do not have permission to view this claim.',
      });
    }

    return res.status(200).json({
      success: true,
      claim,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Review and update claim status (Insurance Agent / Admin)
// @route   PUT /api/claims/:id/review
// @access  Private (Insurance Agent or Admin)
export const reviewClaim = async (req, res, next) => {
  try {
    const { status, approvedAmount, agentRemarks } = req.body;

    if (!status || !CLAIM_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Valid status is required: ${CLAIM_STATUSES.join(', ')}`,
      });
    }
    if (approvedAmount !== undefined) {
      const numericApproved = parsePositiveAmount(approvedAmount);
      if (!Number.isFinite(numericApproved) || numericApproved < 0 || numericApproved > Number.MAX_SAFE_INTEGER) return res.status(400).json({ success: false, message: 'Enter a valid non-negative payout amount with up to two decimal places.' });
    }
    if (agentRemarks !== undefined && (typeof agentRemarks !== 'string' || agentRemarks.length > 1000)) return res.status(400).json({ success: false, message: 'Adjuster remarks must be 1,000 characters or fewer.' });

    const claim = await InsuranceClaim.findById(req.params.id).populate('patient', 'name email mediVaultId');
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Insurance claim not found.',
      });
    }

    if ((req.user.role === 'insurance_agent' && !agentCanAccessClaim(req.user, claim)) || (req.user.role === 'insurer_admin' && !companyAdminCanAccessClaim(req.user, claim))) {
      return res.status(404).json({ success: false, message: 'Insurance claim not found.' });
    }
    if (approvedAmount !== undefined && Number(approvedAmount) > claim.claimAmount) return res.status(400).json({ success: false, message: 'Approved payout cannot exceed the original claim amount.' });

    // Block re-adjudication of already-finalized claims — use supplementClaim instead
    if (ADJUDICATED_STATUSES.includes(claim.status)) {
      return res.status(409).json({
        success: false,
        message: `Claim ${claim.claimNumber} has already been adjudicated as [${claim.status}]. Use the Modify Claim (supplement) endpoint to issue additional payments.`,
        adjudicationLocked: true,
      });
    }

    claim.status = status;
    claim.assignedAgent = req.user._id;
    claim.agentRemarks = agentRemarks ? agentRemarks.trim() : claim.agentRemarks;
    claim.reviewedAt = new Date();

    if (approvedAmount !== undefined) {
      claim.approvedAmount = Number(approvedAmount);
    } else if (status === 'Approved' && claim.approvedAmount === 0) {
      claim.approvedAmount = claim.claimAmount;
    }

    claim.history.push({ status: claim.status, note: claim.agentRemarks || 'Claim reviewed', actor: req.user._id });
    await claim.save();

    // Audit log
    await createAuditLog({
      userId: claim.patient._id,
      performedBy: req.user._id,
      action: 'CLAIM_REVIEWED',
      details: `Insurance claim ${claim.claimNumber} evaluated to [${status}] by agent ${req.user.name}. Approved payout: ${formatINR(claim.approvedAmount)}`,
      resourceId: claim._id,
      resourceType: 'InsuranceClaim',
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Claim ${claim.claimNumber} updated to ${status}.`,
      claim,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Issue a supplemental additional payment on an already-adjudicated claim
// @route   PUT /api/claims/:id/supplement
// @access  Private (Insurance Agent or Admin)
export const supplementClaim = async (req, res, next) => {
  try {
    const { additionalAmount, reason } = req.body;

    const numericAdditional = parsePositiveAmount(additionalAmount);
    if (!Number.isFinite(numericAdditional) || numericAdditional <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid positive additional amount is required for a supplemental payment.',
      });
    }
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 1000)) return res.status(400).json({ success: false, message: 'Payment reason must be 1,000 characters or fewer.' });

    const claim = await InsuranceClaim.findById(req.params.id).populate('patient', 'name email mediVaultId');
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Insurance claim not found.',
      });
    }

    if ((req.user.role === 'insurance_agent' && !agentCanAccessClaim(req.user, claim)) || (req.user.role === 'insurer_admin' && !companyAdminCanAccessClaim(req.user, claim))) {
      return res.status(404).json({ success: false, message: 'Insurance claim not found.' });
    }

    // Supplement is only valid on already-adjudicated claims
    if (!ADJUDICATED_STATUSES.includes(claim.status)) {
      return res.status(400).json({
        success: false,
        message: `Claim ${claim.claimNumber} has not been adjudicated yet (status: ${claim.status}). Please use the Adjudicate endpoint first.`,
      });
    }

    // Enforce: supplement cannot exceed the original claimed amount
    const newTotal = claim.approvedAmount + numericAdditional;
    if (newTotal > claim.claimAmount) {
      return res.status(400).json({
        success: false,
        message: `Supplemental payment would exceed the original claimed amount of ${formatINR(claim.claimAmount)}. Maximum additional amount allowed: ${formatINR((claim.claimAmount - claim.approvedAmount))}.`,
      });
    }

    // Record the supplemental payment
    claim.supplementalPayments.push({
      amount: numericAdditional,
      reason: reason ? reason.trim() : 'Supplemental payment authorized by adjuster',
      authorizedBy: req.user._id,
      depositedAt: new Date(),
    });

    claim.approvedAmount = newTotal;

    // If claim was Rejected but is now receiving a supplement, bump to Approved
    if (claim.status === 'Rejected') {
      claim.status = 'Approved';
    }

    claim.history.push({ status: claim.status, note: reason?.trim() || 'Supplemental payment authorized', actor: req.user._id });
    await claim.save();

    await createAuditLog({
      userId: claim.patient._id,
      performedBy: req.user._id,
      action: 'CLAIM_REVIEWED',
      details: `Supplemental payment of ${formatINR(numericAdditional)} issued on claim ${claim.claimNumber} by ${req.user.name}. Total approved: ${formatINR(newTotal)}. Reason: ${reason || 'N/A'}`,
      resourceId: claim._id,
      resourceType: 'InsuranceClaim',
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Supplemental payment of ${formatINR(numericAdditional)} successfully deposited. New total approved amount: ${formatINR(newTotal)}.`,
      claim,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Secure document download for insurance agent on attached claim records
// @route   GET /api/claims/:claimId/records/:recordId/download
// @access  Private (Insurance Agent or Admin)
export const downloadClaimRecord = async (req, res, next) => {
  try {
    const { claimId, recordId } = req.params;

    const claim = await InsuranceClaim.findById(claimId);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Insurance claim not found.',
      });
    }

    if ((req.user.role === 'insurance_agent' && !agentCanAccessClaim(req.user, claim)) || (req.user.role === 'insurer_admin' && !companyAdminCanAccessClaim(req.user, claim))) {
      return res.status(403).json({ success: false, message: 'You cannot access documents for this insurance company.' });
    }

    // Verify that the record is in this claim
    const hasRecord = claim.records.some((r) => r.toString() === recordId);
    if (!hasRecord) {
      return res.status(403).json({
        success: false,
        message: 'This document was not submitted as part of the specified insurance claim.',
      });
    }

    const record = await MedicalRecord.findById(recordId);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Physical record not found.',
      });
    }

    if (record.user.toString() !== claim.patient.toString()) {
      return res.status(403).json({ success: false, message: 'Document does not belong to this claim patient.' });
    }
    const buffer = await readFile(record);

    // Audit view
    await createAuditLog({
      userId: claim.patient,
      performedBy: req.user._id,
      action: 'RECORD_VIEW',
      details: `Insurance agent (${req.user.name}) downloaded claim-attached document "${record.fileName}" for claim ${claim.claimNumber}`,
      resourceId: record._id,
      resourceType: 'MedicalRecord',
      req,
    });

    return sendFile(res, record, buffer);
  } catch (error) {
    next(error);
  }
};
