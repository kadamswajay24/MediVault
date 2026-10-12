import express from 'express';
import {
  enrollInPolicy,
  getMyPolicies,
  getPolicyPlans,
  payMonthlyPremium,
} from '../controllers/policyController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/plans', authorize('patient'), getPolicyPlans);
router.get('/mine', authorize('patient'), getMyPolicies);
router.post('/plans/:planId/enroll', authorize('patient'), enrollInPolicy);
router.post('/mine/:enrollmentId/payments', authorize('patient'), payMonthlyPremium);

export default router;
