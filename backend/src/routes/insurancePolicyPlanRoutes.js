import express from 'express';
import {
  chatWithInsurancePlanAssistant,
  createInsuranceAgentPolicyPlan,
  getInsuranceAgentPolicyPlans,
  updateInsuranceAgentPolicyPlan,
} from '../controllers/adminPolicyPlanController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(authorize('insurance_agent'));

router.get('/policy-plans', getInsuranceAgentPolicyPlans);
router.post('/policy-plans', createInsuranceAgentPolicyPlan);
router.put('/policy-plans/:planId', updateInsuranceAgentPolicyPlan);
router.post('/plan-assistant', chatWithInsurancePlanAssistant);

export default router;
