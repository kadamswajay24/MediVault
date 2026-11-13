import mongoose from 'mongoose';
import PharmacyOrganization from '../models/PharmacyOrganization.js';
import User from '../models/User.js';
import { createAuditLog } from '../services/auditService.js';
import { deleteFile, readFile, saveFile, sendFile } from '../services/fileStorageService.js';
import { parseExpiryDate } from '../utils/dateValidation.js';

const publicOrganizationFields = 'name organizationType address city district state postalCode postOffice phone openingHours verification.status verification.expiresAt';

const organizationForManager = async (managerId) => PharmacyOrganization.findOne({ $or: [{ manager: managerId }, { admins: managerId }], isActive: true });

const verifiedOrganizationsForManager = async (organization) => {
  if (organization.organizationType !== 'franchise') return [organization._id];
  return PharmacyOrganization.find({
    franchiseParent: organization._id,
    isActive: true,
    'verification.status': 'verified',
    'verification.expiresAt': { $gt: new Date() },
  }).distinct('_id');
};

export const getPharmacyDirectory = async (req, res, next) => {
  try {
    const organizations = await PharmacyOrganization.find({
      isActive: true,
      organizationType: { $in: ['hospital', 'independent_pharmacy'] },
      'verification.status': 'verified',
      'verification.expiresAt': { $gt: new Date() },
    }).select(publicOrganizationFields).sort({ city: 1, name: 1 }).lean();
    return res.status(200).json({
      success: true,
      organizations: organizations.map((organization) => ({
        ...organization,
        id: organization._id.toString(),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const getManagedOrganization = async (req, res, next) => {
  try {
    const organization = await organizationForManager(req.user._id);
    if (!organization) return res.status(404).json({ success: false, message: 'Managed pharmacy organization not found.' });
    const managedLocations = organization.organizationType === 'franchise'
      ? await PharmacyOrganization.find({ franchiseParent: organization._id }).select('_id name').lean()
      : [{ _id: organization._id, name: organization.name }];
    const pharmacists = await User.find({
      pharmacyOrganization: { $in: managedLocations.map((location) => location._id) },
      role: 'medical_staff',
      'medicalStaffDetails.professionalType': 'pharmacist',
    }).select('name email phone approvalStatus isActive pharmacyOrganization pharmacyMembershipStatus medicalStaffDetails.licenseNumber credentialVerification.status credentialVerification.expiresAt createdAt').sort({ createdAt: -1 }).lean();
    const branches = organization.organizationType === 'franchise'
      ? await PharmacyOrganization.find({ franchiseParent: organization._id }).select('name organizationType registrationNumber address city district state postalCode postOffice phone openingHours verification.status verification.expiresAt verification.reviewNote isActive').sort({ createdAt: -1 }).lean()
      : [];
    return res.status(200).json({
      success: true,
      organization: {
        id: organization._id,
        name: organization.name,
        organizationType: organization.organizationType,
        registrationNumber: organization.registrationNumber,
        address: organization.address,
        city: organization.city,
        district: organization.district,
        state: organization.state,
        postalCode: organization.postalCode,
        postOffice: organization.postOffice,
        phone: organization.phone,
        openingHours: organization.openingHours,
        verification: {
          status: organization.verification.status,
          expiresAt: organization.verification.expiresAt,
          reviewNote: organization.verification.reviewNote,
        },
      },
      pharmacists: pharmacists.map((pharmacist) => ({
        ...pharmacist,
        pharmacyOrganization: managedLocations.find((location) => location._id.toString() === pharmacist.pharmacyOrganization?.toString()) || null,
      })),
      branches: branches.map((branch) => ({ ...branch, id: branch._id.toString() })),
    });
  } catch (error) {
    return next(error);
  }
};

export const getOrganizationApplication = async (req, res, next) => {
  try {
    const organization = await PharmacyOrganization.findOne({ manager: req.user._id });
    if (!organization) return res.status(404).json({ success: false, message: 'Pharmacy organization application not found.' });
    return res.status(200).json({
      success: true,
      organization: {
        id: organization._id,
        name: organization.name,
        organizationType: organization.organizationType,
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

export const updateManagedOrganization = async (req, res, next) => {
  try {
    const organization = await organizationForManager(req.user._id);
    if (!organization) return res.status(404).json({ success: false, message: 'Managed pharmacy organization not found.' });
    const { phone, openingHours } = req.body || {};
    if (typeof phone !== 'string' || !/^\+91[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({ success: false, message: 'Enter a valid +91 Indian mobile number for the pharmacy.' });
    }
    if (typeof openingHours !== 'string' || !openingHours.trim() || openingHours.trim().length > 200) {
      return res.status(400).json({ success: false, message: 'Enter opening hours (up to 200 characters).' });
    }
    organization.phone = phone.trim();
    organization.openingHours = openingHours.trim();
    await organization.save();
    return res.status(200).json({ success: true, message: 'Pharmacy contact details updated.', organization });
  } catch (error) {
    return next(error);
  }
};

export const decidePharmacistMembership = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ success: false, message: 'A valid pharmacist account is required.' });
    }
    const { decision } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Membership decision must be approved or rejected.' });
    }
    const organization = await organizationForManager(req.user._id);
    if (!organization) return res.status(404).json({ success: false, message: 'Managed pharmacy organization not found.' });
    if (organization.verification.status !== 'verified' || organization.verification.expiresAt <= new Date()) {
      return res.status(403).json({ success: false, message: 'Only a currently verified organization can manage pharmacist membership.' });
    }
    const managedOrganizationIds = await verifiedOrganizationsForManager(organization);
    if (!managedOrganizationIds.length) return res.status(403).json({ success: false, message: 'No currently verified pharmacy branch is available for membership management.' });
    const pharmacist = await User.findOne({
      _id: req.params.userId,
      role: 'medical_staff',
      'medicalStaffDetails.professionalType': 'pharmacist',
      pharmacyOrganization: { $in: managedOrganizationIds },
      pharmacyMembershipStatus: 'pending',
    });
    if (!pharmacist) return res.status(404).json({ success: false, message: 'Pending pharmacist membership not found for this organization.' });
    if (decision === 'approved' && pharmacist.credentialVerification?.status !== 'verified') {
      return res.status(409).json({ success: false, message: 'A MediVault administrator must verify the pharmacist credentials before membership approval.' });
    }
    pharmacist.pharmacyMembershipStatus = decision;
    if (decision === 'rejected') {
      pharmacist.isActive = false;
      pharmacist.approvalStatus = 'pending';
    }
    await pharmacist.save();
    await createAuditLog({
      userId: pharmacist._id,
      performedBy: req.user._id,
      action: 'PHARMACY_MEMBERSHIP_REVIEWED',
      details: `${organization.name} manager ${req.user.name} ${decision} pharmacist membership.`,
      resourceId: pharmacist._id,
      resourceType: 'User',
      req,
    });
    return res.status(200).json({ success: true, message: `Pharmacist membership ${decision}.`, pharmacist });
  } catch (error) {
    return next(error);
  }
};

export const updateManagedPharmacistStatus = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ success: false, message: 'A valid pharmacist account is required.' });
    }
    const { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') return res.status(400).json({ success: false, message: 'Choose whether to activate or suspend the pharmacist.' });
    const organization = await organizationForManager(req.user._id);
    if (!organization || organization.verification.status !== 'verified' || organization.verification.expiresAt <= new Date()) {
      return res.status(403).json({ success: false, message: 'A currently verified organization is required to manage its pharmacists.' });
    }
    const managedOrganizationIds = await verifiedOrganizationsForManager(organization);
    if (!managedOrganizationIds.length) return res.status(403).json({ success: false, message: 'No currently verified pharmacy branch is available for membership management.' });
    const pharmacist = await User.findOne({
      _id: req.params.userId,
      role: 'medical_staff',
      'medicalStaffDetails.professionalType': 'pharmacist',
      pharmacyOrganization: { $in: managedOrganizationIds },
      pharmacyMembershipStatus: 'approved',
      approvalStatus: 'approved',
    });
    if (!pharmacist) return res.status(404).json({ success: false, message: 'Approved pharmacist membership not found.' });
    pharmacist.isActive = isActive;
    await pharmacist.save();
    await createAuditLog({
      userId: pharmacist._id,
      performedBy: req.user._id,
      action: 'PHARMACY_MEMBERSHIP_REVIEWED',
      details: `${organization.name} manager ${req.user.name} ${isActive ? 'reactivated' : 'suspended'} pharmacist membership.`,
      resourceId: pharmacist._id,
      resourceType: 'User',
      req,
    });
    return res.status(200).json({ success: true, message: `Pharmacist ${isActive ? 'activated' : 'suspended'}.` });
  } catch (error) {
    return next(error);
  }
};

export const reviewPharmacyOrganization = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.organizationId)) {
      return res.status(400).json({ success: false, message: 'A valid pharmacy organization is required.' });
    }
    const { decision, reviewNote = '' } = req.body || {};
    if (!['verified', 'needs_changes', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be verified, needs_changes, or rejected.' });
    }
    if (decision !== 'verified' && !String(reviewNote).trim()) {
      return res.status(400).json({ success: false, message: 'Add a review note when requesting changes or rejecting the organization.' });
    }
    const organization = await PharmacyOrganization.findById(req.params.organizationId);
    if (!organization) return res.status(404).json({ success: false, message: 'Pharmacy organization not found.' });
    if (organization.franchiseParent) return res.status(403).json({ success: false, message: 'Franchise branches are managed by their chain administrator.' });
    if (!organization.verification.documentStorageFileId) {
      return res.status(409).json({ success: false, message: 'No organization registration document is available for review.' });
    }
    if (decision === 'verified' && organization.verification.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'The organization must resubmit requested documents before verification.' });
    }
    if (decision === 'verified' && organization.verification.expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'The organization registration document has expired.' });
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
          manager.role = 'pharmacy_chain_admin';
          manager.pharmacyChain = organization._id;
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
      action: 'PHARMACY_ORGANIZATION_REVIEWED',
      details: `Admin ${req.user.name} marked ${organization.name} ${decision}${reviewNote ? `: ${String(reviewNote).trim().slice(0, 300)}` : ''}`,
      resourceId: organization._id,
      resourceType: 'PharmacyOrganization',
      req,
    });
    return res.status(200).json({
      success: true,
      message: `Pharmacy organization marked ${decision}.`,
      organization: {
        id: organization._id,
        verification: organization.verification,
        isActive: organization.isActive,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const createFranchiseBranch = async (req, res, next) => {
  let documentStorageFileId;
  try {
    const parent = await organizationForManager(req.user._id);
    if (!parent || parent.organizationType !== 'franchise' || parent.verification.status !== 'verified' || parent.verification.expiresAt <= new Date()) {
      return res.status(403).json({ success: false, message: 'A currently verified franchise is required to add branches.' });
    }
    const { name, organizationType, registrationNumber, address, city, district, state, postalCode, postOffice, phone, openingHours, credentialExpiresAt } = req.body || {};
    if (!['hospital', 'independent_pharmacy'].includes(organizationType) ||
        ![name, registrationNumber, address, city, state, postalCode, phone, openingHours].every((value) => typeof value === 'string' && value.trim()) || !/^[1-9][0-9]{5}$/.test(postalCode)) {
      return res.status(400).json({ success: false, message: 'Complete all required pharmacy branch details.' });
    }
    if (!/^\+91[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({ success: false, message: 'Enter a valid +91 Indian mobile number for the branch.' });
    }
    const expiresAt = parseExpiryDate(credentialExpiresAt);
    if (!req.file || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'Upload a current branch registration document with a future expiry date.' });
    }
    documentStorageFileId = await saveFile(req.file.buffer, `pharmacy-branch-registration-${Date.now()}`);
    const branch = await PharmacyOrganization.create({
      name: name.trim(),
      organizationType,
      franchiseParent: parent._id,
      registrationNumber: registrationNumber.trim(),
      address: address.trim(),
      city: city.trim(),
      district: String(district || '').trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
      postOffice: String(postOffice || '').trim(),
      phone: phone.trim(),
      openingHours: openingHours.trim(),
      manager: null,
      verification: {
        status: 'verified',
        expiresAt,
        documentStorageFileId,
        documentFileName: req.file.originalname,
        documentFileType: req.file.mimetype,
        documentFileSize: req.file.size,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
        reviewNote: 'Branch enrolled by the approved franchise chain administrator.',
      },
    });
    documentStorageFileId = null;
    await createAuditLog({
      userId: req.user._id,
      performedBy: req.user._id,
      action: 'PHARMACY_ORGANIZATION_REVIEWED',
      details: `Franchise administrator ${req.user.name} enrolled and approved ${branch.name}.`,
      resourceId: branch._id,
      resourceType: 'PharmacyOrganization',
      req,
    });
    return res.status(201).json({ success: true, message: 'Branch added to your approved franchise chain.', branch });
  } catch (error) {
    if (documentStorageFileId) await deleteFile({ storageFileId: documentStorageFileId }).catch((cleanupError) => console.error('[Pharmacy branch cleanup]', cleanupError.message));
    return next(error);
  }
};

export const resubmitFranchiseBranchCredential = async (req, res, next) => {
  let replacementFileId;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.branchId)) {
      return res.status(400).json({ success: false, message: 'A valid pharmacy branch is required.' });
    }
    const parent = await organizationForManager(req.user._id);
    if (!parent || parent.verification.status !== 'verified' || parent.verification.expiresAt <= new Date()) {
      return res.status(403).json({ success: false, message: 'A currently verified franchise is required to update branch documents.' });
    }
    const branch = await PharmacyOrganization.findOne({ _id: req.params.branchId, franchiseParent: parent._id });
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found for this franchise.' });
    const expired = branch.verification.status === 'verified' && branch.verification.expiresAt <= new Date();
    if (branch.verification.status !== 'needs_changes' && !expired) {
      return res.status(409).json({ success: false, message: 'Branch registration documents are not open for resubmission.' });
    }
    const expiresAt = parseExpiryDate(req.body?.credentialExpiresAt);
    if (!req.file || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'Upload an updated branch registration document with a future expiry date.' });
    }
    replacementFileId = await saveFile(req.file.buffer, `pharmacy-branch-registration-${Date.now()}`);
    const oldFileId = branch.verification.documentStorageFileId;
    branch.verification.status = 'pending';
    branch.verification.expiresAt = expiresAt;
    branch.verification.documentStorageFileId = replacementFileId;
    branch.verification.documentFileName = req.file.originalname;
    branch.verification.documentFileType = req.file.mimetype;
    branch.verification.documentFileSize = req.file.size;
    branch.verification.submittedAt = new Date();
    branch.verification.reviewedAt = null;
    branch.verification.reviewedBy = null;
    branch.verification.reviewNote = '';
    branch.isActive = true;
    await branch.save();
    replacementFileId = null;
    if (oldFileId) await deleteFile({ storageFileId: oldFileId }).catch((error) => console.error('[Pharmacy branch cleanup]', error.message));
    return res.status(200).json({ success: true, message: 'Updated branch registration documents submitted for review.' });
  } catch (error) {
    if (replacementFileId) await deleteFile({ storageFileId: replacementFileId }).catch((cleanupError) => console.error('[Pharmacy branch cleanup]', cleanupError.message));
    return next(error);
  }
};

