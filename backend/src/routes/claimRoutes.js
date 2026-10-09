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

router.post('/', resolvePatientContext, submitClaim);
router.get('/', resolvePatientContext, getClaims);
router.get('/:id', resolvePatientContext, getClaimById);
router.put('/:id/review', authorize('insurance_agent', 'admin'), reviewClaim);
router.put('/:id/supplement', authorize('insurance_agent', 'admin'), supplementClaim);
router.get(
  '/:claimId/records/:recordId/download',
  authorize('insurance_agent', 'admin'),
  downloadClaimRecord
);

export default router;
