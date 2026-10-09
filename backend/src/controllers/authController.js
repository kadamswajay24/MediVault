import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import HealthProfile from '../models/HealthProfile.js';
import { createAuditLog } from '../services/auditService.js';

// Helper to sign JWT
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'medivault_super_secret_jwt_key_2026_dev_env',
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
    createdAt: user.createdAt,
  };
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role = 'patient',
      phone,
      medicalStaffDetails,
      insuranceDetails,
    } = req.body;

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

    if (medicalStaffDetails && typeof medicalStaffDetails === 'object') {
      userData.medicalStaffDetails = {
        licenseNumber: medicalStaffDetails.licenseNumber || '',
        specialization: medicalStaffDetails.specialization || '',
        hospitalAffiliation: medicalStaffDetails.hospitalAffiliation || '',
      };
    }

    if (insuranceDetails && typeof insuranceDetails === 'object') {
      userData.insuranceDetails = {
        companyName: insuranceDetails.companyName || '',
        agentId: insuranceDetails.agentId || '',
        licenseNumber: insuranceDetails.licenseNumber || '',
      };
    }

    const user = await User.create(userData);

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
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials.',
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
