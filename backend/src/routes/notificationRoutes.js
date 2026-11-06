import express from 'express';
import AuditLog from '../models/AuditLog.js';
import NotificationRead from '../models/NotificationRead.js';
import { protect, authorize, resolvePatientContext } from '../middleware/authMiddleware.js';
const router = express.Router();
const destinations = {
  APPOINTMENT_BOOKED: '/appointments', APPOINTMENT_REVIEWED: '/appointments', APPOINTMENT_CANCELLED: '/appointments',
  CLAIM_SUBMITTED: '/claims', CLAIM_REVIEWED: '/claims',
  ACCESS_REQUESTED: '/access-requests', ACCESS_REQUEST_DECIDED: '/access-requests', ACCESS_REVOKED: '/access-requests',
  CLINICAL_NOTE_ADDED: '/prescriptions', CLINICAL_NOTE_UPDATED: '/prescriptions',
};
router.use(protect, authorize('patient'), resolvePatientContext);
router.get('/', async (req, res, next) => {
  try {
    const entries = await AuditLog.find({ user: req.effectivePatientId, action: { $in: Object.keys(destinations) } })
      .select('_id action details timestamp').sort({ timestamp: -1, _id: -1 }).limit(50).lean();
    const receipts = await NotificationRead.find({ viewer: req.user._id, notification: { $in: entries.map(entry => entry._id) } }).select('notification').lean();
    const read = new Set(receipts.map(entry => String(entry.notification)));
    res.json({ success: true, notifications: entries.map(entry => ({ id: entry._id, message: entry.details, at: entry.timestamp, href: destinations[entry.action], read: read.has(String(entry._id)) })) });
  } catch (error) { next(error); }
});
router.put('/:id/read', async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid notification.' });
    const entry = await AuditLog.findOne({ _id: req.params.id, user: req.effectivePatientId, action: { $in: Object.keys(destinations) } }).select('_id');
    if (!entry) return res.status(404).json({ message: 'Notification not found.' });
    try {
      await NotificationRead.updateOne({ viewer: req.user._id, notification: entry._id }, { $setOnInsert: { viewer: req.user._id, notification: entry._id } }, { upsert: true });
    } catch (error) { if (error.code !== 11000) throw error; }
    res.json({ success: true });
  } catch (error) { next(error); }
});
export default router;
