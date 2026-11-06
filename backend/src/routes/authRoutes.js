import express from 'express';
import { registerUser, loginUser, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

import { loginRateLimit, registerRateLimit } from '../middleware/authRateLimit.js';

const router = express.Router();

router.post('/register', registerRateLimit, registerUser);
router.post('/login', loginRateLimit, loginUser);
router.get('/me', protect, getMe);

export default router;
