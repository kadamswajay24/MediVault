import express from 'express';
import MedicationReminder from '../models/MedicationReminder.js';
import { createAuditLog } from '../services/auditService.js';
import { protect, authorize, resolvePatientContext } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect, authorize('patient'), resolvePatientContext);

router.get('/', async (req, res, next) => {
  try {
    const reminders = await MedicationReminder.find({ patient: req.effectivePatientId })
      .select('_id medicationName time timezone createdAt')
      .sort({ time: 1, medicationName: 1 })
      .lean();
    return res.json({ success: true, reminders });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const medicationName = typeof req.body?.medicationName === 'string'
      ? req.body.medicationName.trim()
      : '';
    const time = typeof req.body?.time === 'string' ? req.body.time.trim() : '';

    if (medicationName.length < 2 || medicationName.length > 120) {
      return res.status(400).json({ success: false, message: 'Enter a medication name between 2 and 120 characters.' });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return res.status(400).json({ success: false, message: 'Choose a valid daily reminder time.' });
    }
    if (req.body?.confirmCurrentUse !== true) {
      return res.status(400).json({ success: false, message: 'Confirm that you currently take this medicine before setting a reminder.' });
    }

    const patient = req.effectivePatientId;
    if (await MedicationReminder.countDocuments({ patient }) >= 30) {
      return res.status(409).json({ success: false, message: 'You can have up to 30 active reminders. Remove one before adding another.' });
    }

    const medicationKey = medicationName.toLocaleLowerCase('en').replace(/\s+/g, ' ');
    const reminder = await MedicationReminder.create({
      patient,
      createdBy: req.user._id,
      medicationName,
      medicationKey,
      time,
      timezone: 'Asia/Kolkata',
      confirmedCurrentUseAt: new Date(),
    });
    await createAuditLog({
      userId: patient,
      performedBy: req.user._id,
      action: 'MEDICATION_REMINDER_SET',
      details: 'A daily medication reminder was set.',
      resourceId: reminder._id,
      resourceType: 'MedicationReminder',
      req,
    });
    return res.status(201).json({ success: true, reminder });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A reminder for this medicine at that time already exists.' });
    }
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid medication reminder.' });
    }
    const reminder = await MedicationReminder.findOneAndDelete({
      _id: req.params.id,
      patient: req.effectivePatientId,
    });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Medication reminder not found.' });
    }
    await createAuditLog({
      userId: req.effectivePatientId,
      performedBy: req.user._id,
      action: 'MEDICATION_REMINDER_REMOVED',
      details: 'A daily medication reminder was removed.',
      resourceId: reminder._id,
      resourceType: 'MedicationReminder',
      req,
    });
    return res.json({ success: true, message: 'Medication reminder removed.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
