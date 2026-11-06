import express from 'express';
import { registerUser, loginUser, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

import { loginRateLimit, registerRateLimit } from '../middleware/authRateLimit.js';

const router = express.Router();

router.post('/register', registerRateLimit, registerUser);
// The legacy endpoint is patient-only. Professional portals must name their
// portal so the controller can verify the account role before issuing a JWT.
router.post('/login', loginRateLimit, loginUser);
router.post('/login/:portal', loginRateLimit, loginUser);
router.get('/me', protect, getMe);

export default router;
