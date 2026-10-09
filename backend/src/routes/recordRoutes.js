import express from 'express';
import {
  uploadRecord,
  getRecords,
  getRecordById,
  downloadRecord,
  deleteRecord,
} from '../controllers/recordController.js';
import { protect, resolvePatientContext } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect); // All record routes require authentication
router.use(resolvePatientContext); // Resolve active patient context (caregiver / self)

router.route('/')
  .get(getRecords)
  .post(upload.single('file'), uploadRecord);

router.route('/:id')
  .get(getRecordById)
  .delete(deleteRecord);

router.get('/:id/download', downloadRecord);

export default router;
