import express from 'express';
import {
  delegateAccess,
  getMyProxies,
  getMyDependents,
  revokeProxy,
} from '../controllers/proxyController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/delegate', delegateAccess);
router.get('/my-proxies', getMyProxies);
router.get('/my-dependents', getMyDependents);
router.delete('/:id', revokeProxy);

export default router;
