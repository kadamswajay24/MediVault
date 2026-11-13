import express from 'express';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { registerRateLimit } from '../middleware/authRateLimit.js';
import { upload, validateFileContent } from '../middleware/uploadMiddleware.js';
import {
  listInsuranceCompanies,
  applyInsuranceCompany,
  getMyInsuranceCompany,
  listCompanyAgents,
  downloadCompanyAgentCredential,
  reviewCompanyAgentCredential,
  approveCompanyAgent,
  listCompanyHospitals,
  createCompanyAgent,
  updateCompanyAgentHospitals,
} from '../controllers/insuranceCompanyController.js';

const router = express.Router();
router.get('/', listInsuranceCompanies);
router.post('/applications', registerRateLimit, upload.single('credentialDocument'), validateFileContent, applyInsuranceCompany);
router.use(protect, authorize('insurer_admin'));
router.get('/mine', getMyInsuranceCompany);
router.get('/hospitals', listCompanyHospitals);
router.get('/agents', listCompanyAgents);
router.post('/agents', createCompanyAgent);
router.get('/agents/:userId/credential-document', downloadCompanyAgentCredential);
router.put('/agents/:userId/credential-review', reviewCompanyAgentCredential);
router.put('/agents/:userId/hospitals', updateCompanyAgentHospitals);
router.put('/agents/:userId/approve', approveCompanyAgent);
export default router;
