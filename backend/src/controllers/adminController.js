import mongoose from 'mongoose';
import User from '../models/User.js';
import MedicalRecord from '../models/MedicalRecord.js';
import InsuranceClaim from '../models/InsuranceClaim.js';
import AuditLog from '../models/AuditLog.js';
import ProxyDelegation from '../models/ProxyDelegation.js';
import { createAuditLog } from '../services/auditService.js';
import { generateCompanyAgentId } from '../services/agentIdService.js';
import { readFile, sendFile } from '../services/fileStorageService.js';
import { escapeRegex } from '../utils/regexSearch.js';

const isValidUserId = (id) => mongoose.Types.ObjectId.isValid(id);

// Insurance agents linked to an insurance company are managed by that company's admins.
// Legacy agents without a company stay under platform-admin management so they are never orphaned.
const isCompanyManagedAgent = (user) => user?.role === 'insurance_agent' && Boolean(user.insuranceCompany);

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
      const sanitized = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: sanitized, $options: 'i' } },
        { email: { $regex: sanitized, $options: 'i' } },
      ];
    }

    // Hospital-assigned physician and nurse applications belong to their hospital admin.
    query.$nor = [
      { role: 'insurer_admin', insuranceCompany: { $ne: null } },
      { role: 'insurance_agent', insuranceCompany: { $ne: null } },
      {
        role: 'medical_staff',
        'medicalStaffDetails.professionalType': { $in: ['physician', 'nurse'] },
        'medicalStaffDetails.hospital': { $ne: null },
      },
    ];

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    return res.status(200).json({
      success: true,
      count: users.length,
      users: users.map((user) => {
        const data = user.toObject();
        if (data.credentialVerification) delete data.credentialVerification.documentStorageFileId;
        return { ...data, id: user._id.toString() };
      }),
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
    const validRoles = ['patient', 'medical_staff', 'hospital_admin', 'admin'];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${validRoles.join(', ')}`,
      });
    }

    if (!isValidUserId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'A valid user ID is required.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (user.role === 'insurer_admin' || isCompanyManagedAgent(user)) {
      return res.status(403).json({ success: false, message: 'Insurer users are managed by an administrator of their company.' });
    }

    if (
      role === 'insurance_agent' &&
      (!insuranceDetails || typeof insuranceDetails.companyName !== 'string' ||
        !insuranceDetails.companyName.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Select an insurance company before assigning the insurance agent role.',
      });
    }

    const oldRole = user.role;
    const oldInsuranceCompany = user.insuranceDetails?.companyName || '';
    if (['medical_staff', 'insurance_agent', 'pharmacy_manager'].includes(role) && oldRole !== role) {
      return res.status(400).json({ success: false, message: 'Changing a user into a staff role requires a new application with credentials through the appropriate staff registration portal.' });
    }
    user.role = role;
    if (oldRole !== role || (role === 'patient' && user.approvalStatus === 'pending')) {
      user.approvalStatus = 'approved';
      user.isActive = true;
    }

    if (medicalStaffDetails && typeof medicalStaffDetails === 'object') {
      const credentialChanged = role === 'medical_staff' &&
        user.medicalStaffDetails?.licenseNumber !== (medicalStaffDetails.licenseNumber || '');
      user.medicalStaffDetails = {
        ...(user.medicalStaffDetails?.toObject?.() || {}),
        licenseNumber: medicalStaffDetails.licenseNumber || '',
        specialization: medicalStaffDetails.specialization || '',
      };
      if (credentialChanged) {
        user.credentialVerification.status = 'needs_changes';
        user.credentialVerification.reviewedAt = null;
        user.credentialVerification.reviewedBy = null;
        user.credentialVerification.reviewNote = 'License number changed. Submit the updated credential document for review.';
      }
    }

    if (insuranceDetails && typeof insuranceDetails === 'object') {
      const companyName = String(insuranceDetails.companyName || '').trim();
      const licenseNumber = insuranceDetails.licenseNumber === undefined
        ? user.insuranceDetails?.licenseNumber || ''
        : String(insuranceDetails.licenseNumber).trim();
      const credentialChanged = role === 'insurance_agent' &&
        (user.insuranceDetails?.licenseNumber !== licenseNumber ||
          user.insuranceDetails?.companyName?.trim().toLowerCase() !== companyName.toLowerCase());
      const companyChanged =
        user.insuranceDetails?.companyName?.trim().toLowerCase() !== companyName.toLowerCase();
      const agentId =
        role === 'insurance_agent'
          ? companyChanged || !user.insuranceDetails?.agentId
            ? generateCompanyAgentId(companyName)
            : user.insuranceDetails.agentId
          : '';
      user.insuranceDetails = {
        companyName,
        agentId,
        licenseNumber,
      };
      if (credentialChanged) {
        user.credentialVerification.status = 'needs_changes';
        user.credentialVerification.reviewedAt = null;
        user.credentialVerification.reviewedBy = null;
        user.credentialVerification.reviewNote = 'License or company details changed. Submit the updated credential document for review.';
      }
    }

    await user.save();

    // Audit log
    const insurerChanged = oldRole === 'insurance_agent' && role === 'insurance_agent' &&
      oldInsuranceCompany.trim().toLowerCase() !==
        (user.insuranceDetails?.companyName || '').trim().toLowerCase();
    await createAuditLog({
      userId: user._id,
      performedBy: req.user._id,
      action: 'ADMIN_USER_UPDATED',
      details: `Admin (${req.user.name}) updated role of user ${user.name} from [${oldRole}] to [${role}]${insurerChanged ? `; insurer changed from [${oldInsuranceCompany || 'unassigned'}] to [${user.insuranceDetails.companyName}]` : ''}`,
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

    if (!isValidUserId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'A valid user ID is required.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (user.role === 'insurer_admin' || isCompanyManagedAgent(user)) {
      return res.status(403).json({ success: false, message: 'Insurer users are managed by an administrator of their company.' });
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

// @desc    Approve a pending staff account
// @route   PUT /api/admin/users/:id/approve
// @access  Private (Admin)
export const approveUser = async (req, res, next) => {
  try {
    if (!isValidUserId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'A valid user ID is required.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (user.role === 'patient' || user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Only staff accounts can be approved through this action.',
      });
    }
    if (user.role === 'medical_staff' && ['physician', 'nurse'].includes(user.medicalStaffDetails?.professionalType) && user.medicalStaffDetails?.hospital) {
      return res.status(403).json({ success: false, message: 'Hospital staff applications must be approved by an administrator of their hospital.' });
    }
    if (isCompanyManagedAgent(user)) return res.status(403).json({ success: false, message: 'Insurance agents must be approved by an administrator of their company.' });
    if (user.role === 'pharmacy_manager' || user.role === 'lab_manager') {
      return res.status(409).json({
        success: false,
        message: 'Organization manager accounts are activated only after their organization is verified.',
      });
    }

    if (user.approvalStatus !== 'pending') {
      return res.status(409).json({
        success: false,
        message: 'This staff account does not have a pending approval request.',
      });
    }

    if (user.credentialVerification?.status !== 'verified' ||
      (user.credentialVerification.expiresAt && user.credentialVerification.expiresAt <= new Date())) {
      return res.status(409).json({
        success: false,
        message: 'Verify a current, unexpired staff credential document before approving the account.',
      });
    }
    if (user.role === 'medical_staff' && user.medicalStaffDetails?.professionalType === 'pharmacist' &&
        user.pharmacyMembershipStatus !== 'approved') {
      return res.status(409).json({
        success: false,
        message: 'The pharmacy organization manager must approve pharmacist membership before the account can be activated.',
      });
    }
    if (user.role === 'medical_staff' && user.medicalStaffDetails?.professionalType === 'lab_technologist' &&
        user.labMembershipStatus !== 'approved') {
      return res.status(409).json({
        success: false,
        message: 'The laboratory manager must approve laboratory staff membership before the account can be activated.',
      });
    }

    user.approvalStatus = 'approved';
    user.isActive = true;
    await user.save();

    await createAuditLog({
      userId: user._id,
      performedBy: req.user._id,
      action: 'ADMIN_USER_UPDATED',
      details: `Admin (${req.user.name}) approved staff account for ${user.name} as [${user.role}]`,
      resourceId: user._id,
      resourceType: 'User',
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Staff account approved successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        approvalStatus: user.approvalStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const reviewUserCredential = async (req, res, next) => {
  try {
    if (!isValidUserId(req.params.id)) return res.status(400).json({ success: false, message: 'A valid user ID is required.' });
    const { decision, reviewNote = '' } = req.body;
    if (!['verified', 'needs_changes', 'rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'Decision must be verified, needs_changes, or rejected.' });
    if (decision !== 'verified' && !String(reviewNote).trim()) return res.status(400).json({ success: false, message: 'Add a note when sending back or rejecting credential documents.' });
    const user = await User.findById(req.params.id);
    if (!user || !['medical_staff', 'insurance_agent'].includes(user.role)) return res.status(404).json({ success: false, message: 'Staff account not found.' });
    if (user.role === 'medical_staff' && ['physician', 'nurse'].includes(user.medicalStaffDetails?.professionalType) && user.medicalStaffDetails?.hospital) {
      return res.status(403).json({ success: false, message: 'Hospital staff credentials must be reviewed by an administrator of their hospital.' });
    }
    if (isCompanyManagedAgent(user)) return res.status(403).json({ success: false, message: 'Insurance agent credentials must be reviewed by an administrator of their company.' });
    if (!user.credentialVerification?.documentStorageFileId) return res.status(404).json({ success: false, message: 'No credential document is available for review.' });
    if (decision === 'verified' && user.credentialVerification.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'The applicant must resubmit the requested changes before these credentials can be verified.' });
    }
    if (decision === 'verified' && (!user.credentialVerification.expiresAt || user.credentialVerification.expiresAt <= new Date())) {
      return res.status(400).json({ success: false, message: 'This credential is expired. It cannot be verified.' });
    }
    user.credentialVerification.status = decision;
    user.credentialVerification.reviewNote = String(reviewNote).trim().slice(0, 1000);
    user.credentialVerification.reviewedAt = new Date();
    user.credentialVerification.reviewedBy = req.user._id;
    await user.save();
    await createAuditLog({
      userId: user._id,
      performedBy: req.user._id,
      action: 'ADMIN_USER_UPDATED',
      details: `Admin (${req.user.name}) marked ${user.role} credentials ${decision}${reviewNote ? `: ${String(reviewNote).trim().slice(0, 300)}` : ''}`,
      resourceId: user._id,
      resourceType: 'User',
      req,
    });
    return res.status(200).json({
      success: true,
      message: `Credentials marked ${decision}.`,
      user: {
        id: user._id,
        credentialVerification: {
          status: user.credentialVerification.status,
          expiresAt: user.credentialVerification.expiresAt,
          submittedAt: user.credentialVerification.submittedAt,
          reviewedAt: user.credentialVerification.reviewedAt,
          reviewNote: user.credentialVerification.reviewNote,
        },
      },
    });
  } catch (error) { next(error); }
};

export const downloadUserCredential = async (req, res, next) => {
  try {
    if (!isValidUserId(req.params.id)) return res.status(400).json({ success: false, message: 'A valid user ID is required.' });
    const user = await User.findById(req.params.id).select('role name insuranceCompany medicalStaffDetails.professionalType medicalStaffDetails.hospital credentialVerification');
    if (!user || !['medical_staff', 'insurance_agent'].includes(user.role) || !user.credentialVerification?.documentStorageFileId) {
      return res.status(404).json({ success: false, message: 'Credential document not found.' });
    }
    if (user.role === 'medical_staff' && ['physician', 'nurse'].includes(user.medicalStaffDetails?.professionalType) && user.medicalStaffDetails?.hospital) {
      return res.status(403).json({ success: false, message: 'Hospital staff credentials are available only to their hospital administrator.' });
    }
    if (isCompanyManagedAgent(user)) return res.status(403).json({ success: false, message: 'Insurance agent credentials are available only to an administrator of their company.' });
    const file = {
      storageFileId: user.credentialVerification.documentStorageFileId,
      fileName: user.credentialVerification.documentFileName || 'credential-document',
      fileType: user.credentialVerification.documentFileType || 'application/octet-stream',
    };
    const buffer = await readFile(file);
    await createAuditLog({ userId: user._id, performedBy: req.user._id, action: 'ADMIN_USER_UPDATED', details: `Admin (${req.user.name}) viewed staff credential document for ${user.name}`, resourceId: user._id, resourceType: 'User', req });
    return sendFile(res, file, buffer);
  } catch (error) { next(error); }
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
      .populate('user', 'name email mediVaultId role')
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
