import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/auth.js';
import User from '../models/User.js';
import ProxyDelegation from '../models/ProxyDelegation.js';
import ClinicalAccessRequest from '../models/ClinicalAccessRequest.js';
import Appointment from '../models/Appointment.js';
import PharmacyOrganization from '../models/PharmacyOrganization.js';
import LabOrganization from '../models/LabOrganization.js';

export const protectIdentity = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        getJwtSecret()
      );

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists. Authorization denied.',
        });
      }

      const limitedStaffApplication =
        ['medical_staff', 'insurance_agent', 'pharmacy_manager', 'lab_manager'].includes(user.role) &&
        user.approvalStatus === 'pending' &&
        user.credentialVerification?.status !== 'rejected';
      if (!user.isActive && !limitedStaffApplication) {
        return res.status(403).json({
          success: false,
          message: 'Account has been deactivated. Please contact MediVault administrator.',
        });
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error('[AuthMiddleware] Token error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token. Please log in again.',
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }
};

export const protect = async (req, res, next) => {
  return protectIdentity(req, res, async () => {
    try {
    const user = req.user;
    if (user.mustChangePassword) {
      return res.status(403).json({ success: false, code: 'PASSWORD_CHANGE_REQUIRED', message: 'Change your password before accessing this workspace.' });
    }
    if (user.approvalStatus === 'pending') {
      return res.status(403).json({ success: false, message: 'Your staff account is awaiting administrator approval.' });
    }

    if (
        ['medical_staff', 'insurance_agent', 'pharmacy_manager', 'lab_manager'].includes(user.role) &&
        (user.credentialVerification?.status !== 'verified' ||
          (user.credentialVerification.expiresAt && user.credentialVerification.expiresAt <= new Date()))
      ) {
        return res.status(403).json({
          success: false,
          message: user.credentialVerification?.expiresAt && user.credentialVerification.expiresAt <= new Date()
            ? 'Your credential document has expired. Contact the administrator to update your credential.'
            : user.credentialVerification?.status === 'rejected'
            ? 'Your credential document was not approved. Contact the administrator for next steps.'
            : 'Your credential document is awaiting administrator review.',
        });
      }
    if (['pharmacy_manager', 'pharmacy_chain_admin'].includes(user.role) || (user.role === 'medical_staff' && professionalTypeFor(user) === 'pharmacist')) {
      const organization = user.role === 'pharmacy_manager'
        ? await PharmacyOrganization.findOne({ manager: user._id, isActive: true })
        : user.role === 'pharmacy_chain_admin'
          ? await PharmacyOrganization.findOne({ _id: user.pharmacyChain, admins: user._id, isActive: true })
        : await PharmacyOrganization.findOne({ _id: user.pharmacyOrganization, isActive: true });
      if (!organization || organization.verification.status !== 'verified' ||
          organization.verification.expiresAt <= new Date()) {
        return res.status(403).json({
          success: false,
          message: 'Your pharmacy organization is not currently MediVault-verified. Contact its manager or MediVault support.',
        });
      }
      if (['pharmacy_manager', 'pharmacy_chain_admin'].includes(user.role)) req.pharmacyOrganization = organization;
    }
    if (user.role === 'medical_staff' && professionalTypeFor(user) === 'pharmacist' &&
        user.pharmacyMembershipStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: user.pharmacyMembershipStatus === 'rejected'
          ? 'Your pharmacy membership was declined. Contact the pharmacy organization manager.'
          : 'Your pharmacy membership is awaiting organization manager approval.',
      });
    }
    if (['lab_manager', 'lab_chain_admin'].includes(user.role) || (user.role === 'medical_staff' && professionalTypeFor(user) === 'lab_technologist')) {
      const organization = user.role === 'lab_manager'
        ? await LabOrganization.findOne({ manager: user._id, isActive: true })
        : user.role === 'lab_chain_admin'
          ? await LabOrganization.findOne({ _id: user.labChain, admins: user._id, isActive: true })
        : await LabOrganization.findOne({ _id: user.labOrganization, isActive: true });
      if (!organization || organization.verification.status !== 'verified' ||
          organization.verification.expiresAt <= new Date()) {
        return res.status(403).json({
          success: false,
          message: 'Your laboratory is not currently MediVault-verified. Contact its manager or MediVault support.',
        });
      }
      if (user.role === 'medical_staff' && user.labMembershipStatus !== 'approved') {
        return res.status(403).json({
          success: false,
          message: user.labMembershipStatus === 'rejected'
            ? 'Your laboratory membership was declined. Contact the laboratory manager.'
            : 'Your laboratory membership is awaiting organization manager approval.',
        });
      }
      if (['lab_manager', 'lab_chain_admin'].includes(user.role)) req.labOrganization = organization;
    }
    return next();
    } catch (error) {
      return next(error);
    }
  });
};

