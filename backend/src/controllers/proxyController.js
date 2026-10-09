import ProxyDelegation from '../models/ProxyDelegation.js';
import User from '../models/User.js';
import HealthProfile from '../models/HealthProfile.js';
import { createAuditLog } from '../services/auditService.js';

// @desc    Grant caregiver/proxy access to a user
// @route   POST /api/proxy/delegate
// @access  Private (Patient or Admin)
export const delegateAccess = async (req, res, next) => {
  try {
    const { proxyMediVaultId, relationship, accessLevel = 'full', notes } = req.body;

    if (typeof proxyMediVaultId !== 'string' || !/^MV-[A-F0-9]{16}$/i.test(proxyMediVaultId.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid MediVault ID for the caregiver is required.',
      });
    }

    const normalizedMediVaultId = proxyMediVaultId.trim().toUpperCase();
    if (normalizedMediVaultId === req.user.mediVaultId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delegate proxy access to yourself.',
      });
    }

    const proxyUser = await User.findOne({
      mediVaultId: normalizedMediVaultId,
      role: 'patient',
      isActive: true,
    });
    if (!proxyUser) {
      return res.status(404).json({
        success: false,
        message: 'No active MediVault account was found for that ID. The caregiver must create an account first.',
      });
    }

    // Check existing delegation
    let delegation = await ProxyDelegation.findOne({
      patient: req.user._id,
      proxyUser: proxyUser._id,
    });

    if (delegation) {
      if (delegation.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'An active proxy delegation already exists for this user.',
        });
      }
      // Re-activate previously revoked delegation
      delegation.status = 'active';
      delegation.relationship = relationship || delegation.relationship;
      delegation.accessLevel = accessLevel || delegation.accessLevel;
      delegation.notes = notes !== undefined ? notes : delegation.notes;
      delegation.grantedAt = new Date();
      delegation.revokedAt = null;
      await delegation.save();
    } else {
      delegation = await ProxyDelegation.create({
        patient: req.user._id,
        proxyUser: proxyUser._id,
        relationship: relationship || 'Caregiver',
        accessLevel: accessLevel || 'full',
        notes: notes || '',
        status: 'active',
        grantedAt: new Date(),
      });
    }

    // Audit log
    await createAuditLog({
      userId: req.user._id,
      action: 'PROXY_GRANTED',
      details: `Granted ${delegation.accessLevel} proxy access to caregiver: ${proxyUser.name} (${proxyUser.email}) as ${delegation.relationship}`,
      resourceId: delegation._id,
      resourceType: 'ProxyDelegation',
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Caregiver proxy access granted successfully to ${proxyUser.name}.`,
      delegation: {
        id: delegation._id,
        proxyUser: {
          id: proxyUser._id,
          mediVaultId: proxyUser.mediVaultId,
          name: proxyUser.name,
        },
        relationship: delegation.relationship,
        accessLevel: delegation.accessLevel,
        status: delegation.status,
        grantedAt: delegation.grantedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all proxies authorized for the current patient
// @route   GET /api/proxy/my-proxies
// @access  Private
export const getMyProxies = async (req, res, next) => {
  try {
    const proxies = await ProxyDelegation.find({
      patient: req.user._id,
      status: 'active',
    })
      .populate('proxyUser', 'name email mediVaultId phone role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: proxies.length,
      proxies,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all dependents/patients the current user is authorized to manage
// @route   GET /api/proxy/my-dependents
// @access  Private
export const getMyDependents = async (req, res, next) => {
  try {
    const delegations = await ProxyDelegation.find({
      proxyUser: req.user._id,
      status: 'active',
    })
      .populate('patient', 'name email mediVaultId phone')
      .sort({ createdAt: -1 });

    // Fetch brief health profile for each dependent
    const dependents = await Promise.all(
      delegations.map(async (del) => {
        const profile = await HealthProfile.findOne({ user: del.patient._id }).select(
          'bloodGroup dateOfBirth gender allergies'
        );
        return {
          delegationId: del._id,
          patient: del.patient,
          relationship: del.relationship,
          accessLevel: del.accessLevel,
          grantedAt: del.grantedAt,
          profile: profile || null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: dependents.length,
      dependents,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Revoke proxy access
// @route   DELETE /api/proxy/:id
// @access  Private
export const revokeProxy = async (req, res, next) => {
  try {
    const delegation = await ProxyDelegation.findById(req.params.id)
      .populate('proxyUser', 'name mediVaultId')
      .populate('patient', 'name mediVaultId');

    if (!delegation) {
      return res.status(404).json({
        success: false,
        message: 'Proxy delegation record not found.',
      });
    }

    // Must be patient or proxy or admin to revoke
    const isPatient = delegation.patient._id.toString() === req.user._id.toString();
    const isProxy = delegation.proxyUser._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isProxy && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. You do not have permission to revoke this delegation.',
      });
    }

    delegation.status = 'revoked';
    delegation.revokedAt = new Date();
    await delegation.save();

    // Audit log
    await createAuditLog({
      userId: delegation.patient._id,
      performedBy: req.user._id,
      action: 'PROXY_REVOKED',
      details: `Revoked proxy delegation for caregiver ${delegation.proxyUser.name}`,
      resourceId: delegation._id,
      resourceType: 'ProxyDelegation',
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Caregiver proxy access revoked successfully.',
    });
  } catch (error) {
    next(error);
  }
};
