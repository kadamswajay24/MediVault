import express from 'express';
import { getAuditLogs } from '../controllers/auditController.js';
import { protect, resolvePatientContext } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(resolvePatientContext);

router.get('/', getAuditLogs);

export default router;