/**
 * Role-Based Access Control (RBAC) Guard
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role (${req.user?.role || 'unknown'}) is not permitted to access this resource. Required: [${roles.join(', ')}].`,
      });
    }
    next();
  };
};

export const professionalTypeFor = (user) => {
  const type = user?.medicalStaffDetails?.professionalType;
  if (['physician', 'nurse', 'pharmacist', 'lab_technologist'].includes(type)) return type;
  // Preserve legacy accounts created before professionalType was stored.
  return String(user?.medicalStaffDetails?.specialization || '').trim().toLowerCase() === 'nursing'
    ? 'nurse'
    : 'physician';
};

export const authorizeProfessionalTypes = (...types) => (req, res, next) => {
  if (req.user?.role !== 'medical_staff' || !types.includes(professionalTypeFor(req.user))) {
    return res.status(403).json({
      success: false,
      message: 'This action is not available for your verified professional type.',
    });
  }
  return next();
};

/**
 * Resolves active patient context for dual-context Caregiver/Proxy delegation
 */
export const resolvePatientContext = async (req, res, next) => {
  try {
    const requestedMediVaultId = String(
      req.headers['x-patient-context'] || req.query.patientId || ''
    ).trim().toUpperCase();

    if (req.user.role === 'medical_staff' && !['GET', 'HEAD'].includes(req.method)) {
      return res.status(403).json({
        success: false,
        message: 'Staff access grants are read-only for patient records and profiles.',
      });
    }

    // Direct personal access
    if (!requestedMediVaultId || requestedMediVaultId === req.user.mediVaultId) {
      req.effectivePatientId = req.user._id;
      req.isProxyActing = false;
      return next();
    }

    if (req.user.role === 'medical_staff' && professionalTypeFor(req.user) !== 'physician') {
      return res.status(403).json({
        success: false,
        message: 'Only physicians with an active clinical access grant can access general patient records.',
      });
    }

    const requestedPatient = await User.findOne({
      mediVaultId: String(requestedMediVaultId).trim().toUpperCase(),
      role: 'patient',
      isActive: true,
    }).select('_id');

    if (!requestedPatient) {
      return res.status(404).json({
        success: false,
        message: 'No active patient account was found for that MediVault ID.',
      });
    }

    const requestedPatientId = requestedPatient._id;

    // Medical staff may access an unexpired approved grant or an active appointment consultation window.
    if (req.user.role === 'medical_staff') {
      const grant = await ClinicalAccessRequest.findOne({
        patient: requestedPatientId,
        medicalStaff: req.user._id,
        status: 'approved',
        expiresAt: { $gt: new Date() },
      });
      if (grant) {
        req.effectivePatientId = requestedPatientId;
        req.isProxyActing = false;
        req.clinicalAccessGrant = grant;
        return next();
      }

      // Check appointment consultation window (30 mins before slot, 30 mins after slot ends)
      const now = new Date();
      const appointment = await Appointment.findOne({
        doctor: req.user._id,
        patient: requestedPatientId,
        status: 'confirmed',
        startsAt: { $lte: new Date(now.getTime() + 30 * 60_000) },
        endsAt: { $gte: new Date(now.getTime() - 30 * 60_000) },
      });

      if (!appointment) {
        return res.status(403).json({
          success: false,
          message: 'No active clinical access grant or confirmed appointment consultation window was found.',
        });
      }

      req.effectivePatientId = requestedPatientId;
      req.isProxyActing = false;
      req.clinicalAccessGrant = {
        _id: appointment._id,
        patient: requestedPatientId,
        medicalStaff: req.user._id,
        status: 'approved',
        isAppointmentAccess: true,
      };
      return next();
    }

    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrators must not access patient records directly. Approve a time-limited staff request or use an authorized patient proxy.',
      });
    }

    // Check proxy delegation
    const delegation = await ProxyDelegation.findOne({
      patient: requestedPatientId,
      proxyUser: req.user._id,
      status: 'active',
    }).populate('patient', 'name email mediVaultId');

    if (!delegation) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized proxy access. You do not have an active caregiver authorization for this patient.',
      });
    }

    // Read-only guard
    if (
      delegation.accessLevel === 'read_only' &&
      ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Your caregiver authorization is read-only for this patient account.',
      });
    }

    req.effectivePatientId = requestedPatientId;
    req.proxyDelegation = delegation;
    req.isProxyActing = true;
    return next();
  } catch (error) {
    return next(error);
  }
};
