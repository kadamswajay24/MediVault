import mongoose from 'mongoose';
import LabOrganization from '../models/LabOrganization.js';
import User from '../models/User.js';
import { createAuditLog } from '../services/auditService.js';
import { deleteFile, readFile, saveFile, sendFile } from '../services/fileStorageService.js';
import { parseExpiryDate } from '../utils/dateValidation.js';

const publicFields = 'name organizationType hospital hospitalName address city state postalCode verification.status verification.expiresAt';

export const getLabDirectory = async (req, res, next) => {
  try {
    const organizations = await LabOrganization.find({
      isActive: true,
      organizationType: { $ne: 'franchise' },
      'verification.status': 'verified',
      'verification.expiresAt': { $gt: new Date() },
    }).select(publicFields).populate('hospital','name').sort({ city: 1, name: 1 }).lean();
    return res.status(200).json({
      success: true,
      organizations: organizations.map((organization) => ({ ...organization, id: organization._id.toString() })),
    });
  } catch (error) {
    return next(error);
  }
};

export const getLabApplication = async (req, res, next) => {
  try {
    const organization = await LabOrganization.findOne({ manager: req.user._id });
    if (!organization) return res.status(404).json({ success: false, message: 'Laboratory application not found.' });
    return res.status(200).json({
      success: true,
      organization: {
        id: organization._id,
        name: organization.name,
        organizationType: organization.organizationType,
        hospitalName: organization.hospitalName,
        verification: {
          status: organization.verification.status,
          expiresAt: organization.verification.expiresAt,
          reviewNote: organization.verification.reviewNote,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getManagedLab = async (req, res, next) => {
  try {
    const organization = await LabOrganization.findOne({ $or: [{ manager: req.user._id }, { admins: req.user._id }], isActive: true });
    if (!organization) return res.status(404).json({ success: false, message: 'Managed laboratory not found.' });
    const locations = organization.organizationType === 'franchise'
      ? await LabOrganization.find({ franchiseParent: organization._id, isActive: true, 'verification.status': 'verified', 'verification.expiresAt': { $gt: new Date() } }).select('_id name registrationNumber address city district state postalCode postOffice verification.status isActive').lean()
      : [{ _id: organization._id, name: organization.name }];
    const staff = await User.find({
      labOrganization: { $in: locations.map((location) => location._id) },
      role: 'medical_staff',
      'medicalStaffDetails.professionalType': 'lab_technologist',
    }).select('name email phone approvalStatus isActive labMembershipStatus medicalStaffDetails.licenseNumber credentialVerification.status credentialVerification.expiresAt createdAt').sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      organization: {
        id: organization._id,
        name: organization.name,
        organizationType: organization.organizationType,
        hospitalName: organization.hospitalName,
        registrationNumber: organization.registrationNumber,
        address: organization.address,
        city: organization.city,
        district: organization.district,
        state: organization.state,
        postalCode: organization.postalCode,
        postOffice: organization.postOffice,
        verification: {
          status: organization.verification.status,
          expiresAt: organization.verification.expiresAt,
          reviewNote: organization.verification.reviewNote,
        },
      },
      branches: organization.organizationType === 'franchise' ? locations.map((location) => ({ ...location, id: String(location._id) })) : [],
      staff,
    });
  } catch (error) {
    return next(error);
  }
};

export const decideLabStaffMembership = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ success: false, message: 'A valid laboratory staff account is required.' });
    }
    const { decision } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Membership decision must be approved or rejected.' });
    }
    const organization = await LabOrganization.findOne({
      $or: [{ manager: req.user._id }, { admins: req.user._id }],
      isActive: true,
      'verification.status': 'verified',
      'verification.expiresAt': { $gt: new Date() },
    });
    if (!organization) return res.status(403).json({ success: false, message: 'A currently verified laboratory is required to manage staff membership.' });
    const staff = await User.findOne({
      _id: req.params.userId,
      role: 'medical_staff',
      'medicalStaffDetails.professionalType': 'lab_technologist',
      labOrganization: { $in: organization.organizationType === 'franchise'
        ? await LabOrganization.find({ franchiseParent: organization._id, isActive: true, 'verification.status': 'verified', 'verification.expiresAt': { $gt: new Date() } }).distinct('_id')
        : [organization._id] },
      labMembershipStatus: 'pending',
    });
    if (!staff) return res.status(404).json({ success: false, message: 'Pending laboratory staff membership not found.' });
    if (decision === 'approved' && staff.credentialVerification?.status !== 'verified') {
      return res.status(409).json({ success: false, message: 'A MediVault administrator must verify staff credentials before membership approval.' });
    }
    staff.labMembershipStatus = decision;
    if (decision === 'rejected') {
      staff.isActive = false;
      staff.approvalStatus = 'pending';
    }
    await staff.save();
    await createAuditLog({
      userId: staff._id,
      performedBy: req.user._id,
      action: 'LAB_MEMBERSHIP_REVIEWED',
      details: `${organization.name} manager ${req.user.name} ${decision} laboratory staff membership.`,
      resourceId: staff._id,
      resourceType: 'User',
      req,
    });
    return res.status(200).json({ success: true, message: `Laboratory staff membership ${decision}.`, staff });
  } catch (error) {
    return next(error);
  }
};

