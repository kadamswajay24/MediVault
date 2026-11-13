import express from 'express';
import {
  createNursingTeamResource,
  deleteNursingTeamResource,
  getMyNursingOperations,
  getNursingTeam,
  getNursingTeamResources,
  updateMyNursingOperations,
} from '../controllers/nursingOperationsController.js';
import { authorize, authorizeProfessionalTypes, protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect, authorize('medical_staff'), authorizeProfessionalTypes('nurse'));
router.get('/mine', getMyNursingOperations);
router.put('/mine', updateMyNursingOperations);
router.get('/team', getNursingTeam);
router.get('/resources', getNursingTeamResources);
router.post('/resources', createNursingTeamResource);
router.delete('/resources/:id', deleteNursingTeamResource);

export default router;
