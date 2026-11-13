import express from 'express';
import {
  downloadPharmacyOrganizationDocument,
  listPharmacyOrganizationsForAdmin,
  reviewPharmacyOrganization,
} from '../controllers/pharmacyOrganizationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect, authorize('admin'));
router.get('/', listPharmacyOrganizationsForAdmin);
router.get('/:organizationId/document', downloadPharmacyOrganizationDocument);
router.put('/:organizationId/review', reviewPharmacyOrganization);

export default router;