export const createLabChainBranch = async (req, res, next) => {
  let documentStorageFileId;
  try {
    const parent = await LabOrganization.findOne({ _id: req.user.labChain, admins: req.user._id, organizationType: 'franchise', isActive: true, 'verification.status': 'verified', 'verification.expiresAt': { $gt: new Date() } });
    if (!parent) return res.status(403).json({ success: false, message: 'A currently verified laboratory chain is required to add branches.' });
    const { name, registrationNumber, address, city, district, state, postalCode, postOffice, credentialExpiresAt } = req.body || {};
    const expiresAt = parseExpiryDate(credentialExpiresAt);
    if (![name, registrationNumber, address, city, state, postalCode].every((value) => typeof value === 'string' && value.trim()) || !/^[1-9][0-9]{5}$/.test(postalCode) || !req.file || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'Complete the laboratory branch details and upload a current registration document.' });
    }
    documentStorageFileId = await saveFile(req.file.buffer, `lab-chain-branch-${Date.now()}`);
    const branch = await LabOrganization.create({
      name: name.trim(), organizationType: 'independent_lab', franchiseParent: parent._id,
      registrationNumber: registrationNumber.trim(), address: address.trim(), city: city.trim(), district: String(district || '').trim(), state: state.trim(), postalCode: postalCode.trim(), postOffice: String(postOffice || '').trim(),
      manager: null,
      verification: { status: 'verified', expiresAt, documentStorageFileId, documentFileName: req.file.originalname, documentFileType: req.file.mimetype, documentFileSize: req.file.size, submittedAt: new Date(), reviewedAt: new Date(), reviewedBy: req.user._id, reviewNote: 'Branch approved by the laboratory chain administrator.' },
    });
    documentStorageFileId = null;
    await createAuditLog({ userId: req.user._id, performedBy: req.user._id, action: 'LAB_ORGANIZATION_REVIEWED', details: `${req.user.name} enrolled and approved ${branch.name} under laboratory chain ${parent.name}.`, resourceId: branch._id, resourceType: 'LabOrganization', req });
    res.status(201).json({ success: true, message: 'Laboratory branch added to your chain.', branch: { id: branch._id, name: branch.name } });
  } catch (error) {
    if (documentStorageFileId) await deleteFile({ storageFileId: documentStorageFileId }).catch(() => {});
    next(error);
  }
};

