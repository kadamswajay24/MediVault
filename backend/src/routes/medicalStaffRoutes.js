import express from 'express';
import {
  addClinicalNote,
  getPatientNotes,
  getPatientClinicalOverview,
  getDoctorConsultations,
} from '../controllers/medicalStaffController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// Clinical actions
router.post('/notes', authorize('medical_staff', 'admin'), addClinicalNote);
router.get('/my-consultations', authorize('medical_staff', 'admin'), getDoctorConsultations);
router.get(
  '/patients/:patientId/overview',
  authorize('medical_staff', 'admin'),
  getPatientClinicalOverview
);
router.get('/patients/:patientId/notes', getPatientNotes);

export default router;
