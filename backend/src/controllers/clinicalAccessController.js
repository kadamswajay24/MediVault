import ClinicalAccessRequest from '../models/ClinicalAccessRequest.js';
import ProxyDelegation from '../models/ProxyDelegation.js';
import User from '../models/User.js';
import { createAuditLog } from '../services/auditService.js';

const populateRequest = (query) =>
  query
    .populate('patient', 'name email mediVaultId')
    .populate('medicalStaff', 'name email mediVaultId medicalStaffDetails')
    .populate('decidedBy', 'name role mediVaultId');

export const searchPatientsForClinicalAccess = async (req, res, next) => {
  try {
    const mediVaultId = String(req.query.search || '').trim().toUpperCase();
    if (!/^MV-[A-F0-9]{16}$/.test(mediVaultId)) {
      return res.status(200).json({ success: true, patients: [] });
    }

    const patient = await User.findOne({ mediVaultId, role: 'patient', isActive: true })
      .select('name mediVaultId');

    return res.status(200).json({ success: true, patients: patient ? [patient] : [] });
  } catch (error) {
    next(error);
  }
};

export const createClinicalAccessRequest = async (req, res, next) => {
  try {
    if (req.user.role !== 'medical_staff') {
      return res.status(403).json({
        success: false,
        message: 'Only approved medical staff can request clinical access.',
      });
    }

    const { patientMediVaultId, reason, requestedUntil } = req.body;
    const expiration = new Date(requestedUntil);

    if (
      typeof patientMediVaultId !== 'string' ||
      !/^MV-[A-F0-9]{16}$/i.test(patientMediVaultId.trim()) ||
      typeof reason !== 'string' ||
      !reason.trim() ||
      reason.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: 'A valid patient MediVault ID and a reason of up to 1000 characters are required.',
      });
    }
    if (!requestedUntil || Number.isNaN(expiration.getTime()) || expiration <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Requested access must end at a valid future date and time.',
      });
    }

    const patient = await User.findOne({
      mediVaultId: patientMediVaultId.trim().toUpperCase(),
      role: 'patient',
      isActive: true,
    }).select('_id mediVaultId');
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient account not found.' });
    }

    const pendingRequest = await ClinicalAccessRequest.findOne({
      patient: patient._id,
      medicalStaff: req.user._id,
      status: 'pending',
    });
    if (pendingRequest) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending access request for this patient.',
      });
    }
    const activeGrant = await ClinicalAccessRequest.findOne({
      patient: patient._id,
      medicalStaff: req.user._id,
      status: 'approved',
      expiresAt: { $gt: new Date() },
    });
    if (activeGrant) {
      return res.status(409).json({
        success: false,
        message: 'You already have active access to this patient until the grant expires or is revoked.',
      });
    }

    const request = await ClinicalAccessRequest.create({
      patient: patient._id,
      medicalStaff: req.user._id,
      reason: reason.trim(),
      requestedUntil: expiration,
    });
    await request.populate([
      { path: 'patient', select: 'name email mediVaultId' },
      { path: 'medicalStaff', select: 'name email mediVaultId medicalStaffDetails' },
    ]);

    await createAuditLog({
      userId: patient._id,
      performedBy: req.user._id,
      action: 'ACCESS_REQUESTED',
      details: `Medical staff ${req.user.name} requested patient-specific clinical access until ${expiration.toISOString()}: ${reason.trim()}`,
      resourceId: request._id,
      resourceType: 'ClinicalAccessRequest',
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'Access request sent to the patient and their authorized representatives.',
      request,
    });
  } catch (error) {
    next(error);
  }
};

