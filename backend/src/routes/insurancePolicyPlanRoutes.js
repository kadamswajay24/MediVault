import express from 'express';
import {
  chatWithInsurancePlanAssistant,
  createCompanyPolicyPlan,
  getCompanyPolicyPlans,
  updateCompanyPolicyPlan,
} from '../controllers/adminPolicyPlanController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(authorize('insurer_admin'));

router.get('/policy-plans', getCompanyPolicyPlans);
router.post('/policy-plans', createCompanyPolicyPlan);
router.put('/policy-plans/:planId', updateCompanyPolicyPlan);
router.post('/plan-assistant', chatWithInsurancePlanAssistant);

export default router;
