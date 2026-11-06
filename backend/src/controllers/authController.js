import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/auth.js';
import User from '../models/User.js';
import HealthProfile from '../models/HealthProfile.js';
import { createAuditLog } from '../services/auditService.js';
import { generateCompanyAgentId } from '../services/agentIdService.js';
import { saveFile, deleteFile } from '../services/fileStorageService.js';

// Helper to sign JWT
const generateToken = (id) => {
  return jwt.sign(
    { id },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

// Helper to format user response
const formatUserResponse = (user) => {
  return {
    id: user._id,
    mediVaultId: user.mediVaultId,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    approvalStatus: user.approvalStatus,
    phone: user.phone || '',
    medicalStaffDetails: user.medicalStaffDetails || {},
    insuranceDetails: user.insuranceDetails || {},
    credentialVerification: {
      status: user.credentialVerification?.status || 'verified',
      expiresAt: user.credentialVerification?.expiresAt || null,
      reviewNote: user.credentialVerification?.reviewNote || '',
    },
    createdAt: user.createdAt,
  };
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
  let credentialStorageFileId;
  let userCreated = false;
  try {
    const {
      name,
      email,
      password,
      role = 'patient',
      phone,
      medicalStaffDetails,
      insuranceDetails,
      credentialExpiresAt,
    } = req.body;

    const parsedMedicalDetails = typeof medicalStaffDetails === 'string' ? JSON.parse(medicalStaffDetails) : medicalStaffDetails;
    const parsedInsuranceDetails = typeof insuranceDetails === 'string' ? JSON.parse(insuranceDetails) : insuranceDetails;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const validRoles = ['patient', 'medical_staff', 'insurance_agent'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Public registration is limited to: ${validRoles.join(', ')}. Administrator accounts must be provisioned by an existing system operator.`,
      });
    }

    if (
      role === 'insurance_agent' &&
      (!parsedInsuranceDetails || typeof parsedInsuranceDetails.companyName !== 'string' ||
        !parsedInsuranceDetails.companyName.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please select an insurance company for the agent account.',
      });
    }

    if (role !== 'patient') {
      const licenseNumber = role === 'medical_staff'
        ? parsedMedicalDetails?.licenseNumber
        : parsedInsuranceDetails?.licenseNumber;
      const expiresAt = new Date(credentialExpiresAt);
      if (!req.file || !String(licenseNumber || '').trim() || !credentialExpiresAt || Number.isNaN(expiresAt.getTime())) {
        return res.status(400).json({ success: false, message: 'Staff applications require a license number, expiry date, and credential document.' });
      }
      if (expiresAt <= new Date()) {
        return res.status(400).json({ success: false, message: 'The credential expiry date must be in the future.' });
      }
    }

    const normalizedPhone = String(phone || '').replace(/[\s()-]/g, '');
    const phoneMatch = normalizedPhone.match(/^\+?91([6-9]\d{9})$/);
    if (!phoneMatch) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit Indian mobile number with the +91 country code.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: role || 'patient',
      approvalStatus: role === 'patient' ? 'approved' : 'pending',
      isActive: role === 'patient',
      phone: `+91${phoneMatch[1]}`,
    };

    if (parsedMedicalDetails && typeof parsedMedicalDetails === 'object') {
      userData.medicalStaffDetails = {
        licenseNumber: parsedMedicalDetails.licenseNumber || '',
        specialization: parsedMedicalDetails.specialization || '',
        hospitalAffiliation: parsedMedicalDetails.hospitalAffiliation || '',
      };
    }

    if (parsedInsuranceDetails && typeof parsedInsuranceDetails === 'object') {
      userData.insuranceDetails = {
        companyName: String(parsedInsuranceDetails.companyName || '').trim(),
        agentId:
          role === 'insurance_agent'
            ? generateCompanyAgentId(parsedInsuranceDetails.companyName)
            : '',
        licenseNumber: parsedInsuranceDetails.licenseNumber || '',
      };
    }

    if (role !== 'patient') {
      credentialStorageFileId = await saveFile(req.file.buffer, `credential-${Date.now()}`);
      userData.credentialVerification = {
        status: 'pending',
        expiresAt: new Date(credentialExpiresAt),
        documentStorageFileId: credentialStorageFileId,
        documentFileName: req.file.originalname,
        documentFileType: req.file.mimetype,
        documentFileSize: req.file.size,
        submittedAt: new Date(),
      };
    }

    const user = await User.create(userData);
    userCreated = true;

    // Initialize Health Profile for patients (or default profile)
    await HealthProfile.create({
      user: user._id,
      fullName: user.name,
      bloodGroup: 'Unknown',
      allergies: [],
      medicalConditions: [],
      medications: [],
      emergencyContact: { name: '', relationship: '', phone: '' },
    });

    // Audit log
    await createAuditLog({
      userId: user._id,
      action: 'LOGIN',
      details: `User account created with role [${user.role}] and initial session started`,
      resourceId: user._id,
      resourceType: 'User',
      req,
    });

    if (user.approvalStatus === 'pending') {
      return res.status(202).json({
        success: true,
        pendingApproval: true,
        message: 'Your staff account is awaiting administrator approval.',
        user: formatUserResponse(user),
      });
    }

    const token = generateToken(user._id);
    return res.status(201).json({
      success: true,
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    if (credentialStorageFileId && !userCreated) {
      await deleteFile({ storageFileId: credentialStorageFileId }).catch(() => {});
    }
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const portalRoles = {
      patient: 'patient',
      clinical: 'medical_staff',
      insurance: 'insurance_agent',
      admin: 'admin',
    };
    const portal = req.params.portal || 'patient';
    const requiredRole = portalRoles[portal];

    if (!requiredRole) {
      return res.status(404).json({
        success: false,
        message: 'Unable to sign in. Check your details and try again.',
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Enter your email address and password.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email or password is incorrect.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch || user.role !== requiredRole) {
      return res.status(401).json({
        success: false,
        message: 'Email or password is incorrect.',
      });
    }

    const isStaff = ['medical_staff', 'insurance_agent'].includes(user.role);
    const credentialExpired = Boolean(isStaff && user.credentialVerification?.expiresAt && user.credentialVerification.expiresAt <= new Date());
    const applicationPending = isStaff && user.approvalStatus === 'pending' && user.credentialVerification?.status !== 'rejected';
    const limitedApplication = applicationPending || (isStaff && user.isActive && (user.credentialVerification?.status === 'needs_changes' || credentialExpired));

    if (isStaff && user.credentialVerification?.status === 'rejected') {
      return res.status(403).json({ success: false, message: 'Your credential application was rejected. Contact the administrator if you believe this was an error.' });
    }

    if (isStaff && !limitedApplication && user.credentialVerification?.status !== 'verified') {
      return res.status(403).json({
        success: false,
        message: user.credentialVerification?.status === 'rejected'
          ? 'Your credential document was not approved. Contact the administrator for next steps.'
          : 'Your credential document is awaiting administrator review.',
      });
    }

    if (!user.isActive && !applicationPending) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    const token = generateToken(user._id);

    // Audit log
    await createAuditLog({
      userId: user._id,
      action: 'LOGIN',
      details: `User logged in successfully as [${user.role}]`,
      resourceId: user._id,
      resourceType: 'User',
      req,
    });

    return res.status(200).json({
      success: true,
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user profile summary
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

export const resubmitUserCredential = async (req, res, next) => {
  let replacementFileId;
  try {
    const user = req.user;
    if (!['medical_staff', 'insurance_agent'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Credential resubmission is only available to staff applicants.' });
    }
    const expiredRenewal = user.credentialVerification?.status === 'verified' &&
      user.credentialVerification.expiresAt && user.credentialVerification.expiresAt <= new Date();
    if (user.credentialVerification?.status !== 'needs_changes' && !expiredRenewal) {
      return res.status(409).json({ success: false, message: 'Your application is not currently open for credential changes.' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Upload a replacement credential document.' });
    const licenseNumber = String(req.body.licenseNumber || '').trim();
    const expiresAt = new Date(req.body.credentialExpiresAt);
    if (!licenseNumber || !req.body.credentialExpiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'Enter a license number and a future expiry date.' });
    }

    replacementFileId = await saveFile(req.file.buffer, `credential-${Date.now()}`);
    const oldFileId = user.credentialVerification.documentStorageFileId;
    if (user.role === 'medical_staff') user.medicalStaffDetails.licenseNumber = licenseNumber;
    else user.insuranceDetails.licenseNumber = licenseNumber;
    user.credentialVerification.status = 'pending';
    user.credentialVerification.expiresAt = expiresAt;
    user.credentialVerification.documentStorageFileId = replacementFileId;
    user.credentialVerification.documentFileName = req.file.originalname;
    user.credentialVerification.documentFileType = req.file.mimetype;
    user.credentialVerification.documentFileSize = req.file.size;
    user.credentialVerification.submittedAt = new Date();
    user.credentialVerification.reviewedAt = null;
    user.credentialVerification.reviewedBy = null;
    user.credentialVerification.reviewNote = '';
    await user.save();
    replacementFileId = null;
    if (oldFileId) await deleteFile({ storageFileId: oldFileId }).catch((error) => console.error('[Credential cleanup]', error.message));
    await createAuditLog({
      userId: user._id,
      action: 'ADMIN_USER_UPDATED',
      details: `Staff applicant ${user.name} resubmitted credential documents for review`,
      resourceId: user._id,
      resourceType: 'User',
      req,
    });
    return res.status(200).json({ success: true, message: 'Credential document resubmitted for review.', user: formatUserResponse(user) });
  } catch (error) {
    if (replacementFileId) await deleteFile({ storageFileId: replacementFileId }).catch(() => {});
    next(error);
  }
};
