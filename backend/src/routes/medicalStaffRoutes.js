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
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// Clinical actions
router.post('/notes', authorize('medical_staff'), addClinicalNote);
router.put('/notes/:noteId', authorize('medical_staff'), updateClinicalNote);
router.post('/notes/:noteId/deletion-request', authorize('medical_staff'), requestClinicalNoteDeletion);
router.put('/notes/:noteId/deletion-decision', authorize('patient'), decideClinicalNoteDeletion);
router.get('/my-consultations', authorize('medical_staff'), getDoctorConsultations);
router.post('/medicine-catalog/search', authorize('medical_staff'), searchMedicineCatalog);
router.get('/patients/search', authorize('medical_staff'), searchPatientsForClinicalAccess);
router.get(
  '/patients/:patientId/ai-summary',
  authorize('medical_staff'),
  getPatientAiSummary
);
router.post(
  '/patients/:patientId/ai-summary/feedback',
  authorize('medical_staff'),
  submitPatientAiSummaryFeedback
);
router.get(
  '/patients/:patientId/overview',
  authorize('medical_staff'),
  getPatientClinicalOverview
);
router.get('/patients/:patientId/notes', getPatientNotes);

export default router;
