import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  listHospitals,
  myHospitals,
  hospitalWorkspace,
  hospitalStaffApplications,
  reviewHospitalStaffCredential,
  approveHospitalStaff,
  downloadHospitalStaffCredential,
} from '../controllers/hospitalController.js';
const router=express.Router();
router.get('/',listHospitals);
router.get('/mine',protect,authorize('hospital_admin'),myHospitals);
router.get('/applications',protect,authorize('hospital_admin'),hospitalStaffApplications);
router.get('/applications/:userId/credential-document',protect,authorize('hospital_admin'),downloadHospitalStaffCredential);
router.put('/applications/:userId/credential-review',protect,authorize('hospital_admin'),reviewHospitalStaffCredential);
router.put('/applications/:userId/approve',protect,authorize('hospital_admin'),approveHospitalStaff);
router.get('/:hospitalId/workspace',protect,authorize('hospital_admin'),hospitalWorkspace);
export default router;
