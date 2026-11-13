import express from 'express';
import MedicationReminder from '../models/MedicationReminder.js';
import MedicationAdherenceLog from '../models/MedicationAdherenceLog.js';
import { createAuditLog } from '../services/auditService.js';
import { protect, authorize, resolvePatientContext } from '../middleware/authMiddleware.js';

const router = express.Router();
// How far back a patient may log an adherence dose (IST calendar days).
const MAX_ADHERENCE_BACKDATE_DAYS = 7;
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
    // Clean up associated adherence logs for the deleted reminder
    await MedicationAdherenceLog.deleteMany({ reminder: reminder._id });
    return res.json({ success: true, message: 'Medication reminder removed.' });
  } catch (error) {
    return next(error);
  }
});

// Adherence tracking endpoints
router.get('/adherence/today', async (req, res, next) => {
  try {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const patient = req.effectivePatientId;
    const [reminders, logs] = await Promise.all([
      MedicationReminder.find({ patient }).select('_id medicationName time').sort({ time: 1 }).lean(),
      MedicationAdherenceLog.find({ patient, date: today }).lean(),
    ]);

    const logMap = new Map(logs.map(log => [String(log.reminder), log]));

    const todayItems = reminders.map(reminder => {
      const log = logMap.get(String(reminder._id));
      return {
        reminderId: reminder._id,
        medicationName: reminder.medicationName,
        time: reminder.time,
        status: log ? log.status : 'pending',
        takenAt: log?.takenAt || null,
        logId: log?._id || null,
      };
    });

    const totalScheduled = reminders.length;
    const takenCount = logs.filter(l => l.status === 'taken').length;
    const adherenceRate = totalScheduled > 0 ? Math.round((takenCount / totalScheduled) * 100) : 100;

    return res.json({
      success: true,
      date: today,
      adherenceRate,
      totalScheduled,
      takenCount,
      items: todayItems,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/adherence/log', async (req, res, next) => {
  try {
    const { reminderId, status, date } = req.body;
    if (!/^[a-f\d]{24}$/i.test(reminderId)) {
      return res.status(400).json({ success: false, message: 'Invalid reminder ID.' });
    }
    if (!['taken', 'skipped'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be taken or skipped.' });
    }

    const patient = req.effectivePatientId;
    const reminder = await MedicationReminder.findOne({ _id: reminderId, patient });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Medication reminder not found.' });
    }

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const earliestAllowed = new Date(`${today}T00:00:00Z`);
    earliestAllowed.setUTCDate(earliestAllowed.getUTCDate() - MAX_ADHERENCE_BACKDATE_DAYS);
    const earliestDate = earliestAllowed.toISOString().slice(0, 10);

    if (date !== undefined && date !== null && date !== '') {
      const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(`${date}T00:00:00Z`)
        : null;
      // Rejects impossible dates such as 2026-02-30, which Date would otherwise roll over.
      const isCalendarDate = Boolean(parsedDate) && !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === date;
      if (!isCalendarDate || date > today || date < earliestDate) {
        return res.status(400).json({
          success: false,
          message: `Adherence can only be logged for dates from ${earliestDate} to today.`,
        });
      }
    }
    const targetDate = date || today;

    const log = await MedicationAdherenceLog.findOneAndUpdate(
      { patient, reminder: reminder._id, date: targetDate },
      {
        patient,
        reminder: reminder._id,
        loggedBy: req.user._id,
        date: targetDate,
        scheduledTime: reminder.time,
        medicationName: reminder.medicationName,
        status,
        takenAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    await createAuditLog({
      userId: patient,
      performedBy: req.user._id,
      action: 'MEDICATION_ADHERENCE_LOGGED',
      details: `Marked dose of ${reminder.medicationName} as ${status}.`,
      resourceId: log._id,
      resourceType: 'MedicationAdherenceLog',
      req,
    });

    return res.json({ success: true, log });
  } catch (error) {
    return next(error);
  }
});

router.delete('/adherence/log/:reminderId', async (req, res, next) => {
  try {
    const { reminderId } = req.params;
    if (!/^[a-f\d]{24}$/i.test(reminderId)) {
      return res.status(400).json({ success: false, message: 'Invalid reminder ID.' });
    }

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const patient = req.effectivePatientId;
    await MedicationAdherenceLog.findOneAndDelete({
      patient,
      reminder: reminderId,
      date: today,
    });

    return res.json({ success: true, message: 'Log reset to pending.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
