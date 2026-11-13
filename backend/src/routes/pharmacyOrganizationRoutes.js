import express from 'express';
import {
  decidePharmacistMembership,
  createFranchiseBranch,
  getOrganizationApplication,
  getManagedOrganization,
  resubmitFranchiseBranchCredential,
  resubmitOrganizationCredential,
  updateManagedOrganization,
  updateManagedPharmacistStatus,
} from '../controllers/pharmacyOrganizationController.js';
import { protect, protectIdentity, authorize } from '../middleware/authMiddleware.js';
import { upload, validateFileContent } from '../middleware/uploadMiddleware.js';

const router = express.Router();
router.get('/application', protectIdentity, authorize('pharmacy_manager', 'pharmacy_chain_admin'), getOrganizationApplication);
router.post('/application/credentials', protectIdentity, authorize('pharmacy_manager', 'pharmacy_chain_admin'), upload.single('credentialDocument'), validateFileContent, resubmitOrganizationCredential);
router.use(protect, authorize('pharmacy_manager', 'pharmacy_chain_admin'));

router.get('/mine', getManagedOrganization);
router.put('/mine', updateManagedOrganization);
router.post('/branches', upload.single('credentialDocument'), validateFileContent, createFranchiseBranch);
router.post('/branches/:branchId/credentials', upload.single('credentialDocument'), validateFileContent, resubmitFranchiseBranchCredential);
router.put('/pharmacists/:userId/decision', decidePharmacistMembership);
router.put('/pharmacists/:userId/status', updateManagedPharmacistStatus);

export default router;
