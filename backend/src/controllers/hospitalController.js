import mongoose from 'mongoose';
import Hospital from '../models/Hospital.js';
import User from '../models/User.js';
import LabOrganization from '../models/LabOrganization.js';
import PharmacyOrganization from '../models/PharmacyOrganization.js';
import { createAuditLog } from '../services/auditService.js';
import { readFile, sendFile } from '../services/fileStorageService.js';

export const listHospitals = async (_req, res, next) => { try { const hospitals = await Hospital.find({ isActive: true }).select('name city state').sort({ name: 1 }).lean(); res.json({ success: true, hospitals: hospitals.map((h) => ({ ...h, id: h._id })) }); } catch (e) { next(e); } };
export const adminHospitals = async (_req, res, next) => { try { res.json({ success: true, hospitals: await Hospital.find({}).sort({ createdAt: -1 }).lean() }); } catch (e) { next(e); } };
export const createHospital = async (req, res, next) => {
  try {
    const { name, registrationNumber, address, city, district, state, postalCode, postOffice } = req.body || {};
    const limits = { name: 150, registrationNumber: 100, address: 300, city: 100, district: 100, state: 100, postalCode: 6, postOffice: 150 };
    const details = { name, registrationNumber, address, city, district: district || '', state, postalCode, postOffice: postOffice || '' };
    const requiredFields = ['name', 'registrationNumber', 'address', 'city', 'state', 'postalCode'];
    if (requiredFields.some((field) => typeof details[field] !== 'string' || !details[field].trim()) ||
      Object.entries(details).some(([field, value]) => typeof value !== 'string' || value.trim().length > limits[field])) {
      return res.status(400).json({ success: false, message: 'Enter all hospital details within their maximum lengths.' });
    }
    if (!/^[1-9][0-9]{5}$/.test(String(postalCode || ''))) return res.status(400).json({ success: false, message: 'Enter a valid 6-digit Indian PIN code.' });
    const normalized = Object.fromEntries(Object.entries(details).map(([field, value]) => [field, value.trim()]));
    const duplicate = await Hospital.findOne({ $or: [
      { registrationNumber: normalized.registrationNumber },
      { name: normalized.name, city: normalized.city, state: normalized.state },
    ] });
    if (duplicate) return res.status(409).json({ success: false, message: 'A hospital with these identifying details already exists.' });
    const hospital = await Hospital.create({ ...normalized, verificationStatus: 'pending' });
    await createAuditLog({ userId: req.user._id, performedBy: req.user._id, action: 'HOSPITAL_CREATED', details: `Main administrator created hospital ${hospital.name} for onboarding review.`, resourceId: hospital._id, resourceType: 'Hospital', req });
    return res.status(201).json({ success: true, hospital });
  } catch (error) {
    next(error);
  }
};
export const createHospitalAdmin = async (req, res, next) => {
  try {
    const { hospitalId } = req.params;
    const { name, email, phone, temporaryPassword } = req.body || {};
    if (
      !mongoose.Types.ObjectId.isValid(hospitalId) ||
      ![name, email, phone, temporaryPassword].every((value) => String(value || '').trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Hospital, name, email, phone, and temporary password are required.',
      });
    }

    const normalizedPhone = String(phone).replace(/[\s()-]/g, '');
    const phoneMatch = normalizedPhone.match(/^(?:\+?91)?([6-9]\d{9})$/);
    if (!phoneMatch) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 10-digit Indian mobile number.',
      });
    }
    if (String(temporaryPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Temporary password must be at least 8 characters.',
      });
    }

    const hospital = await Hospital.findOne({ _id: hospitalId, isActive: true });
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Active hospital not found.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: `+91${phoneMatch[1]}`,
      password: String(temporaryPassword),
      role: 'hospital_admin',
      approvalStatus: 'approved',
      isActive: true,
      mustChangePassword: true,
      hospitalAdminOf: [hospital._id],
    });
    await createAuditLog({
      userId: user._id,
      performedBy: req.user._id,
      action: 'HOSPITAL_ADMIN_CREATED',
      details: `Main administrator created a hospital administrator account for ${hospital.name}.`,
      resourceId: hospital._id,
      resourceType: 'Hospital',
      req,
    });
    return res.status(201).json({
      success: true,
      message: 'Hospital administrator created. Share the temporary password securely.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalAdminOf: user.hospitalAdminOf,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    next(error);
  }
};
export const assignHospitalAdmin = async (req, res, next) => { try { if (!mongoose.Types.ObjectId.isValid(req.params.hospitalId) || !mongoose.Types.ObjectId.isValid(req.params.userId)) return res.status(400).json({ success: false, message: 'Invalid hospital or user.' }); const [h, u] = await Promise.all([Hospital.findById(req.params.hospitalId), User.findById(req.params.userId)]); if (!h || !u) return res.status(404).json({ success: false, message: 'Hospital or user not found.' }); u.role = 'hospital_admin'; if (!u.hospitalAdminOf.some((id) => String(id) === String(h._id))) u.hospitalAdminOf.push(h._id); u.isActive = true; u.approvalStatus = 'approved'; await u.save(); await createAuditLog({ userId: u._id, performedBy: req.user._id, action: 'ADMIN_USER_UPDATED', details: `Main administrator assigned ${u.name} to manage ${h.name}.`, resourceId: h._id, resourceType: 'Hospital', req }); res.json({ success: true, message: 'Hospital administrator assigned.' }); } catch (e) { next(e); } };
export const myHospitals = async (req, res, next) => { try { res.json({ success: true, hospitals: await Hospital.find({ _id: { $in: req.user.hospitalAdminOf }, isActive: true }).lean() }); } catch (e) { next(e); } };
export const hospitalWorkspace = async (req, res, next) => { try { const id = req.params.hospitalId; if (!req.user.hospitalAdminOf.some((x) => String(x) === id)) return res.status(403).json({ success: false, message: 'This hospital is outside your administrator assignment.' }); const hospital = await Hospital.findById(id).lean(); if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found.' }); const [labs, pharmacies, staff] = await Promise.all([LabOrganization.find({ hospital: id }).select('name organizationType verification.status isActive').lean(), PharmacyOrganization.find({ hospital: id }).select('name organizationType verification.status isActive').lean(), User.find({ 'medicalStaffDetails.hospital': id, role: 'medical_staff' }).select('name email phone isActive approvalStatus medicalStaffDetails.professionalType medicalStaffDetails.specialization credentialVerification.status credentialVerification.expiresAt').lean()]); res.json({ success: true, hospital, labs, pharmacies, staff }); } catch (e) { next(e); } };

const getHospitalStaffApplication = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    res.status(400).json({ success: false, message: 'A valid staff user ID is required.' });
    return null;
  }
  const user = await User.findOne({
    _id: req.params.userId,
    role: 'medical_staff',
    'medicalStaffDetails.professionalType': { $in: ['physician', 'nurse'] },
    'medicalStaffDetails.hospital': { $in: req.user.hospitalAdminOf },
  });
  if (!user) {
    res.status(404).json({ success: false, message: 'Hospital staff application not found.' });
    return null;
  }
  return user;
};