export const listLabsForAdmin = async (req, res, next) => {
  try {
    const organizations = await LabOrganization.find({ franchiseParent: null }).populate('manager', 'name email').sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      organizations: organizations.map(({ verification, ...organization }) => ({
        ...organization,
        verification: {
          status: verification.status,
          expiresAt: verification.expiresAt,
          documentFileName: verification.documentFileName,
          documentFileType: verification.documentFileType,
          documentFileSize: verification.documentFileSize,
          submittedAt: verification.submittedAt,
          reviewedAt: verification.reviewedAt,
          reviewNote: verification.reviewNote,
          hasDocument: Boolean(verification.documentStorageFileId),
        },
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const downloadLabDocument = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.organizationId)) {
      return res.status(400).json({ success: false, message: 'A valid laboratory organization is required.' });
    }
    const organization = await LabOrganization.findById(req.params.organizationId);
    if (organization?.franchiseParent) return res.status(403).json({ success: false, message: 'Laboratory chain branch documents are managed by the chain administrator.' });
    if (!organization?.verification.documentStorageFileId) {
      return res.status(404).json({ success: false, message: 'Laboratory registration document not found.' });
    }
    const file = {
      storageFileId: organization.verification.documentStorageFileId,
      fileName: organization.verification.documentFileName || 'laboratory-registration',
      fileType: organization.verification.documentFileType || 'application/octet-stream',
    };
    const buffer = await readFile(file);
    await createAuditLog({
      userId: organization.manager || req.user._id,
      performedBy: req.user._id,
      action: 'LAB_ORGANIZATION_REVIEWED',
      details: `Admin ${req.user.name} viewed registration document for ${organization.name}.`,
      resourceId: organization._id,
      resourceType: 'LabOrganization',
      req,
    });
    return sendFile(res, file, buffer);
  } catch (error) {
    return next(error);
  }
};

export const reviewLabOrganization = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.organizationId)) {
      return res.status(400).json({ success: false, message: 'A valid laboratory organization is required.' });
    }
    const { decision, reviewNote = '' } = req.body || {};
    if (!['verified', 'needs_changes', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be verified, needs_changes, or rejected.' });
    }
    if (decision !== 'verified' && !String(reviewNote).trim()) {
      return res.status(400).json({ success: false, message: 'Add a review note when requesting changes or rejecting the laboratory.' });
    }
    const organization = await LabOrganization.findById(req.params.organizationId);
    if (!organization) return res.status(404).json({ success: false, message: 'Laboratory organization not found.' });
    if (organization.franchiseParent) return res.status(403).json({ success: false, message: 'Laboratory chain branches are managed by their chain administrator.' });
    if (!organization.verification.documentStorageFileId) {
      return res.status(409).json({ success: false, message: 'No laboratory registration document is available for review.' });
    }
    if (decision === 'verified' && organization.verification.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'The laboratory must resubmit requested documents before verification.' });
    }
    if (decision === 'verified' && organization.verification.expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'The laboratory registration document has expired.' });
    }
    organization.verification.status = decision;
    organization.verification.reviewNote = String(reviewNote).trim().slice(0, 1000);
    organization.verification.reviewedAt = new Date();
    organization.verification.reviewedBy = req.user._id;
    if (decision === 'rejected') organization.isActive = false;
    await organization.save();

    const manager = organization.manager ? await User.findById(organization.manager) : null;
    if (manager) {
      if (decision === 'verified') {
        if (organization.organizationType === 'franchise') {
          manager.role = 'lab_chain_admin';
          manager.labChain = organization._id;
          organization.admins.addToSet(manager._id);
          await organization.save();
        }
        manager.approvalStatus = 'approved';
        manager.isActive = true;
        manager.credentialVerification = {
          status: 'verified',
          expiresAt: organization.verification.expiresAt,
          reviewNote: '',
          reviewedAt: new Date(),
          reviewedBy: req.user._id,
        };
      } else if (decision === 'rejected') {
        manager.isActive = false;
      } else {
        manager.isActive = false;
        manager.approvalStatus = 'pending';
      }
      await manager.save();
    }
    await createAuditLog({
      userId: manager?._id || req.user._id,
      performedBy: req.user._id,
      action: 'LAB_ORGANIZATION_REVIEWED',
      details: `Admin ${req.user.name} marked ${organization.name} ${decision}${reviewNote ? `: ${String(reviewNote).trim().slice(0, 300)}` : ''}`,
      resourceId: organization._id,
      resourceType: 'LabOrganization',
      req,
    });
    return res.status(200).json({
      success: true,
      message: `Laboratory organization marked ${decision}.`,
      organization: { id: organization._id, verification: organization.verification, isActive: organization.isActive },
    });
  } catch (error) {
    return next(error);
  }
};

export const resubmitLabCredential = async (req, res, next) => {
  let replacementFileId;
  try {
    const organization = await LabOrganization.findOne({ manager: req.user._id });
    if (!organization) return res.status(404).json({ success: false, message: 'Managed laboratory not found.' });
    const expired = organization.verification.status === 'verified' && organization.verification.expiresAt <= new Date();
    if (organization.verification.status !== 'needs_changes' && !expired) {
      return res.status(409).json({ success: false, message: 'Laboratory registration documents are not open for resubmission.' });
    }
    const expiresAt = parseExpiryDate(req.body?.credentialExpiresAt);
    if (!req.file || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'Upload an updated laboratory registration document with a future expiry date.' });
    }
    replacementFileId = await saveFile(req.file.buffer, `lab-registration-${Date.now()}`);
    const oldFileId = organization.verification.documentStorageFileId;
    organization.verification.status = 'pending';
    organization.verification.expiresAt = expiresAt;
    organization.verification.documentStorageFileId = replacementFileId;
    organization.verification.documentFileName = req.file.originalname;
    organization.verification.documentFileType = req.file.mimetype;
    organization.verification.documentFileSize = req.file.size;
    organization.verification.submittedAt = new Date();
    organization.verification.reviewedAt = null;
    organization.verification.reviewedBy = null;
    organization.verification.reviewNote = '';
    organization.isActive = true;
    await organization.save();
    replacementFileId = null;
    await User.findByIdAndUpdate(req.user._id, { isActive: false, approvalStatus: 'pending' });
    if (oldFileId) await deleteFile({ storageFileId: oldFileId }).catch((error) => console.error('[Laboratory registration cleanup]', error.message));
    return res.status(200).json({ success: true, message: 'Updated laboratory registration documents submitted for review.' });
  } catch (error) {
    if (replacementFileId) await deleteFile({ storageFileId: replacementFileId }).catch((cleanupError) => console.error('[Laboratory registration cleanup]', cleanupError.message));
    return next(error);
  }
};
