import { Router } from 'express';
import {
  getDoctorQueue,
  callPatient,
  updateNotesAndVitals,
  completeWithPrescription,
} from '../controllers/consultationController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate, authorize('DOCTOR'));

router.get('/queue', getDoctorQueue);
router.post('/call-patient', callPatient);
router.put('/notes', updateNotesAndVitals);
router.post('/complete-prescription', completeWithPrescription);

export default router;
