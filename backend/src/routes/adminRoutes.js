import express from 'express';
import {
  getUsers,
  updateUserRole,
  toggleUserStatus,
  approveUser,
  getPlatformStats,
  getGlobalAuditLogs,
  reviewUserCredential,
  downloadUserCredential,
} from '../controllers/adminController.js';
import { adminHospitals, createHospital, assignHospitalAdmin, createHospitalAdmin } from '../controllers/hospitalController.js';
import {
  listInsuranceCompaniesForAdmin,
  downloadInsuranceCompanyDocument,
  reviewInsuranceCompany,
  createInsuranceCompanyAdmin,
} from '../controllers/insuranceCompanyController.js';
import { createChainAdmin } from '../controllers/chainAdminController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce admin-only access on all endpoints
router.use(protect);
router.use(authorize('admin'));

router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', toggleUserStatus);
router.put('/users/:id/approve', approveUser);
router.put('/users/:id/credential-review', reviewUserCredential);
router.get('/users/:id/credential-document', downloadUserCredential);
router.get('/stats', getPlatformStats);
router.get('/hospitals', adminHospitals);
router.post('/hospitals', createHospital);
router.put('/hospitals/:hospitalId/admins/:userId', assignHospitalAdmin);
router.post('/hospitals/:hospitalId/admins', createHospitalAdmin);
router.get('/insurance-companies', listInsuranceCompaniesForAdmin);
router.get('/insurance-companies/:companyId/document', downloadInsuranceCompanyDocument);
router.put('/insurance-companies/:companyId/review', reviewInsuranceCompany);
router.post('/insurance-companies/:companyId/admins', createInsuranceCompanyAdmin);
router.post('/chain-admins', createChainAdmin);
router.get('/audit-logs', getGlobalAuditLogs);

export default router;
