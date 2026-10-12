import express from 'express';
import {
  createAppointment,
  decideAppointment,
  getDoctorAvailability,
  getHospitalsAndDoctors,
  getMyAppointments,
  getMyPendingAppointments,
  getMySchedule,
  updateMySchedule,
} from '../controllers/appointmentController.js';
import { authorize, protect, resolvePatientContext } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/hospitals', authorize('patient'), getHospitalsAndDoctors);
router.get('/availability', authorize('patient'), getDoctorAvailability);
router.get('/mine', authorize('patient'), resolvePatientContext, getMyAppointments);
router.post('/', authorize('patient'), resolvePatientContext, createAppointment);
router.get('/mine/schedule', authorize('medical_staff'), getMySchedule);
router.put('/mine/schedule', authorize('medical_staff'), updateMySchedule);
router.get('/mine/requests', authorize('medical_staff'), getMyPendingAppointments);
router.put('/:id/decision', authorize('medical_staff'), decideAppointment);

export default router;
