import { Router } from 'express';
import {
  getMyClinic,
  addDoctorToClinic,
  removeDoctorFromClinic,
  getPublicClinics,
} from '../controllers/clinicController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Public route to view clinic list
router.get('/public', getPublicClinics);

// Clinic authenticated operations
router.use(authenticate);
router.get('/my-clinic', getMyClinic);
router.post('/doctors', addDoctorToClinic);
router.delete('/doctors/:doctorId', removeDoctorFromClinic);

export default router;
