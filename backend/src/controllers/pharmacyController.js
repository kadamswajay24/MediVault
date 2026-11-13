import { createHash, randomBytes } from 'crypto';
import mongoose from 'mongoose';
import MedicalNote from '../models/MedicalNote.js';
import PrescriptionShare from '../models/PrescriptionShare.js';
import PrescriptionDispenseRecord from '../models/PrescriptionDispenseRecord.js';
import User from '../models/User.js';
import PharmacyOrganization from '../models/PharmacyOrganization.js';
import { createAuditLog } from '../services/auditService.js';

const SHARE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const activeShareFilter = (now = new Date()) => ({
  revokedAt: null,
  expiresAt: { $gt: now },
});

const isCurrentPrescription = (share, prescription) =>
  prescription &&
  prescription.noteType === 'Prescription' &&
  !prescription.deletedAt &&
  prescription.prescriptionItems?.length > 0 &&
  new Date(prescription.updatedAt).getTime() === new Date(share.prescriptionUpdatedAt).getTime();

export const createPrescriptionShare = async (req, res, next) => {
  try {
    const { prescriptionId, pharmacyOrganizationId } = req.body || {};
    if (!isValidId(prescriptionId)) {
      return res.status(400).json({ success: false, message: 'A valid prescription is required.' });
    }

    const prescription = await MedicalNote.findOne({
      _id: prescriptionId,
      patient: req.user._id,
      noteType: 'Prescription',
      deletedAt: null,
      'deletionRequest.status': { $ne: 'pending' },
    }).select('_id title doctor prescriptionItems updatedAt');
    if (!prescription || !prescription.prescriptionItems?.length) {
      return res.status(404).json({ success: false, message: 'Prescription not found or no longer available.' });
    }

    let organization = null;
    if (pharmacyOrganizationId !== undefined) {
      if (!isValidId(pharmacyOrganizationId)) {
        return res.status(400).json({ success: false, message: 'Choose a valid MediVault pharmacy.' });
      }
      organization = await PharmacyOrganization.findOne({
        _id: pharmacyOrganizationId,
        organizationType: { $in: ['hospital', 'independent_pharmacy'] },
        isActive: true,
        'verification.status': 'verified',
        'verification.expiresAt': { $gt: new Date() },
      }).select('_id name');
      if (!organization) {
        return res.status(404).json({ success: false, message: 'That pharmacy is not currently verified and available.' });
      }
    }

    const token = organization ? null : randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SHARE_LIFETIME_MS);
    const share = await PrescriptionShare.create({
      patient: req.user._id,
      prescription: prescription._id,
      channel: organization ? 'directory' : 'code',
      pharmacyOrganization: organization?._id || null,
      tokenHash: token ? hashToken(token) : undefined,
      prescriptionUpdatedAt: prescription.updatedAt,
      expiresAt,
    });

    await createAuditLog({
      userId: req.user._id,
      action: 'PRESCRIPTION_SHARED',
      details: organization
        ? `Patient shared prescription "${prescription.title}" with MediVault-verified pharmacy ${organization.name}.`
        : `Patient shared prescription "${prescription.title}" using a time-limited pharmacy access code.`,
      resourceId: share._id,
      resourceType: 'PrescriptionShare',
      req,
    });

    return res.status(201).json({
      success: true,
      message: organization
        ? `Prescription shared with ${organization.name} for 24 hours.`
        : 'Share this access code with the pharmacist. It expires in 24 hours.',
      share: { id: share._id, prescriptionTitle: prescription.title, expiresAt, pharmacyOrganization: organization },
      ...(token ? { token } : {}),
    });
  } catch (error) {
    return next(error);
  }
};

