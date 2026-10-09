import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { protect, resolvePatientContext } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All dashboard routes are private
router.use(resolvePatientContext);

router.get('/stats', getDashboardStats);

export default router;
