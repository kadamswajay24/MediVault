import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { protect, authorize, resolvePatientContext } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All dashboard routes are private
router.use(authorize('patient'));
router.use(resolvePatientContext);

router.get('/stats', getDashboardStats);

export default router;