export const getClinicalAccessRequests = async (req, res, next) => {
  try {
    const now = new Date();
    let query;

    if (req.user.role === 'medical_staff') {
      query = { medicalStaff: req.user._id };
    } else if (req.user.role === 'patient') {
      const delegations = await ProxyDelegation.find({
        proxyUser: req.user._id,
        status: 'active',
        accessLevel: 'full',
      }).select('patient');
      query = {
        $or: [
          { patient: req.user._id },
          { patient: { $in: delegations.map((item) => item.patient) } },
        ],
      };
    } else if (req.user.role === 'admin') {
      query = { status: { $in: ['pending', 'approved'] } };
    } else {
      query = { _id: null };
    }

    const requests = await populateRequest(
      ClinicalAccessRequest.find(query).sort({ createdAt: -1 }).limit(200)
    );
    return res.status(200).json({
      success: true,
      requests: requests.map((item) => ({
        ...item.toObject(),
        isExpired:
          item.status === 'approved' &&
          (!item.expiresAt || item.expiresAt <= now),
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const decideClinicalAccessRequest = async (req, res, next) => {
  try {
    const { decision, expiresAt } = req.body;
    if (!['approved', 'denied'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be approved or denied.',
      });
    }

    const request = await ClinicalAccessRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Access request not found.' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: 'This access request has already been decided.',
      });
    }

    const isPatient = request.patient.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const delegation = !isPatient && !isAdmin && req.user.role === 'patient'
      ? await ProxyDelegation.findOne({
          patient: request.patient,
          proxyUser: req.user._id,
          status: 'active',
          accessLevel: 'full',
        })
      : null;
    if (!isPatient && !isAdmin && !delegation) {
      return res.status(403).json({
        success: false,
        message: 'Only the patient, their authorized full-access proxy, or an administrator can decide this request.',
      });
    }

    let expiry;
    if (decision === 'approved') {
      expiry = new Date(expiresAt);
      if (!expiresAt || Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Choose a valid future expiration date and time for the access grant.',
        });
      }
    }

    request.status = decision;
    request.decidedBy = req.user._id;
    request.decidedAt = new Date();
    if (decision === 'approved') request.expiresAt = expiry;
    await request.save();

    await createAuditLog({
      userId: request.patient,
      performedBy: req.user._id,
      action: 'ACCESS_REQUEST_DECIDED',
      details: `${req.user.name} ${decision} clinical access for ${request.medicalStaff} until ${decision === 'approved' ? expiry.toISOString() : 'not granted'}`,
      resourceId: request._id,
      resourceType: 'ClinicalAccessRequest',
      req,
    });

    await request.populate([
      { path: 'patient', select: 'name email' },
      { path: 'medicalStaff', select: 'name email medicalStaffDetails' },
      { path: 'decidedBy', select: 'name role' },
    ]);
    return res.status(200).json({
      success: true,
      message: decision === 'approved' ? 'Time-limited access approved.' : 'Access request denied.',
      request,
    });
  } catch (error) {
    next(error);
  }
};

export const revokeClinicalAccess = async (req, res, next) => {
  try {
    const request = await ClinicalAccessRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Access request not found.' });
    }
    if (request.status !== 'approved' || !request.expiresAt || request.expiresAt <= new Date()) {
      return res.status(409).json({
        success: false,
        message: 'Only an active access grant can be revoked.',
      });
    }

    const isPatient = request.patient.toString() === req.user._id.toString();
    const isStaff = request.medicalStaff.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const delegation = !isPatient && !isStaff && !isAdmin && req.user.role === 'patient'
      ? await ProxyDelegation.findOne({
          patient: request.patient,
          proxyUser: req.user._id,
          status: 'active',
          accessLevel: 'full',
        })
      : null;
    if (!isPatient && !isStaff && !isAdmin && !delegation) {
      return res.status(403).json({
        success: false,
        message: 'Only the patient, their authorized proxy, the requesting staff member, or an administrator can revoke access.',
      });
    }

    request.status = 'revoked';
    request.revokedAt = new Date();
    await request.save();
    await createAuditLog({
      userId: request.patient,
      performedBy: req.user._id,
      action: 'ACCESS_REVOKED',
      details: `${req.user.name} revoked time-limited clinical access for ${request.medicalStaff}`,
      resourceId: request._id,
      resourceType: 'ClinicalAccessRequest',
      req,
    });

    return res.status(200).json({ success: true, message: 'Clinical access revoked.' });
  } catch (error) {
    next(error);
  }
};
