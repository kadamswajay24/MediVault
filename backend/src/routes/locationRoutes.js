import express from 'express';
import { lookupIndianPincode } from '../controllers/locationController.js';
import { createAuthRateLimit } from '../middleware/authRateLimit.js';

const router = express.Router();
router.get('/pincode/:pincode', createAuthRateLimit({ action: 'pincode_lookup', windowMs: 60 * 1000, ipLimit: 60, unavailableMessage: 'Postal lookup is temporarily unavailable.' }), lookupIndianPincode);

export default router;
