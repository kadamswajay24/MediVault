import express from 'express';
import {
  uploadRecord,
  getRecords,
  getRecordById,
  checkRecordAccess,
  summarizeRecord,
  downloadRecord,
  deleteRecord,
} from '../controllers/recordController.js';
import { protect, resolvePatientContext } from '../middleware/authMiddleware.js';
import { upload, validateFileContent } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect); // All record routes require authentication
router.use(resolvePatientContext); // Resolve active patient context (caregiver / self)

router.route('/')
  .get(getRecords)
  .post(upload.single('file'), validateFileContent, uploadRecord);

router.route('/:id')
  .get(getRecordById)
  .delete(deleteRecord);

router.get('/:id/access', checkRecordAccess);
router.get('/:id/summary', summarizeRecord);
router.get('/:id/download', downloadRecord);

export default router;
