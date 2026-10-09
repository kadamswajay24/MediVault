import express from 'express';
import { getProfile, updateProfile } from '../controllers/profileController.js';
import { protect, resolvePatientContext } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All profile routes are private
router.use(resolvePatientContext);

router.get('/', getProfile);
router.put('/', updateProfile);

export default router;
