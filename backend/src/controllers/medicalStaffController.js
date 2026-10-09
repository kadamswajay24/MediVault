import MedicalNote, { NOTE_TYPES } from '../models/MedicalNote.js';
import User from '../models/User.js';
import HealthProfile from '../models/HealthProfile.js';
import MedicalRecord from '../models/MedicalRecord.js';
import { createAuditLog } from '../services/auditService.js';

// @desc    Add clinical consultation note or digital prescription
// @route   POST /api/medical-staff/notes
// @access  Private (Medical Staff or Admin)
export const addClinicalNote = async (req, res, next) => {
  try {
    const {
      patientId,
      noteType = 'Consultation',
      title,
      diagnosis,
      prescriptionItems = [],
      clinicalNotes,
      followUpDate,
      linkedRecords = [],
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required.',
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Clinical note title is required.',
      });
    }

    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient account not found.',
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

// @desc    Get clinical notes for a patient
// @route   GET /api/medical-staff/patients/:patientId/notes
// @access  Private
export const getPatientNotes = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    const notes = await MedicalNote.find({ patient: patientId })
      .populate('doctor', 'name email medicalStaffDetails')
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
    const { patientId } = req.params;

    const patient = await User.findById(patientId).select('name email phone');
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.',
      });
    }

    const [profile, records, notes] = await Promise.all([
      HealthProfile.findOne({ user: patientId }),
      MedicalRecord.find({ user: patientId })
        .sort({ recordDate: -1 })
        .select('title category recordDate fileName fileType fileSize'),
      MedicalNote.find({ patient: patientId })
        .populate('doctor', 'name medicalStaffDetails')
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

// @desc    Get all consultations authored by this medical staff member
// @route   GET /api/medical-staff/my-consultations
// @access  Private (Medical Staff)
export const getDoctorConsultations = async (req, res, next) => {
  try {
    const notes = await MedicalNote.find({ doctor: req.user._id })
      .populate('patient', 'name email phone')
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
