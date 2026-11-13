import Appointment from '../models/Appointment.js';
import HealthProfile from '../models/HealthProfile.js';
import NursingEntry from '../models/NursingEntry.js';
import { createAuditLog } from '../services/auditService.js';

const getActiveNursingAppointment = async (appointmentId, nurseId) => Appointment.findOne({
  _id: appointmentId,
  assignedNurse: nurseId,
  nursingAccessConsent: true,
  nursingAccessRevokedAt: null,
  status: 'confirmed',
  nursingAccessOpensAt: { $lte: new Date() },
  nursingAccessClosesAt: { $gt: new Date() },
});

export const getMyNursingAppointments = async (req, res, next) => {
  try {
    const now = new Date();
    const appointments = await Appointment.find({
      assignedNurse: req.user._id,
      nursingAccessConsent: true,
      nursingAccessRevokedAt: null,
      status: 'confirmed',
      nursingAccessClosesAt: { $gt: new Date() },
    }).select('patient doctor hospitalName appointmentDate time durationMinutes status startsAt endsAt nursingAccessOpensAt nursingAccessClosesAt nursingAccessRevokedAt')
      .populate('doctor', 'name')
      .sort({ startsAt: 1 }).limit(100);
    const appointmentSummaries = [];
    for (const appointment of appointments) {
      const summary = appointment.toObject();
      if (appointment.nursingAccessOpensAt <= now && appointment.nursingAccessClosesAt > now) {
        await appointment.populate('patient', 'name');
        summary.patient = appointment.patient;
      } else {
        delete summary.patient;
      }
      appointmentSummaries.push(summary);
    }
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, appointments: appointmentSummaries });
  } catch (error) { return next(error); }
};

export const getAppointmentNursingEntries = async (req, res, next) => {
  try {
    const appointment = await getActiveNursingAppointment(req.params.appointmentId, req.user._id);
    if (!appointment) return res.status(403).json({ success: false, message: 'Appointment access is unavailable. It opens 30 minutes before the confirmed appointment and closes 30 minutes after it ends.' });
    const [patient, profile, entries] = await Promise.all([
      appointment.populate('patient', 'name mediVaultId'),
      HealthProfile.findOne({ user: appointment.patient }).select('allergies medicalConditions medications emergencyContact'),
      NursingEntry.find({ appointment: appointment._id, patient: appointment.patient }).sort({ createdAt: -1 }).limit(100)
        .populate('nurse', 'name mediVaultId'),
    ]);
    await createAuditLog({ userId: appointment.patient._id, performedBy: req.user._id, action: 'RECORD_VIEW', details: 'Appointment-scoped nursing summary and entries viewed', resourceId: appointment._id, resourceType: 'Appointment', req });
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, appointment: patient, profile, entries });
  } catch (error) { return next(error); }
};

export const addAppointmentNursingEntry = async (req, res, next) => {
  try {
    const { entryType, note = '', vitals = {} } = req.body || {};
    if (!['observation', 'nursing_note'].includes(entryType)) return res.status(400).json({ success: false, message: 'Choose an observation or nursing note.' });
    if (typeof note !== 'string' || note.length > 4000) return res.status(400).json({ success: false, message: 'Notes must be 4,000 characters or fewer.' });
    if (entryType === 'nursing_note' && !note.trim()) return res.status(400).json({ success: false, message: 'A nursing note is required.' });
    const appointment = await getActiveNursingAppointment(req.params.appointmentId, req.user._id);
    if (!appointment) return res.status(403).json({ success: false, message: 'Appointment access is unavailable. It opens 30 minutes before the confirmed appointment and closes 30 minutes after it ends.' });
    const allowedVitals = ['temperatureC', 'pulseBpm', 'respiratoryRatePerMin', 'systolicMmHg', 'diastolicMmHg', 'oxygenSaturationPercent'];
    const limits = { temperatureC: [25, 45], pulseBpm: [20, 300], respiratoryRatePerMin: [1, 100], systolicMmHg: [40, 300], diastolicMmHg: [20, 200], oxygenSaturationPercent: [0, 100] };
    const cleanedVitals = {};
    for (const key of allowedVitals) {
      const value = vitals[key];
      if (value === '' || value === null || value === undefined) continue;
      const number = Number(value);
      if (!Number.isFinite(number) || number < limits[key][0] || number > limits[key][1]) return res.status(400).json({ success: false, message: `Enter ${key} within the accepted range (${limits[key][0]}–${limits[key][1]}).` });
      cleanedVitals[key] = number;
    }
    if (entryType === 'observation' && !Object.keys(cleanedVitals).length && !note.trim()) return res.status(400).json({ success: false, message: 'Add at least one measurement or an observation note.' });
    const entry = await NursingEntry.create({ patient: appointment.patient, nurse: req.user._id, appointment: appointment._id, entryType, note: note.trim(), vitals: cleanedVitals });
    await createAuditLog({ userId: appointment.patient, performedBy: req.user._id, action: 'NURSING_ENTRY_ADDED', details: `Appointment nursing ${entryType} added`, resourceId: entry._id, resourceType: 'NursingEntry', req });
    return res.status(201).json({ success: true, entry });
  } catch (error) { return next(error); }
};
