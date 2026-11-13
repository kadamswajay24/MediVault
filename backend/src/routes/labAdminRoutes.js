import express from 'express';
import {
  downloadLabDocument,
  listLabsForAdmin,
  reviewLabOrganization,
} from '../controllers/labOrganizationController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect, authorize('admin'));
router.get('/', listLabsForAdmin);
router.get('/:organizationId/document', downloadLabDocument);
router.put('/:organizationId/review', reviewLabOrganization);

export default router;
