import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getAiConfig } from '../services/aiProviderService.js';

const router = express.Router();
router.get('/config', protect, (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(getAiConfig());
  } catch (error) { next(error); }
});
export default router;
