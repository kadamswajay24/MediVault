import express from 'express';
import {
  addClinicalNote,
  updateClinicalNote,
  requestClinicalNoteDeletion,
  decideClinicalNoteDeletion,
  getPatientNotes,
  getPatientClinicalOverview,
  getPatientAiSummary,
  submitPatientAiSummaryFeedback,
  getDoctorConsultations,
  searchMedicineCatalog,
} from '../controllers/medicalStaffController.js';
import { searchPatientsForClinicalAccess } from '../controllers/clinicalAccessController.js';
import { protect, authorize, authorizeProfessionalTypes } from '../middleware/authMiddleware.js';
import { createPhysicianOrder } from '../controllers/labWorkflowController.js';

const router = express.Router();

router.use(protect);

// Clinical actions
router.post('/notes', authorize('medical_staff'), authorizeProfessionalTypes('physician'), addClinicalNote);
router.post('/lab-orders', authorize('medical_staff'), authorizeProfessionalTypes('physician'), createPhysicianOrder);
router.put('/notes/:noteId', authorize('medical_staff'), authorizeProfessionalTypes('physician'), updateClinicalNote);
router.post('/notes/:noteId/deletion-request', authorize('medical_staff'), authorizeProfessionalTypes('physician'), requestClinicalNoteDeletion);
router.put('/notes/:noteId/deletion-decision', authorize('patient'), decideClinicalNoteDeletion);
router.get('/my-consultations', authorize('medical_staff'), authorizeProfessionalTypes('physician'), getDoctorConsultations);
router.post('/medicine-catalog/search', authorize('medical_staff'), authorizeProfessionalTypes('physician'), searchMedicineCatalog);
router.get('/patients/search', authorize('medical_staff'), authorizeProfessionalTypes('physician'), searchPatientsForClinicalAccess);
router.get(
  '/patients/:patientId/ai-summary',
  authorize('medical_staff'),
  authorizeProfessionalTypes('physician'),
  getPatientAiSummary
);
router.post(
  '/patients/:patientId/ai-summary/feedback',
  authorize('medical_staff'),
  authorizeProfessionalTypes('physician'),
  submitPatientAiSummaryFeedback
);
router.get(
  '/patients/:patientId/overview',
  authorize('medical_staff'),
  authorizeProfessionalTypes('physician'),
  getPatientClinicalOverview
);
router.get(
  '/patients/:patientId/notes',
  authorize('patient', 'medical_staff'),
  (req, res, next) => req.user.role === 'patient'
    ? next()
    : authorizeProfessionalTypes('physician')(req, res, next),
  getPatientNotes
);

export default router;
