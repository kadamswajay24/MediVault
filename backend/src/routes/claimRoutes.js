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
router.get('/', authorize('patient', 'insurance_agent'), resolvePatientContext, getClaims);
router.get('/:id', authorize('patient', 'insurance_agent'), resolvePatientContext, getClaimById);
router.put('/:id/review', authorize('insurance_agent'), reviewClaim);
router.put('/:id/supplement', authorize('insurance_agent'), supplementClaim);
router.get(
  '/:claimId/records/:recordId/download',
  authorize('insurance_agent'),
  downloadClaimRecord
);

export default router;
