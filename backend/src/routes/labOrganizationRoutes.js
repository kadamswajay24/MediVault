import express from 'express';
import {
  decideLabStaffMembership,
  getLabApplication,
  getLabDirectory,
  getManagedLab,
  resubmitLabCredential,
  createLabChainBranch,
} from '../controllers/labOrganizationController.js';
import { authorize, authorizeProfessionalTypes, protect, protectIdentity } from '../middleware/authMiddleware.js';
import { upload, validateFileContent } from '../middleware/uploadMiddleware.js';
import { listPatientOrders, createPatientOrder, cancelPatientOrder, revokePatientOrder, listLabOrders, submitLabResult } from '../controllers/labWorkflowController.js';

const router = express.Router();
router.get('/organizations', getLabDirectory);
router.get('/application', protectIdentity, authorize('lab_manager', 'lab_chain_admin'), getLabApplication);
router.post('/application/credentials', protectIdentity, authorize('lab_manager', 'lab_chain_admin'), upload.single('credentialDocument'), validateFileContent, resubmitLabCredential);
router.get('/orders/mine', protect, authorize('patient'), listPatientOrders);
router.post('/orders', protect, authorize('patient'), createPatientOrder);
router.put('/orders/:orderId/cancel', protect, authorize('patient'), cancelPatientOrder);
router.put('/orders/:orderId/revoke', protect, authorize('patient'), revokePatientOrder);
router.get('/staff/orders', protect, authorize('medical_staff'), authorizeProfessionalTypes('lab_technologist'), listLabOrders);
router.post('/staff/orders/:orderId/result', protect, authorize('medical_staff'), authorizeProfessionalTypes('lab_technologist'), upload.single('file'), validateFileContent, submitLabResult);
router.use(protect, authorize('lab_manager', 'lab_chain_admin'));
router.post('/branches', upload.single('credentialDocument'), validateFileContent, createLabChainBranch);
router.get('/mine', getManagedLab);
router.put('/staff/:userId/decision', decideLabStaffMembership);

export default router;
