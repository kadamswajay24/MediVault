import { withAiUsage } from '../services/aiUsageService.js';
import MedicalNote, { NOTE_TYPES } from '../models/MedicalNote.js';
import User from '../models/User.js';
import HealthProfile from '../models/HealthProfile.js';
import MedicalRecord from '../models/MedicalRecord.js';
import ClinicalAccessRequest from '../models/ClinicalAccessRequest.js';
import { createAuditLog } from '../services/auditService.js';
import {
  generateLocalSummary,
  LocalAiSummaryError,
  searchMedicineCatalogLocally,
} from '../services/localAiSummaryService.js';

const getDuplicatePrescriptionItem = (items = []) => {
  const normalize = (value) => String(value || '')
    .toLowerCase()
    .replace(/\b(tablets?|tabs?)\b/g, 'tablet')
    .replace(/\bcapsules?\b/g, 'capsule')
    .replace(/\s+/g, ' ')
    .trim();
  const seen = new Set();

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const key = [item.medicineName, item.dosage, item.frequency, item.duration]
      .map(normalize)
      .join('|');
    if (seen.has(key)) return item.medicineName || 'medicine';
    seen.add(key);
  }
  return null;
};

const requireActiveClinicalAccess = async (staffId, patientId) => {
  const grant = await ClinicalAccessRequest.findOne({
    patient: patientId,
    medicalStaff: staffId,
    status: 'approved',
    expiresAt: { $gt: new Date() },
  });
  return grant;
};

export const searchMedicineCatalog = async (req, res, next) => {
  try {
    const { matches, model } = await withAiUsage(req.user._id, () => searchMedicineCatalogLocally(
      req.body?.query,
      req.body?.candidates
    ));
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, matches, model });
  } catch (error) {
    if (error instanceof LocalAiSummaryError) {
      res.statusCode = error.statusCode;
    }
    return next(error);
  }
};

// @desc    Add clinical consultation note or digital prescription
// @route   POST /api/medical-staff/notes
// @access  Private (Medical Staff or Admin)
export const addClinicalNote = async (req, res, next) => {
  try {
    const {
      patientMediVaultId,
      noteType = 'Consultation',
      title,
      diagnosis,
      prescriptionItems = [],
      clinicalNotes,
      followUpDate,
      linkedRecords = [],
    } = req.body;

    if (typeof patientMediVaultId !== 'string' || !/^MV-[A-F0-9]{16}$/i.test(patientMediVaultId.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid patient MediVault ID is required.',
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Clinical note title is required.',
      });
    }
    if (!Array.isArray(prescriptionItems)) {
      return res.status(400).json({ success: false, message: 'Prescription items must be a list.' });
    }
    const duplicateMedicine = getDuplicatePrescriptionItem(prescriptionItems);
    if (duplicateMedicine) {
      return res.status(400).json({
        success: false,
        message: `${duplicateMedicine} appears more than once with the same dose and schedule. Remove the duplicate or change the regimen if it is intentional.`,
      });
    }

    const patient = await User.findOne({
      mediVaultId: patientMediVaultId.trim().toUpperCase(),
      role: 'patient',
      isActive: true,
    });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient account not found.',
      });
    }

    const accessGrant = await requireActiveClinicalAccess(req.user._id, patient._id);
    if (!accessGrant) {
      return res.status(403).json({
        success: false,
        message: 'An active, patient-specific clinical access grant is required before adding a note.',
      });
    }

    const validLinkedRecords = Array.isArray(linkedRecords) && linkedRecords.length
      ? await MedicalRecord.countDocuments({
          _id: { $in: linkedRecords },
          user: patient._id,
        })
      : 0;
    if (validLinkedRecords !== (Array.isArray(linkedRecords) ? linkedRecords.length : 0)) {
      return res.status(400).json({
        success: false,
        message: 'Every linked record must belong to the selected patient.',
      });
    }

    const note = await MedicalNote.create({
      patient: patient._id,
      doctor: req.user._id,
      noteType,
      title: title.trim(),
      diagnosis: diagnosis ? diagnosis.trim() : '',
      prescriptionItems: Array.isArray(prescriptionItems) ? prescriptionItems : [],
      clinicalNotes: clinicalNotes ? clinicalNotes.trim() : '',
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      linkedRecords: Array.isArray(linkedRecords) ? linkedRecords : [],
    });

    // Audit log
    await createAuditLog({
      userId: patient._id,
      performedBy: req.user._id,
      action: 'CLINICAL_NOTE_ADDED',
      details: `Dr. ${req.user.name} added clinical note: "${note.title}" (${note.noteType})`,
      resourceId: note._id,
      resourceType: 'MedicalNote',
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'Clinical note added successfully.',
      note,
    });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/medical-staff/notes/:noteId
