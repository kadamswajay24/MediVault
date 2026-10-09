import express from 'express';
import {
  createClinicalAccessRequest,
  decideClinicalAccessRequest,
  getClinicalAccessRequests,
  revokeClinicalAccess,
} from '../controllers/clinicalAccessController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/', getClinicalAccessRequests);
router.post('/', createClinicalAccessRequest);
router.put('/:id/decision', decideClinicalAccessRequest);
router.put('/:id/revoke', revokeClinicalAccess);

export default router;