export const listPharmacyOrganizationsForAdmin = async (req, res, next) => {
  try {
    const organizations = await PharmacyOrganization.find({ franchiseParent: null })
      .populate('manager', 'name email')
      .sort({ createdAt: -1 })
      .lean();
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

export const downloadPharmacyOrganizationDocument = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.organizationId)) {
      return res.status(400).json({ success: false, message: 'A valid pharmacy organization is required.' });
    }
    const organization = await PharmacyOrganization.findById(req.params.organizationId);
    if (organization?.franchiseParent) return res.status(403).json({ success: false, message: 'Franchise branch documents are managed by the chain administrator.' });
    if (!organization?.verification.documentStorageFileId) {
      return res.status(404).json({ success: false, message: 'Organization registration document not found.' });
    }
    const file = {
      storageFileId: organization.verification.documentStorageFileId,
      fileName: organization.verification.documentFileName || 'pharmacy-registration',
      fileType: organization.verification.documentFileType || 'application/octet-stream',
    };
    const buffer = await readFile(file);
    await createAuditLog({
      userId: organization.manager || req.user._id,
      performedBy: req.user._id,
      action: 'PHARMACY_ORGANIZATION_REVIEWED',
      details: `Admin ${req.user.name} viewed registration document for ${organization.name}.`,
      resourceId: organization._id,
      resourceType: 'PharmacyOrganization',
      req,
    });
    return sendFile(res, file, buffer);
  } catch (error) {
    return next(error);
  }
};

export const resubmitOrganizationCredential = async (req, res, next) => {
  let replacementFileId;
  try {
    const organization = await PharmacyOrganization.findOne({ manager: req.user._id });
    if (!organization) return res.status(404).json({ success: false, message: 'Managed pharmacy organization not found.' });
    const expired = organization.verification.status === 'verified' && organization.verification.expiresAt <= new Date();
    if (organization.verification.status !== 'needs_changes' && !expired) {
      return res.status(409).json({ success: false, message: 'Organization registration documents are not open for resubmission.' });
    }
    const expiresAt = parseExpiryDate(req.body?.credentialExpiresAt);
    if (!req.file || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'Upload an updated registration document with a future expiry date.' });
    }
    replacementFileId = await saveFile(req.file.buffer, `pharmacy-license-${Date.now()}`);
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
    if (oldFileId) await deleteFile({ storageFileId: oldFileId }).catch((error) => console.error('[Pharmacy registration cleanup]', error.message));
    return res.status(200).json({ success: true, message: 'Updated organization registration documents submitted for review.' });
  } catch (error) {
    if (replacementFileId) await deleteFile({ storageFileId: replacementFileId }).catch(() => {});
    return next(error);
  }
};
