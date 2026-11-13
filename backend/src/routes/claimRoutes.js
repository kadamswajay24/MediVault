import express from 'express';
import {
  submitClaim,
  getClaims,
  getClaimById,
  reviewClaim,
  supplementClaim,
  downloadClaimRecord,
} from '../controllers/claimController.js';
import {
  protect,
  authorize,
  resolvePatientContext,
} from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('patient'), resolvePatientContext, submitClaim);
router.get('/', authorize('patient', 'insurance_agent', 'insurer_admin'), resolvePatientContext, getClaims);
router.get('/:id', authorize('patient', 'insurance_agent', 'insurer_admin'), resolvePatientContext, getClaimById);
router.put('/:id/review', authorize('insurance_agent', 'insurer_admin'), reviewClaim);
router.put('/:id/supplement', authorize('insurance_agent', 'insurer_admin'), supplementClaim);
router.get(
  '/:claimId/records/:recordId/download',
  authorize('insurance_agent', 'insurer_admin'),
  downloadClaimRecord
);

export default router;
