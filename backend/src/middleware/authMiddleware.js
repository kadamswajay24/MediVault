import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ProxyDelegation from '../models/ProxyDelegation.js';

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

    // Direct personal access
    if (!requestedPatientId || requestedPatientId === req.user._id.toString()) {
      req.effectivePatientId = req.user._id;
      req.isProxyActing = false;
      return next();
    }

    // Admin override
    if (req.user.role === 'admin') {
      req.effectivePatientId = requestedPatientId;
      req.isProxyActing = true;
      return next();
    }

    // Medical staff consultation access
    if (req.user.role === 'medical_staff') {
      req.effectivePatientId = requestedPatientId;
      req.isProxyActing = false;
      return next();
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
