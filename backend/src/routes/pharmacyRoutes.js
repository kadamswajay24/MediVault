import express from 'express';
import {
  createDispenseRecord,
  createPrescriptionShare,
  listMyDispenseRecords,
  listPrescriptionShares,
  lookupSharedPrescription,
  listOrganizationPrescriptionShares,
  openOrganizationPrescriptionShare,
  revokePrescriptionShare,
} from '../controllers/pharmacyController.js';
import { getPharmacyDirectory } from '../controllers/pharmacyOrganizationController.js';
import { authorize, authorizeProfessionalTypes, protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.get('/organizations', getPharmacyDirectory);
router.use(protect);

router.post('/prescription-shares', authorize('patient'), createPrescriptionShare);
router.get('/prescription-shares', authorize('patient'), listPrescriptionShares);
router.put('/prescription-shares/:shareId/revoke', authorize('patient'), revokePrescriptionShare);
router.get('/dispenses/mine', authorize('patient'), listMyDispenseRecords);

router.get('/pharmacist/organization-shares', authorize('medical_staff'), authorizeProfessionalTypes('pharmacist'), listOrganizationPrescriptionShares);
router.post('/pharmacist/organization-shares/:shareId/open', authorize('medical_staff'), authorizeProfessionalTypes('pharmacist'), openOrganizationPrescriptionShare);
router.post('/pharmacist/prescriptions/lookup', authorize('medical_staff'), authorizeProfessionalTypes('pharmacist'), lookupSharedPrescription);
router.post('/pharmacist/shares/:shareId/dispenses', authorize('medical_staff'), authorizeProfessionalTypes('pharmacist'), createDispenseRecord);

export default router;
