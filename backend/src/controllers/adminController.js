import User from '../models/User.js';
import MedicalRecord from '../models/MedicalRecord.js';
import InsuranceClaim from '../models/InsuranceClaim.js';
import AuditLog from '../models/AuditLog.js';
import ProxyDelegation from '../models/ProxyDelegation.js';
import { createAuditLog } from '../services/auditService.js';

// @desc    Get all users across all roles (Admin only)
// @route   GET /api/admin/users
// @access  Private (Admin)
export const getUsers = async (req, res, next) => {
  try {
    const { role, status, search, limit = 100 } = req.query;
    let query = {};

    if (role && role !== 'All') {
      query.role = role;
    }

    if (status !== undefined && status !== 'All') {
      query.isActive = status === 'active';
    }

    if (search && search.trim()) {
      const sanitized = search.trim();
      query.$or = [
        { name: { $regex: sanitized, $options: 'i' } },
        { email: { $regex: sanitized, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a user's role
// @route   PUT /api/admin/users/:id/role
// @access  Private (Admin)
export const updateUserRole = async (req, res, next) => {
  try {
    const { role, medicalStaffDetails, insuranceDetails } = req.body;
    const validRoles = ['patient', 'medical_staff', 'insurance_agent', 'admin'];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${validRoles.join(', ')}`,
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const oldRole = user.role;
    user.role = role;

    if (medicalStaffDetails && typeof medicalStaffDetails === 'object') {
      user.medicalStaffDetails = {
        licenseNumber: medicalStaffDetails.licenseNumber || '',
        specialization: medicalStaffDetails.specialization || '',
        hospitalAffiliation: medicalStaffDetails.hospitalAffiliation || '',
      };
    }

    if (insuranceDetails && typeof insuranceDetails === 'object') {
      user.insuranceDetails = {
        companyName: insuranceDetails.companyName || '',
        agentId: insuranceDetails.agentId || '',
        licenseNumber: insuranceDetails.licenseNumber || '',
      };
    }

    await user.save();

    // Audit log
    await createAuditLog({
      userId: user._id,
      performedBy: req.user._id,
      action: 'ADMIN_USER_UPDATED',
      details: `Admin (${req.user.name}) updated role of user ${user.name} from [${oldRole}] to [${role}]`,
      resourceId: user._id,
      resourceType: 'User',
      req,
    });

    return res.status(200).json({
      success: true,
      message: `User role updated successfully to ${role}.`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Activate or deactivate user account
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
export const toggleUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive boolean flag is required.',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    // Prevent deactivating own account
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own administrative account.',
      });
    }

    user.isActive = isActive;
    await user.save();

    // Audit log
    await createAuditLog({
      userId: user._id,
      performedBy: req.user._id,
      action: 'ADMIN_USER_UPDATED',
      details: `Admin (${req.user.name}) set active status of user ${user.name} to [${isActive}]`,
      resourceId: user._id,
      resourceType: 'User',
      req,
    });

    return res.status(200).json({
      success: true,
      message: `User account has been ${isActive ? 'activated' : 'deactivated'}.`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get system-wide platform statistics
// @route   GET /api/admin/stats
// @access  Private (Admin)
export const getPlatformStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      roleCounts,
      totalRecords,
      totalClaims,
      claimsByStatus,
      activeDelegations,
      totalAuditLogs,
    ] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      MedicalRecord.countDocuments(),
      InsuranceClaim.countDocuments(),
      InsuranceClaim.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ProxyDelegation.countDocuments({ status: 'active' }),
      AuditLog.countDocuments(),
    ]);

    const usersByRole = {
      patient: 0,
      medical_staff: 0,
      insurance_agent: 0,
      admin: 0,
    };
    roleCounts.forEach((r) => {
      if (r._id && usersByRole[r._id] !== undefined) {
        usersByRole[r._id] = r.count;
      }
    });

    const claimsStatusMap = {
      Submitted: 0,
      'Under Review': 0,
      Approved: 0,
      Rejected: 0,
      'More Information Needed': 0,
    };
    claimsByStatus.forEach((c) => {
      if (c._id && claimsStatusMap[c._id] !== undefined) {
        claimsStatusMap[c._id] = c.count;
      }
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        usersByRole,
        totalRecords,
        totalClaims,
        claimsStatusMap,
        activeDelegations,
        totalAuditLogs,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get global system audit logs
// @route   GET /api/admin/audit-logs
// @access  Private (Admin)
export const getGlobalAuditLogs = async (req, res, next) => {
  try {
    const { action, userId, limit = 100 } = req.query;
    let query = {};

    if (action && action !== 'ALL') {
      query.action = action;
    }

    if (userId) {
      query.user = userId;
    }

    const logs = await AuditLog.find(query)
      .populate('user', 'name email role')
      .populate('performedBy', 'name email role')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10));

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    next(error);
  }
};
