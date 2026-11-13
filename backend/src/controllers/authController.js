import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getJwtSecret } from '../config/auth.js';
import User from '../models/User.js';
import HealthProfile from '../models/HealthProfile.js';
import { createAuditLog } from '../services/auditService.js';
import { generateCompanyAgentId } from '../services/agentIdService.js';
import { saveFile, deleteFile } from '../services/fileStorageService.js';
import { parseJsonField } from '../utils/parseJsonField.js';
import PharmacyOrganization from '../models/PharmacyOrganization.js';
import Hospital from '../models/Hospital.js';
import LabOrganization from '../models/LabOrganization.js';
import InsuranceCompany from '../models/InsuranceCompany.js';
import { parseExpiryDate } from '../utils/dateValidation.js';

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
    mustChangePassword: Boolean(user.mustChangePassword),
    approvalStatus: user.approvalStatus,
    phone: user.phone || '',
    medicalStaffDetails: user.medicalStaffDetails || {},
    pharmacyOrganization: user.pharmacyOrganization || null,
    pharmacyMembershipStatus: user.pharmacyMembershipStatus || 'not_applicable',
    labOrganization: user.labOrganization || null,
    labMembershipStatus: user.labMembershipStatus || 'not_applicable',
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
  let createdOrganizationId;
  let createdOrganizationModel = PharmacyOrganization;
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
      pharmacyOrganizationDetails,
      labOrganizationDetails,
      patientAddress,
      credentialExpiresAt,
    } = req.body;

    const parsedMedicalDetails = parseJsonField(medicalStaffDetails, 'medicalStaffDetails');
    const parsedInsuranceDetails = parseJsonField(insuranceDetails, 'insuranceDetails');
    const parsedPharmacyDetails = parseJsonField(pharmacyOrganizationDetails, 'pharmacyOrganizationDetails');
    const parsedLabDetails = parseJsonField(labOrganizationDetails, 'labOrganizationDetails');
    const parsedPatientAddress = parseJsonField(patientAddress, 'patientAddress');

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

    const validRoles = ['patient', 'medical_staff', 'insurance_agent', 'pharmacy_manager', 'lab_manager'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Public registration is limited to: ${validRoles.join(', ')}. Administrator accounts must be provisioned by an existing system operator.`,
      });
    }

    if (role === 'patient' && parsedPatientAddress && typeof parsedPatientAddress === 'object') {
      const limits = { address: 300, city: 100, district: 100, state: 100, postalCode: 6, postOffice: 150 };
      if (Object.entries(limits).some(([field, maxLength]) => typeof (parsedPatientAddress[field] || '') !== 'string' || String(parsedPatientAddress[field] || '').length > maxLength) ||
          (parsedPatientAddress.postalCode && !/^[1-9][0-9]{5}$/.test(parsedPatientAddress.postalCode))) {
        return res.status(400).json({ success: false, message: 'Check the address fields and enter a valid 6-digit Indian PIN code.' });
      }
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

    let selectedInsuranceCompany = null;
    if (role === 'insurance_agent') {
      const companyId = parsedInsuranceDetails?.insuranceCompanyId;
      if (!mongoose.Types.ObjectId.isValid(companyId || '')) return res.status(400).json({ success: false, message: 'Select an enrolled insurance company.' });
      selectedInsuranceCompany = await InsuranceCompany.findOne({ _id: companyId, isActive: true, 'verification.status': 'verified', 'verification.expiresAt': { $gt: new Date() } }).select('_id name');
      if (!selectedInsuranceCompany) return res.status(400).json({ success: false, message: 'That insurance company is not currently accepting agent applications.' });
    }

    if (role === 'pharmacy_manager' && (
      !parsedPharmacyDetails ||
      !['hospital', 'independent_pharmacy', 'franchise'].includes(parsedPharmacyDetails.organizationType) ||
      !String(parsedPharmacyDetails.name || '').trim() ||
      !String(parsedPharmacyDetails.registrationNumber || '').trim() ||
      !String(parsedPharmacyDetails.address || '').trim() ||
      !String(parsedPharmacyDetails.city || '').trim() ||
      !String(parsedPharmacyDetails.state || '').trim() ||
      !String(parsedPharmacyDetails.postalCode || '').trim() ||
      !/^[1-9][0-9]{5}$/.test(String(parsedPharmacyDetails.postalCode || '')) ||
      !String(parsedPharmacyDetails.openingHours || '').trim()
    )) {
      return res.status(400).json({ success: false, message: 'Complete the pharmacy organization details before applying.' });
    }

    if (role === 'lab_manager' && (
      !parsedLabDetails ||
      !['independent_lab', 'hospital_lab', 'franchise'].includes(parsedLabDetails.organizationType) ||
      !String(parsedLabDetails.name || '').trim() ||
      !String(parsedLabDetails.registrationNumber || '').trim() ||
      !String(parsedLabDetails.address || '').trim() ||
      !String(parsedLabDetails.city || '').trim() ||
      !String(parsedLabDetails.state || '').trim() ||
      !String(parsedLabDetails.postalCode || '').trim() ||
      !/^[1-9][0-9]{5}$/.test(String(parsedLabDetails.postalCode || '')) ||
      (parsedLabDetails.organizationType === 'hospital_lab' && !String(parsedLabDetails.hospitalName || '').trim())
    )) {
      return res.status(400).json({ success: false, message: 'Complete the laboratory organization details before applying.' });
    }

    if (role !== 'patient' && role !== 'pharmacy_manager' && role !== 'lab_manager') {
      const licenseNumber = role === 'medical_staff'
        ? parsedMedicalDetails?.licenseNumber
        : parsedInsuranceDetails?.licenseNumber;
      const expiresAt = parseExpiryDate(credentialExpiresAt);
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
      role,
      approvalStatus: role === 'patient' ? 'approved' : 'pending',
      isActive: role === 'patient',
      phone: `+91${phoneMatch[1]}`,
    };

    if (role === 'medical_staff' && parsedMedicalDetails && typeof parsedMedicalDetails === 'object') {
      const requestedProfessionalType = String(parsedMedicalDetails.professionalType || '').trim().toLowerCase();
      const professionalType = requestedProfessionalType ||
        (String(parsedMedicalDetails.specialization || '').trim().toLowerCase() === 'nursing' ? 'nurse' : 'physician');
      if (!['physician', 'nurse', 'pharmacist', 'lab_technologist'].includes(professionalType)) {
        return res.status(400).json({ success: false, message: 'Select a supported clinical professional type.' });
      }
      let pharmacyOrganization = null;
      if (professionalType === 'pharmacist') {
        if (!mongoose.Types.ObjectId.isValid(parsedMedicalDetails.pharmacyOrganizationId)) {
          return res.status(400).json({ success: false, message: 'Select a MediVault-verified pharmacy organization.' });
        }
        pharmacyOrganization = await PharmacyOrganization.findOne({
          _id: parsedMedicalDetails.pharmacyOrganizationId,
          isActive: true,
          'verification.status': 'verified',
          'verification.expiresAt': { $gt: new Date() },
        }).select('_id');
        if (!pharmacyOrganization) {
          return res.status(400).json({ success: false, message: 'That pharmacy is not currently verified and accepting pharmacist applications.' });
        }
        userData.pharmacyOrganization = pharmacyOrganization._id;
        userData.pharmacyMembershipStatus = 'pending';
      }
      if (professionalType === 'lab_technologist') {
        if (!mongoose.Types.ObjectId.isValid(parsedMedicalDetails.labOrganizationId)) {
          return res.status(400).json({ success: false, message: 'Select a currently verified laboratory accepting staff applications.' });
        }
        const labOrganization = await LabOrganization.findOne({
          _id: parsedMedicalDetails.labOrganizationId,
          isActive: true,
          'verification.status': 'verified',
          'verification.expiresAt': { $gt: new Date() },
        }).select('_id');
        if (!labOrganization) {
          return res.status(400).json({ success: false, message: 'That laboratory is not currently verified and accepting staff applications.' });
        }
        userData.labOrganization = labOrganization._id;
        userData.labMembershipStatus = 'pending';
      }
      let selectedHospital = null;
      if (['physician', 'nurse'].includes(professionalType)) {
        if (!mongoose.Types.ObjectId.isValid(parsedMedicalDetails.hospitalId || '')) {
          return res.status(400).json({ success: false, message: 'Select a MediVault hospital for your staff application.' });
        }
        selectedHospital = await Hospital.findOne({
          _id: parsedMedicalDetails.hospitalId,
          isActive: true,
        }).select('_id name');
        if (!selectedHospital) {
          return res.status(400).json({ success: false, message: 'That hospital is not currently available for staff applications.' });
        }
      }
      userData.medicalStaffDetails = {
        professionalType,
        licenseNumber: parsedMedicalDetails.licenseNumber || '',
        registrationAuthority: parsedMedicalDetails.registrationAuthority || '',
        registrationState: parsedMedicalDetails.registrationState || '',
        specialization: parsedMedicalDetails.specialization || '',
        hospitalAffiliation: selectedHospital?.name || '',
        hospital: selectedHospital?._id || null,
      };
    }

    if (parsedInsuranceDetails && typeof parsedInsuranceDetails === 'object') {
      if (selectedInsuranceCompany) userData.insuranceCompany = selectedInsuranceCompany._id;
      userData.insuranceDetails = {
        companyName: selectedInsuranceCompany?.name || String(parsedInsuranceDetails.companyName || '').trim(),
        agentId:
          role === 'insurance_agent'
            ? generateCompanyAgentId(parsedInsuranceDetails.companyName)
            : '',
        licenseNumber: parsedInsuranceDetails.licenseNumber || '',
      };
    }

    if (role === 'pharmacy_manager') {
      let selectedHospital = null;
      if (parsedPharmacyDetails.organizationType === 'hospital') {
        if (!mongoose.Types.ObjectId.isValid(parsedPharmacyDetails.hospitalId || '')) return res.status(400).json({ success:false,message:'Select a valid hospital for an in-house pharmacy.' });
        selectedHospital = await Hospital.findOne({_id:parsedPharmacyDetails.hospitalId,isActive:true});
        if (!selectedHospital) return res.status(400).json({success:false,message:'Selected hospital is not currently available.'});
      }
      if (!req.file || !String(parsedPharmacyDetails.registrationNumber || '').trim() ||
          !credentialExpiresAt || Number.isNaN(parseExpiryDate(credentialExpiresAt).getTime()) ||
          parseExpiryDate(credentialExpiresAt) <= new Date()) {
        return res.status(400).json({ success: false, message: 'Organization applications require a current registration document and future expiry date.' });
      }
      credentialStorageFileId = await saveFile(req.file.buffer, `pharmacy-license-${Date.now()}`);
      const organization = await PharmacyOrganization.create({
        hospital: selectedHospital?._id || null,
        name: String(parsedPharmacyDetails.name).trim(),
        organizationType: parsedPharmacyDetails.organizationType,
        registrationNumber: String(parsedPharmacyDetails.registrationNumber).trim(),
        address: String(parsedPharmacyDetails.address).trim(),
        city: String(parsedPharmacyDetails.city).trim(),
        district: String(parsedPharmacyDetails.district || '').trim(),
        state: String(parsedPharmacyDetails.state).trim(),
        postalCode: String(parsedPharmacyDetails.postalCode).trim(),
        postOffice: String(parsedPharmacyDetails.postOffice || '').trim(),
        phone: `+91${phoneMatch[1]}`,
        openingHours: String(parsedPharmacyDetails.openingHours).trim(),
        manager: null,
        verification: {
          status: 'pending',
          expiresAt: parseExpiryDate(credentialExpiresAt),
          documentStorageFileId: credentialStorageFileId,
          documentFileName: req.file.originalname,
          documentFileType: req.file.mimetype,
          documentFileSize: req.file.size,
          submittedAt: new Date(),
        },
      });
      createdOrganizationId = organization._id;
    } else if (role === 'lab_manager') {
      let selectedHospital = null;
      if (parsedLabDetails.organizationType === 'hospital_lab') {
        if (!mongoose.Types.ObjectId.isValid(parsedLabDetails.hospitalId || '')) return res.status(400).json({ success:false,message:'Select a valid hospital for an in-house laboratory.' });
        selectedHospital = await Hospital.findOne({_id:parsedLabDetails.hospitalId,isActive:true});
        if (!selectedHospital) return res.status(400).json({success:false,message:'Selected hospital is not currently available.'});
      }
      if (!req.file || !credentialExpiresAt || Number.isNaN(parseExpiryDate(credentialExpiresAt).getTime()) ||
          parseExpiryDate(credentialExpiresAt) <= new Date()) {
        return res.status(400).json({ success: false, message: 'Laboratory applications require a current registration document and future expiry date.' });
      }
      credentialStorageFileId = await saveFile(req.file.buffer, `lab-registration-${Date.now()}`);
      const organization = await LabOrganization.create({
        hospital: selectedHospital?._id || null,
        name: String(parsedLabDetails.name).trim(),
        organizationType: parsedLabDetails.organizationType,
        registrationNumber: String(parsedLabDetails.registrationNumber).trim(),
        address: String(parsedLabDetails.address).trim(),
        city: String(parsedLabDetails.city).trim(),
        district: String(parsedLabDetails.district || '').trim(),
        state: String(parsedLabDetails.state).trim(),
        postalCode: String(parsedLabDetails.postalCode).trim(),
        postOffice: String(parsedLabDetails.postOffice || '').trim(),
        hospitalName: selectedHospital?.name || '',
        manager: null,
        verification: {
          status: 'pending',
          expiresAt: parseExpiryDate(credentialExpiresAt),
          documentStorageFileId: credentialStorageFileId,
          documentFileName: req.file.originalname,
          documentFileType: req.file.mimetype,
          documentFileSize: req.file.size,
          submittedAt: new Date(),
        },
      });
      createdOrganizationId = organization._id;
      createdOrganizationModel = LabOrganization;
    } else if (role !== 'patient') {
      credentialStorageFileId = await saveFile(req.file.buffer, `credential-${Date.now()}`);
      userData.credentialVerification = {
        status: 'pending',
        expiresAt: parseExpiryDate(credentialExpiresAt),
        documentStorageFileId: credentialStorageFileId,
        documentFileName: req.file.originalname,
        documentFileType: req.file.mimetype,
        documentFileSize: req.file.size,
        submittedAt: new Date(),
      };
    }

    const user = await User.create(userData);
    userCreated = true;
    if (createdOrganizationId && role === 'pharmacy_manager') {
      const organization = await PharmacyOrganization.findByIdAndUpdate(createdOrganizationId, { manager: user._id }, { new: true });
      organization.admins.addToSet(user._id);
      await organization.save();
      user.pharmacyOrganization = organization._id;
      user.credentialVerification = { status: 'verified', expiresAt: organization.verification.expiresAt };
      await user.save();
      credentialStorageFileId = null;
    } else if (createdOrganizationId && role === 'lab_manager') {
      const organization = await LabOrganization.findByIdAndUpdate(createdOrganizationId, { manager: user._id }, { new: true });
      organization.admins.addToSet(user._id);
      await organization.save();
      user.labOrganization = organization._id;
      user.credentialVerification = { status: 'verified', expiresAt: organization.verification.expiresAt };
      await user.save();
      credentialStorageFileId = null;
    }

    // Initialize Health Profile for patients (or default profile)
    await HealthProfile.create({
      user: user._id,
      fullName: user.name,
      bloodGroup: 'Unknown',
      allergies: [],
      medicalConditions: [],
      medications: [],
      emergencyContact: { name: '', relationship: '', phone: '' },
      ...(role === 'patient' && parsedPatientAddress ? {
        address: String(parsedPatientAddress.address || '').trim(),
        city: String(parsedPatientAddress.city || '').trim(),
        district: String(parsedPatientAddress.district || '').trim(),
        state: String(parsedPatientAddress.state || '').trim(),
        postalCode: String(parsedPatientAddress.postalCode || '').trim(),
        postOffice: String(parsedPatientAddress.postOffice || '').trim(),
      } : {}),
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
      if (createdOrganizationId) await createdOrganizationModel.findByIdAndDelete(createdOrganizationId);
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
      insurance_admin: 'insurer_admin',
      pharmacy: 'pharmacy_manager',
      lab: 'lab_manager',
      admin: 'admin',
      hospital: 'hospital_admin',
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
    const hospitalStaff = portal === 'hospital' && user.role === 'hospital_admin';
    const laboratoryStaff = portal === 'lab' && user.role === 'medical_staff' &&
      user.medicalStaffDetails?.professionalType === 'lab_technologist';
    const pharmacyChain = portal === 'pharmacy' && user.role === 'pharmacy_chain_admin';
    const labChain = portal === 'lab' && user.role === 'lab_chain_admin';
    if (!isMatch || (portal === 'lab' ? user.role !== requiredRole && !laboratoryStaff && !labChain : portal === 'pharmacy' ? user.role !== requiredRole && !pharmacyChain : user.role !== requiredRole)) {
      return res.status(401).json({
        success: false,
        message: 'Email or password is incorrect.',
      });
    }

    const isStaff = ['medical_staff', 'insurance_agent', 'pharmacy_manager', 'lab_manager'].includes(user.role);
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

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User account not found.' });
    // The current (or temporary) password is always required, so a stolen session token alone cannot change the password.
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: user.mustChangePassword ? 'Enter the temporary password.' : 'Enter your current password.' });
    }
    if (!(await user.comparePassword(String(currentPassword)))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    if (await user.comparePassword(String(newPassword))) {
      return res.status(400).json({ success: false, message: 'Choose a different password.' });
    }
    user.password = String(newPassword);
    user.mustChangePassword = false;
    await user.save();
    await createAuditLog({ userId: user._id, performedBy: user._id, action: 'PASSWORD_CHANGED', details: 'User changed their password.', resourceId: user._id, resourceType: 'User', req });
    return res.json({ success: true, message: 'Password changed successfully.', user: formatUserResponse(user) });
  } catch (error) { next(error); }
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
    const expiresAt = parseExpiryDate(req.body.credentialExpiresAt);
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
