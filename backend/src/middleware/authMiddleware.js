import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ProxyDelegation from '../models/ProxyDelegation.js';
import ClinicalAccessRequest from '../models/ClinicalAccessRequest.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'medivault_super_secret_jwt_key_2026_dev_env'
      );

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists. Authorization denied.',
        });
      }

      if (user.approvalStatus === 'pending') {
        return res.status(403).json({
          success: false,
          message: 'Your staff account is awaiting administrator approval.',
        });
      }

      if (!user.isActive) {
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

/**
 * Resolves active patient context for dual-context Caregiver/Proxy delegation
 */
export const resolvePatientContext = async (req, res, next) => {
  try {
    const requestedPatientId = req.headers['x-patient-context'] || req.query.patientId;

    if (req.user.role === 'medical_staff' && !['GET', 'HEAD'].includes(req.method)) {
      return res.status(403).json({
        success: false,
        message: 'Staff access grants are read-only for patient records and profiles.',
      });
    }

    // Direct personal access
    if (!requestedPatientId || requestedPatientId === req.user._id.toString()) {
      req.effectivePatientId = req.user._id;
      req.isProxyActing = false;
      return next();
    }

    // Medical staff may access only a patient-specific, unexpired approved grant.
    if (req.user.role === 'medical_staff') {
      const grant = await ClinicalAccessRequest.findOne({
        patient: requestedPatientId,
        medicalStaff: req.user._id,
        status: 'approved',
        expiresAt: { $gt: new Date() },
      });
      if (!grant) {
        return res.status(403).json({
          success: false,
          message: 'No active patient-approved clinical access grant was found.',
        });
      }
      req.effectivePatientId = requestedPatientId;
      req.isProxyActing = false;
      req.clinicalAccessGrant = grant;
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
    }).populate('patient', 'name email');

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
