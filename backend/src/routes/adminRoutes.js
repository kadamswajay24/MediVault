import express from 'express';
import {
  getUsers,
  updateUserRole,
  toggleUserStatus,
  approveUser,
  getPlatformStats,
  getGlobalAuditLogs,
} from '../controllers/adminController.js';
import {
  createAdminPolicyPlan,
  getAdminPolicyPlans,
  updateAdminPolicyPlan,
} from '../controllers/adminPolicyPlanController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce admin-only access on all endpoints
router.use(protect);
router.use(authorize('admin'));

router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', toggleUserStatus);
router.put('/users/:id/approve', approveUser);
router.get('/stats', getPlatformStats);
router.get('/audit-logs', getGlobalAuditLogs);
router.get('/policy-plans', getAdminPolicyPlans);
router.post('/policy-plans', createAdminPolicyPlan);
router.put('/policy-plans/:planId', updateAdminPolicyPlan);

export default router;
