import express from 'express';
import {
  createAppointment,
  cancelAppointment,
  decideAppointment,
  getDoctorAvailability,
  getHospitalsAndDoctors,
  getMyAppointments,
  getMyPendingAppointments,
  getMyStaffAppointments,
  getMySchedule,
  updateMySchedule,
  revokeAppointmentNursingAccess,
  assignAppointmentNurse,
  lookupPatientByMediVaultId,
  staffBookAppointment,
} from '../controllers/appointmentController.js';
import { addAppointmentNursingEntry, getAppointmentNursingEntries, getMyNursingAppointments } from '../controllers/nursingController.js';
import { authorize, authorizeProfessionalTypes, protect, resolvePatientContext } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/hospitals', authorize('patient', 'medical_staff'), getHospitalsAndDoctors);
router.get('/availability', authorize('patient', 'medical_staff'), getDoctorAvailability);
router.get('/mine', authorize('patient'), resolvePatientContext, getMyAppointments);
router.put('/:id/cancel', authorize('patient'), resolvePatientContext, cancelAppointment);
router.put('/:id/nursing-access/revoke', authorize('patient'), resolvePatientContext, revokeAppointmentNursingAccess);
router.put('/:id/nursing-access', authorize('patient'), resolvePatientContext, assignAppointmentNurse);
router.post('/', authorize('patient'), resolvePatientContext, createAppointment);
router.get('/lookup-patient', authorize('medical_staff'), authorizeProfessionalTypes('nurse'), lookupPatientByMediVaultId);
router.post('/staff-book', authorize('medical_staff'), authorizeProfessionalTypes('nurse'), staffBookAppointment);
router.get('/mine/schedule', authorize('medical_staff'), authorizeProfessionalTypes('physician'), getMySchedule);
router.put('/mine/schedule', authorize('medical_staff'), authorizeProfessionalTypes('physician'), updateMySchedule);
router.get('/mine/requests', authorize('medical_staff'), authorizeProfessionalTypes('physician'), getMyPendingAppointments);
router.get('/mine/calendar', authorize('medical_staff'), authorizeProfessionalTypes('physician'), getMyStaffAppointments);
router.put('/:id/decision', authorize('medical_staff'), authorizeProfessionalTypes('physician'), decideAppointment);
router.get('/mine/nursing', authorize('medical_staff'), authorizeProfessionalTypes('nurse'), getMyNursingAppointments);
router.get('/:appointmentId/nursing-entries', authorize('medical_staff'), authorizeProfessionalTypes('nurse'), getAppointmentNursingEntries);
router.post('/:appointmentId/nursing-entries', authorize('medical_staff'), authorizeProfessionalTypes('nurse'), addAppointmentNursingEntry);

export default router;
