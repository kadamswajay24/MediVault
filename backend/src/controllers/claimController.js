import path from 'path';
import fs from 'fs';
import InsuranceClaim, { CLAIM_STATUSES, ADJUDICATED_STATUSES } from '../models/InsuranceClaim.js';
import MedicalRecord from '../models/MedicalRecord.js';
import { createAuditLog } from '../services/auditService.js';
import { getUploadDirectory } from '../middleware/uploadMiddleware.js';

// Helper to generate human-readable unique claim ID
const generateClaimNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CLM-${new Date().getFullYear()}-${timestamp}${random}`;
};

// @desc    Submit a new insurance claim with attached records
// @route   POST /api/claims
// @access  Private (Patient or Authorized Caregiver)
export const submitClaim = async (req, res, next) => {
  try {
    const {
      policyNumber,
      insuranceCompany,
      claimType,
      claimAmount,
      records = [],
      patientNotes,
      hospitalName,
      admissionDate,
      dischargeDate,
    } = req.body;

    const patientId = req.effectivePatientId || req.user._id;

    if (!policyNumber || !policyNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Policy number is required.',
      });
    }

    if (!insuranceCompany || !insuranceCompany.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Insurance company name is required.',
      });
    }

    const numericAmount = parseFloat(claimAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid positive claim amount is required.',
      });
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
      insuranceCompany: insuranceCompany.trim(),
      claimType: claimType || 'Hospitalization',
      claimAmount: numericAmount,
      approvedAmount: 0,
      status: 'Submitted',
      records,
      patientNotes: patientNotes ? patientNotes.trim() : '',
      hospitalName: hospitalName ? hospitalName.trim() : '',
      admissionDate: admissionDate ? new Date(admissionDate) : undefined,
      dischargeDate: dischargeDate ? new Date(dischargeDate) : undefined,
    });

    // Audit log
    await createAuditLog({
      userId: patientId,
      performedBy: req.user._id,
      action: 'CLAIM_SUBMITTED',
      details: `Insurance claim ${claimNumber} submitted to ${insuranceCompany} for amount $${numericAmount}`,
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
      // Agent sees claims for their company (or all if company not set)
      if (req.user.insuranceDetails?.companyName) {
        query.insuranceCompany = {
          $regex: new RegExp(`^${req.user.insuranceDetails.companyName.trim()}$`, 'i'),
        };
      } else if (insuranceCompany) {
        query.insuranceCompany = { $regex: new RegExp(insuranceCompany.trim(), 'i') };
      }
    } else if (req.user.role === 'admin') {
      // Admin can filter by company
      if (insuranceCompany) {
        query.insuranceCompany = { $regex: new RegExp(insuranceCompany.trim(), 'i') };
      }
    }

    if (status && status !== 'All' && CLAIM_STATUSES.includes(status)) {
      query.status = status;
    }

    if (search && search.trim()) {
      const sanitized = search.trim();
      query.$or = [
        { claimNumber: { $regex: sanitized, $options: 'i' } },
        { policyNumber: { $regex: sanitized, $options: 'i' } },
        { hospitalName: { $regex: sanitized, $options: 'i' } },
      ];
    }

    const claims = await InsuranceClaim.find(query)
      .populate('patient', 'name email phone')
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
      .populate('patient', 'name email phone')
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
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isProxy && !isAgent && !isAdmin) {
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

    const claim = await InsuranceClaim.findById(req.params.id).populate('patient', 'name email');
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Insurance claim not found.',
      });
    }

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
      const numericApproved = parseFloat(approvedAmount);
      if (!isNaN(numericApproved) && numericApproved >= 0) {
        claim.approvedAmount = numericApproved;
      }
    } else if (status === 'Approved' && claim.approvedAmount === 0) {
      claim.approvedAmount = claim.claimAmount;
    }

    await claim.save();

    // Audit log
    await createAuditLog({
      userId: claim.patient._id,
      performedBy: req.user._id,
      action: 'CLAIM_REVIEWED',
      details: `Insurance claim ${claim.claimNumber} evaluated to [${status}] by agent ${req.user.name}. Approved payout: $${claim.approvedAmount}`,
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

    const numericAdditional = parseFloat(additionalAmount);
    if (isNaN(numericAdditional) || numericAdditional <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid positive additional amount is required for a supplemental payment.',
      });
    }

    const claim = await InsuranceClaim.findById(req.params.id).populate('patient', 'name email');
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Insurance claim not found.',
      });
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
        message: `Supplemental payment would exceed the original claimed amount of $${claim.claimAmount.toLocaleString()}. Maximum additional amount allowed: $${(claim.claimAmount - claim.approvedAmount).toLocaleString()}.`,
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

    await claim.save();

    await createAuditLog({
      userId: claim.patient._id,
      performedBy: req.user._id,
      action: 'CLAIM_REVIEWED',
      details: `Supplemental payment of $${numericAdditional.toLocaleString()} issued on claim ${claim.claimNumber} by ${req.user.name}. Total approved: $${newTotal.toLocaleString()}. Reason: ${reason || 'N/A'}`,
      resourceId: claim._id,
      resourceType: 'InsuranceClaim',
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Supplemental payment of $${numericAdditional.toLocaleString()} successfully deposited. New total approved amount: $${newTotal.toLocaleString()}.`,
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

    const uploadDir = getUploadDirectory();
    const filePath = path.join(uploadDir, record.storedFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Physical document file missing from storage.',
      });
    }

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

    return res.download(filePath, record.fileName);
  } catch (error) {
    next(error);
  }
};