export const hospitalStaffApplications = async (req, res, next) => {
  try {
    const staff = await User.find({
      role: 'medical_staff',
      'medicalStaffDetails.professionalType': { $in: ['physician', 'nurse'] },
      'medicalStaffDetails.hospital': { $in: req.user.hospitalAdminOf },
      $or: [
        { approvalStatus: 'pending' },
        { 'credentialVerification.status': { $in: ['pending', 'needs_changes', 'rejected'] } },
        { 'credentialVerification.expiresAt': { $lte: new Date() } },
      ],
    })
      .select('name email phone approvalStatus isActive medicalStaffDetails.professionalType medicalStaffDetails.specialization medicalStaffDetails.hospitalAffiliation credentialVerification.status credentialVerification.expiresAt credentialVerification.documentFileName credentialVerification.reviewNote')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, applications: staff.map((user) => ({ ...user, id: String(user._id) })) });
  } catch (error) { next(error); }
};

export const reviewHospitalStaffCredential = async (req, res, next) => {
  try {
    const { decision, reviewNote = '' } = req.body || {};
    if (!['verified', 'needs_changes', 'rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'Decision must be verified, needs_changes, or rejected.' });
    if (decision !== 'verified' && !String(reviewNote).trim()) return res.status(400).json({ success: false, message: 'Add a note when sending back or rejecting credential documents.' });
    const user = await getHospitalStaffApplication(req, res);
    if (!user) return;
    if (!user.credentialVerification?.documentStorageFileId) return res.status(404).json({ success: false, message: 'No credential document is available for review.' });
    if (decision === 'verified' && user.credentialVerification.status !== 'pending') return res.status(409).json({ success: false, message: 'The applicant must resubmit requested changes before credentials can be verified.' });
    if (decision === 'verified' && (!user.credentialVerification.expiresAt || user.credentialVerification.expiresAt <= new Date())) return res.status(400).json({ success: false, message: 'This credential is expired. It cannot be verified.' });
    user.credentialVerification.status = decision;
    user.credentialVerification.reviewNote = String(reviewNote).trim().slice(0, 1000);
    user.credentialVerification.reviewedAt = new Date();
    user.credentialVerification.reviewedBy = req.user._id;
    await user.save();
    await createAuditLog({ userId: user._id, performedBy: req.user._id, action: 'ADMIN_USER_UPDATED', details: `Hospital administrator (${req.user.name}) marked ${user.medicalStaffDetails.professionalType} credentials ${decision}${reviewNote ? `: ${String(reviewNote).trim().slice(0, 300)}` : ''}`, resourceId: user._id, resourceType: 'User', req });
    res.json({ success: true, message: `Credentials marked ${decision}.` });
  } catch (error) { next(error); }
};

export const approveHospitalStaff = async (req, res, next) => {
  try {
    const user = await getHospitalStaffApplication(req, res);
    if (!user) return;
    if (user.approvalStatus !== 'pending') return res.status(409).json({ success: false, message: 'This staff account does not have a pending approval request.' });
    if (user.credentialVerification?.status !== 'verified' || !user.credentialVerification.expiresAt || user.credentialVerification.expiresAt <= new Date()) return res.status(409).json({ success: false, message: 'Verify a current, unexpired staff credential document before approving the account.' });
    user.approvalStatus = 'approved';
    user.isActive = true;
    await user.save();
    await createAuditLog({ userId: user._id, performedBy: req.user._id, action: 'ADMIN_USER_UPDATED', details: `Hospital administrator (${req.user.name}) approved ${user.medicalStaffDetails.professionalType} account for ${user.name}.`, resourceId: user._id, resourceType: 'User', req });
    res.json({ success: true, message: 'Hospital staff account approved.' });
  } catch (error) { next(error); }
};

export const downloadHospitalStaffCredential = async (req, res, next) => {
  try {
    const user = await getHospitalStaffApplication(req, res);
    if (!user) return;
    if (!user.credentialVerification?.documentStorageFileId) return res.status(404).json({ success: false, message: 'Credential document not found.' });
    const file = {
      storageFileId: user.credentialVerification.documentStorageFileId,
      fileName: user.credentialVerification.documentFileName || 'credential-document',
      fileType: user.credentialVerification.documentFileType || 'application/octet-stream',
    };
    const buffer = await readFile(file);
    await createAuditLog({ userId: user._id, performedBy: req.user._id, action: 'ADMIN_USER_UPDATED', details: `Hospital administrator (${req.user.name}) viewed credential document for ${user.name}.`, resourceId: user._id, resourceType: 'User', req });
    return sendFile(res, file, buffer);
  } catch (error) { next(error); }
};