export const listPrescriptionShares = async (req, res, next) => {
  try {
    const shares = await PrescriptionShare.find({ patient: req.user._id })
      .sort({ createdAt: -1 })
      .populate('prescription', 'title noteType updatedAt deletedAt deletionRequest')
      .populate('pharmacyOrganization', 'name organizationType city')
      .lean();
    return res.status(200).json({
      success: true,
      shares: shares.map((share) => ({
        id: share._id,
        prescriptionTitle: share.prescription?.title || 'Unavailable prescription',
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        revokedAt: share.revokedAt,
        channel: share.channel,
        pharmacyOrganization: share.pharmacyOrganization
          ? { ...share.pharmacyOrganization, id: share.pharmacyOrganization._id.toString() }
          : null,
        active: !share.revokedAt &&
          new Date(share.expiresAt) > new Date() &&
          !share.prescription?.deletedAt &&
          share.prescription?.deletionRequest?.status !== 'pending' &&
          new Date(share.prescription?.updatedAt || 0).getTime() === new Date(share.prescriptionUpdatedAt).getTime(),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const revokePrescriptionShare = async (req, res, next) => {
  try {
    if (!isValidId(req.params.shareId)) {
      return res.status(400).json({ success: false, message: 'Invalid share ID.' });
    }
    const share = await PrescriptionShare.findOneAndUpdate(
      { _id: req.params.shareId, patient: req.user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
      { new: true }
    );
    if (!share) {
      return res.status(404).json({ success: false, message: 'Active prescription share not found.' });
    }

    await createAuditLog({
      userId: req.user._id,
      action: 'PRESCRIPTION_SHARE_REVOKED',
      details: 'Patient revoked a time-limited pharmacy prescription share.',
      resourceId: share._id,
      resourceType: 'PrescriptionShare',
      req,
    });
    return res.status(200).json({ success: true, message: 'Prescription access revoked.' });
  } catch (error) {
    return next(error);
  }
};

export const lookupSharedPrescription = async (req, res, next) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim().toLowerCase() : '';
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ success: false, message: 'Enter a valid pharmacy access code.' });
    }

    const share = await PrescriptionShare.findOneAndUpdate({
      tokenHash: hashToken(token),
      channel: 'code',
      ...activeShareFilter(),
      $or: [{ accessedBy: null }, { accessedBy: req.user._id }],
    }, {
      $set: { accessedBy: req.user._id },
    }, {
      new: true,
    }).select('+tokenHash');
    if (!share) {
      return res.status(404).json({ success: false, message: 'This access code is invalid, expired, revoked, or assigned to another pharmacist.' });
    }

    return respondWithSharedPrescription(req, res, share);
  } catch (error) {
    return next(error);
  }
};

const respondWithSharedPrescription = async (req, res, share) => {
    const prescription = await MedicalNote.findById(share.prescription)
      .select('title prescriptionItems doctor createdAt updatedAt noteType deletedAt')
      .populate('doctor', 'name');
    if (!isCurrentPrescription(share, prescription)) {
      return res.status(410).json({ success: false, message: 'This prescription has changed or is no longer available. Ask the patient to share the current prescription again.' });
    }

    const patient = await User.findById(share.patient).select('name role isActive');
    if (!patient || patient.role !== 'patient' || !patient.isActive) {
      return res.status(410).json({ success: false, message: 'This patient account is no longer available.' });
    }

    await createAuditLog({
      userId: share.patient,
      performedBy: req.user._id,
      action: 'PRESCRIPTION_SHARE_ACCESSED',
      details: `${req.user.name} accessed a prescription through a patient-authorized pharmacy share.`,
      resourceId: share._id,
      resourceType: 'PrescriptionShare',
      req,
    });

    return res.status(200).json({
      success: true,
      shareId: share._id,
      expiresAt: share.expiresAt,
      patientName: patient.name,
      prescription: {
        id: prescription._id,
        title: prescription.title,
        createdAt: prescription.createdAt,
        doctorName: prescription.doctor?.name || 'Issuing clinician',
        items: prescription.prescriptionItems.map(({ medicineName, dosage, frequency, duration, instructions }) => ({
          medicineName, dosage, frequency, duration, instructions,
        })),
      },
    });
};

export const listOrganizationPrescriptionShares = async (req, res, next) => {
  try {
    const organization = req.user.pharmacyOrganization;
    if (!organization || req.user.pharmacyMembershipStatus !== 'approved') {
      return res.status(403).json({ success: false, message: 'An approved pharmacy organization membership is required.' });
    }
    const shares = await PrescriptionShare.find({
      channel: 'directory',
      pharmacyOrganization: organization,
      ...activeShareFilter(),
      $or: [{ accessedBy: null }, { accessedBy: req.user._id }],
    }).sort({ createdAt: -1 })
      .populate('patient', 'name')
      .populate('prescription', 'title noteType updatedAt deletedAt deletionRequest')
      .lean();
    return res.status(200).json({
      success: true,
      shares: shares.filter((share) =>
        !share.prescription?.deletedAt &&
        share.prescription?.deletionRequest?.status !== 'pending' &&
        share.prescription?.noteType === 'Prescription' &&
        new Date(share.prescription?.updatedAt || 0).getTime() === new Date(share.prescriptionUpdatedAt).getTime()
      ).map((share) => ({
        id: share._id,
        patientName: share.patient?.name || 'Patient',
        prescriptionTitle: share.prescription.title,
        sharedAt: share.createdAt,
        expiresAt: share.expiresAt,
        openedByCurrentUser: String(share.accessedBy || '') === String(req.user._id),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const openOrganizationPrescriptionShare = async (req, res, next) => {
  try {
    if (!isValidId(req.params.shareId)) {
      return res.status(400).json({ success: false, message: 'Invalid prescription share.' });
    }
    const organization = req.user.pharmacyOrganization;
    if (!organization || req.user.pharmacyMembershipStatus !== 'approved') {
      return res.status(403).json({ success: false, message: 'An approved pharmacy organization membership is required.' });
    }
    const share = await PrescriptionShare.findOneAndUpdate({
      _id: req.params.shareId,
      channel: 'directory',
      pharmacyOrganization: organization,
      ...activeShareFilter(),
      $or: [{ accessedBy: null }, { accessedBy: req.user._id }],
    }, {
      $set: { accessedBy: req.user._id },
    }, {
      new: true,
    });
    if (!share) {
      return res.status(404).json({ success: false, message: 'This request is expired, revoked, or already being handled by another pharmacist.' });
    }
    return respondWithSharedPrescription(req, res, share);
  } catch (error) {
    return next(error);
  }
};

export const createDispenseRecord = async (req, res, next) => {
  try {
    const { shareId } = req.params;
    if (!isValidId(shareId)) {
      return res.status(400).json({ success: false, message: 'Invalid prescription share.' });
    }

    const share = await PrescriptionShare.findOne({
      _id: shareId,
      accessedBy: req.user._id,
      ...activeShareFilter(),
    });
    if (!share) {
      return res.status(404).json({ success: false, message: 'This prescription share is no longer active.' });
    }

    const prescription = await MedicalNote.findById(share.prescription)
      .select('title prescriptionItems doctor createdAt updatedAt noteType deletedAt');
    if (!isCurrentPrescription(share, prescription)) {
      return res.status(410).json({ success: false, message: 'This prescription has changed or is no longer available.' });
    }
    const patient = await User.findById(share.patient).select('role isActive');
    if (!patient || patient.role !== 'patient' || !patient.isActive) {
      return res.status(410).json({ success: false, message: 'This patient account is no longer available.' });
    }

    const submittedItems = req.body?.items;
    if (!Array.isArray(submittedItems) || submittedItems.length !== prescription.prescriptionItems.length) {
      return res.status(400).json({ success: false, message: 'Provide a dispensing status for every prescribed medicine.' });
    }

    const validStatuses = new Set(['dispensed', 'partially_dispensed', 'unavailable']);
    const items = [];
    for (let index = 0; index < prescription.prescriptionItems.length; index += 1) {
      const submitted = submittedItems[index];
      if (!submitted || typeof submitted.status !== 'string' || !validStatuses.has(submitted.status)) {
        return res.status(400).json({ success: false, message: 'Each medicine must have a valid dispensing status.' });
      }
      if (submitted.quantityDispensed !== undefined && typeof submitted.quantityDispensed !== 'string') {
        return res.status(400).json({ success: false, message: 'Dispensed quantities must be text.' });
      }
      const quantityDispensed = String(submitted.quantityDispensed || '').trim();
      if (quantityDispensed.length > 100 ||
          (submitted.status === 'unavailable' && quantityDispensed) ||
          (submitted.status !== 'unavailable' && !quantityDispensed)) {
        return res.status(400).json({ success: false, message: 'Enter the quantity dispensed for available medicines; unavailable medicines must not include a quantity.' });
      }
      items.push({
        medicineName: prescription.prescriptionItems[index].medicineName,
        status: submitted.status,
        quantityDispensed,
      });
    }

    if (req.body.notes !== undefined && typeof req.body.notes !== 'string') {
      return res.status(400).json({ success: false, message: 'Pharmacy notes must be text.' });
    }
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
    // Record the pharmacist's verified pharmacy organization, not a hospital affiliation (pharmacists have none).
    const pharmacyOrganizationId = req.user.pharmacyOrganization?._id || req.user.pharmacyOrganization;
    const organization = pharmacyOrganizationId
      ? await PharmacyOrganization.findById(pharmacyOrganizationId).select('name').lean()
      : null;
    const pharmacyName = String(organization?.name || '').trim();
    if (notes.length > 1000 || pharmacyName.length > 150) {
      return res.status(400).json({ success: false, message: 'Pharmacy notes or facility name exceed the allowed length.' });
    }
    const record = await PrescriptionDispenseRecord.create({
      patient: share.patient,
      prescription: prescription._id,
      share: share._id,
      pharmacist: req.user._id,
      pharmacyName,
      items,
      notes,
    });

    await createAuditLog({
      userId: share.patient,
      performedBy: req.user._id,
      action: 'PRESCRIPTION_DISPENSE_RECORDED',
      details: `${req.user.name} recorded pharmacy dispensing activity for "${prescription.title}".`,
      resourceId: record._id,
      resourceType: 'PrescriptionDispenseRecord',
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'Dispensing record created. The prescription itself was not changed.',
      record,
    });
  } catch (error) {
    return next(error);
  }
};

export const listMyDispenseRecords = async (req, res, next) => {
  try {
    const records = await PrescriptionDispenseRecord.find({ patient: req.user._id })
      .sort({ createdAt: -1 })
      .populate('prescription', 'title')
      .populate('pharmacist', 'name medicalStaffDetails.hospitalAffiliation')
      .lean();
    return res.status(200).json({
      success: true,
      records: records.map((record) => ({
        id: record._id,
        prescriptionTitle: record.prescription?.title || 'Unavailable prescription',
        pharmacistName: record.pharmacist?.name || 'Pharmacist',
        pharmacyName: record.pharmacyName || record.pharmacist?.medicalStaffDetails?.hospitalAffiliation || '',
        items: record.items,
        notes: record.notes,
        createdAt: record.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
};