// @access  Private (Issuing Medical Staff, within one hour)
export const updateClinicalNote = async (req, res, next) => {
  try {
    const note = await MedicalNote.findOne({ _id: req.params.noteId, doctor: req.user._id });
    if (!note) {
      return res.status(404).json({ success: false, message: 'Prescription or clinical note not found.' });
    }
    if (note.deletedAt || note.deletionRequest?.status === 'pending') {
      return res.status(409).json({ success: false, message: 'This note is pending patient deletion approval or has been deleted.' });
    }
    if (Date.now() - note.createdAt.getTime() >= 60 * 60 * 1000) {
      return res.status(403).json({ success: false, message: 'Prescriptions can only be edited within one hour of creation.' });
    }
    if (!(await requireActiveClinicalAccess(req.user._id, note.patient))) {
      return res.status(403).json({ success: false, message: 'An active patient-specific clinical access grant is required.' });
    }

    const { noteType, title, diagnosis, prescriptionItems, clinicalNotes, followUpDate } = req.body;
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Clinical note title is required.' });
    }
    if (noteType && !NOTE_TYPES.includes(noteType)) {
      return res.status(400).json({ success: false, message: 'Invalid clinical note type.' });
    }
    if (prescriptionItems !== undefined && !Array.isArray(prescriptionItems)) {
      return res.status(400).json({ success: false, message: 'Prescription items must be a list.' });
    }
    const duplicateMedicine = getDuplicatePrescriptionItem(prescriptionItems || []);
    if (duplicateMedicine) {
      return res.status(400).json({
        success: false,
        message: `${duplicateMedicine} appears more than once with the same dose and schedule. Remove the duplicate or change the regimen if it is intentional.`,
      });
    }

    note.noteType = noteType || note.noteType;
    note.title = title.trim();
    note.diagnosis = typeof diagnosis === 'string' ? diagnosis.trim() : '';
    note.prescriptionItems = prescriptionItems || [];
    note.clinicalNotes = typeof clinicalNotes === 'string' ? clinicalNotes.trim() : '';
    note.followUpDate = followUpDate ? new Date(followUpDate) : undefined;
    await note.save();

    await createAuditLog({
      userId: note.patient,
      performedBy: req.user._id,
      action: 'CLINICAL_NOTE_UPDATED',
      details: `Dr. ${req.user.name} updated clinical note: "${note.title}"`,
      resourceId: note._id,
      resourceType: 'MedicalNote',
      req,
    });

    return res.status(200).json({ success: true, message: 'Clinical note updated.', note });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/medical-staff/notes/:noteId/deletion-request
// @access  Private (Issuing Medical Staff)
export const requestClinicalNoteDeletion = async (req, res, next) => {
  try {
    const note = await MedicalNote.findOne({ _id: req.params.noteId, doctor: req.user._id });
    if (!note) {
      return res.status(404).json({ success: false, message: 'Prescription or clinical note not found.' });
    }
    if (note.deletedAt) {
      return res.status(409).json({ success: false, message: 'This note has already been deleted with patient approval.' });
    }
    if (note.deletionRequest?.status === 'pending') {
      return res.status(409).json({ success: false, message: 'A patient deletion decision is already pending.' });
    }
    if (!(await requireActiveClinicalAccess(req.user._id, note.patient))) {
      return res.status(403).json({ success: false, message: 'An active patient-specific clinical access grant is required.' });
    }

    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 5 || reason.length > 500) {
      return res.status(400).json({ success: false, message: 'Provide a deletion reason between 5 and 500 characters.' });
    }

    note.deletionRequest = { status: 'pending', reason, requestedAt: new Date() };
    await note.save();
    await createAuditLog({
      userId: note.patient,
      performedBy: req.user._id,
      action: 'CLINICAL_NOTE_DELETION_REQUESTED',
      details: `Dr. ${req.user.name} requested patient-approved deletion of "${note.title}": ${reason}`,
      resourceId: note._id,
      resourceType: 'MedicalNote',
      req,
    });

    return res.status(200).json({ success: true, message: 'Deletion request sent to the patient.', note });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/medical-staff/notes/:noteId/deletion-decision
// @access  Private (Patient who owns the note)
export const decideClinicalNoteDeletion = async (req, res, next) => {
  try {
    const note = await MedicalNote.findById(req.params.noteId);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Prescription or clinical note not found.' });
    }
    if (note.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the patient can decide this deletion request.' });
    }
    if (note.deletionRequest?.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'There is no pending deletion request for this note.' });
    }
    const { decision } = req.body;
    if (!['approved', 'denied'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be approved or denied.' });
    }

    note.deletionRequest.status = decision;
    note.deletionRequest.reviewedAt = new Date();
    if (decision === 'approved') note.deletedAt = new Date();
    await note.save();

    await createAuditLog({
      userId: note.patient,
      performedBy: req.user._id,
      action: 'CLINICAL_NOTE_DELETION_DECIDED',
      details: `Patient ${req.user.name} ${decision} deletion of clinical note "${note.title}"`,
      resourceId: note._id,
      resourceType: 'MedicalNote',
      req,
    });

    return res.status(200).json({
      success: true,
      message: decision === 'approved' ? 'Note deleted with patient approval.' : 'Deletion request denied.',
      note,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get clinical notes for a patient
// @route   GET /api/medical-staff/patients/:patientId/notes
// @access  Private
export const getPatientNotes = async (req, res, next) => {
  try {
    const patient = await User.findOne({
      mediVaultId: String(req.params.patientId).trim().toUpperCase(),
      role: 'patient',
    }).select('_id');
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient account not found.' });
    }

    const isPatient = req.user.role === 'patient' && req.user._id.toString() === patient._id.toString();
    if (!isPatient && !(await requireActiveClinicalAccess(req.user._id, patient._id))) {
      return res.status(403).json({
        success: false,
        message: 'An active patient-specific access grant is required to view clinical notes.',
      });
    }

    const notes = await MedicalNote.find({ patient: patient._id, deletedAt: null })
      .populate('doctor', 'name email mediVaultId medicalStaffDetails')
      .populate('linkedRecords', 'title category recordDate')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: notes.length,
      notes,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get patient clinical overview for medical staff review
// @route   GET /api/medical-staff/patients/:patientId/overview
// @access  Private (Medical Staff or Admin)
export const getPatientClinicalOverview = async (req, res, next) => {
  try {
    const patient = await User.findOne({
      mediVaultId: String(req.params.patientId).trim().toUpperCase(),
      role: 'patient',
    })
      .select('_id name email phone mediVaultId');
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient account not found.',
      });
    }
    const patientId = patient._id;

    const accessGrant = await requireActiveClinicalAccess(req.user._id, patientId);
    if (!accessGrant) {
      return res.status(403).json({
        success: false,
        message: 'An active patient-specific clinical access grant is required.',
      });
    }

    const [profile, records, notes] = await Promise.all([
      HealthProfile.findOne({ user: patientId }),
      MedicalRecord.find({ user: patientId })
        .sort({ recordDate: -1 })
        .select(
          'user title category description recordDate fileName storedFileName fileType fileSize fileUrl metadata createdAt updatedAt'
        ),
      MedicalNote.find({ patient: patientId, deletedAt: null })
        .populate('doctor', 'name mediVaultId medicalStaffDetails')
        .sort({ createdAt: -1 }),
    ]);

    // Audit view
    await createAuditLog({
      userId: patientId,
      performedBy: req.user._id,
      action: 'RECORD_VIEW',
      details: `Medical Staff (${req.user.name}) reviewed clinical overview of patient ${patient.name}`,
      resourceId: patientId,
      resourceType: 'PatientOverview',
      req,
    });

    return res.status(200).json({
      success: true,
      patient,
      profile: profile || null,
      records,
      notes,
    });
  } catch (error) {
    next(error);
  }
};

export const getPatientAiSummary = async (req, res, next) => {
  try {
    const patientMediVaultId = String(req.params.patientId || '').trim().toUpperCase();
    if (!/^MV-[A-F0-9]{16}$/.test(patientMediVaultId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid patient MediVault ID is required.',
      });
    }

    const patient = await User.findOne({
      mediVaultId: patientMediVaultId,
      role: 'patient',
      isActive: true,
    }).select('_id name mediVaultId');
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient account not found.',
      });
    }

    const accessGrant = await requireActiveClinicalAccess(req.user._id, patient._id);
    if (!accessGrant) {
      return res.status(403).json({
        success: false,
        message: 'An active patient-specific clinical access grant is required.',
      });
    }

    const [profile, records, notes] = await Promise.all([
      HealthProfile.findOne({ user: patient._id }).select(
        'fullName dateOfBirth allergies medicalConditions medications'
      ),
      MedicalRecord.find({ user: patient._id })
        .sort({ recordDate: -1 })
        .limit(10)
        .select('title category description recordDate metadata'),
      MedicalNote.find({ patient: patient._id, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(8)
        .select('noteType title diagnosis prescriptionItems clinicalNotes followUpDate createdAt'),
    ]);

    const sensitiveValues = [patient.name, profile?.fullName, profile?.dateOfBirth]
      .filter((value) => typeof value === 'string' && value.trim())
      .sort((left, right) => right.length - left.length);
    const redactPatientIdentifiers = (text) => {
      let sanitized = String(text || '');
      for (const value of sensitiveValues) {
        sanitized = sanitized.replace(
          new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
          '[patient identifier]'
        );
      }
      return sanitized;
    };

    const sections = [];
    if (profile) {
      sections.push(
        `[Source: patient-reported profile; not independently verified]\n` +
        `Conditions: ${profile.medicalConditions.join(', ') || 'Not recorded'}\n` +
        `Allergies: ${profile.allergies.join(', ') || 'Not recorded'}\n` +
        `Medications: ${profile.medications.join(', ') || 'Not recorded'}`
      );
    }

    for (const record of records) {
      const identityStatus = record.metadata?.identityCheck?.status || 'unverified';
      const recordHeader =
        `[Source: ${record.category} report, ${new Date(record.recordDate).toISOString().slice(0, 10)}, ` +
        `${record.title}; identity check: ${identityStatus}]`;

      if (identityStatus !== 'matched') {
        sections.push(
          `${recordHeader} Report content is excluded because patient identity was not confirmed; review the original document.`
        );
        continue;
      }

      const reportText =
        record.metadata?.ocrExtractedText?.trim() || record.description?.trim();
      sections.push(
        reportText
          ? `${recordHeader}\n${redactPatientIdentifiers(reportText)}`
          : `${recordHeader} No readable report text is available.`
      );
    }

    for (const note of notes) {
      const medications = note.prescriptionItems
        .map((item) =>
          [item.medicineName, item.dosage, item.frequency, item.duration]
            .filter(Boolean)
            .join(' ')
        )
        .filter(Boolean);
      sections.push(
        `[Source: clinician-authored ${note.noteType} note, ${new Date(note.createdAt).toISOString().slice(0, 10)}${note.title ? `, ${note.title}` : ''}]\n` +
        `${redactPatientIdentifiers(
          [
            note.title,
            note.diagnosis ? `Recorded diagnosis: ${note.diagnosis}` : '',
            note.clinicalNotes || '',
            medications.length ? `Medicines recorded: ${medications.join('; ')}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        )}`
      );
    }

    const sourceText = sections.join('\n\n').slice(0, 12_000);
    if (!sourceText.trim()) {
      throw new LocalAiSummaryError(
        'There is not enough authorized clinical information to summarize.',
        422
      );
    }

    const { summary, model } = await withAiUsage(req.user._id, () => generateLocalSummary(
      sourceText,
      'en',
      'clinician'
    ));

    await createAuditLog({
      userId: patient._id,
      performedBy: req.user._id,
      action: 'RECORD_AI_SUMMARIZED',
      details: 'Generated an AI clinical overview from patient-authorized records.',
      resourceId: patient._id,
      resourceType: 'PatientClinicalOverview',
      req,
    });

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      summary,
      model,
      stored: false,
    });
  } catch (error) {
    if (error instanceof LocalAiSummaryError) {
      res.statusCode = error.statusCode;
    }
    return next(error);
  }
};

// @desc    Get all consultations authored by this medical staff member
// @route   GET /api/medical-staff/my-consultations
// @access  Private (Medical Staff)
export const getDoctorConsultations = async (req, res, next) => {
  try {
    const notes = await MedicalNote.find({ doctor: req.user._id })
      .populate('patient', 'name email mediVaultId phone')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: notes.length,
      notes,
    });
  } catch (error) {
    next(error);
  }
};
