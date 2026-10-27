import { Router } from 'express';
import {
  getDoctorQueue,
  callPatient,
  completeConsultation,
  holdConsultation,
} from '../controllers/consultationController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate, authorize('DOCTOR'));

router.get('/queue', getDoctorQueue);
router.post('/call-patient', callPatient);
router.post('/complete', completeConsultation);
router.post('/hold', holdConsultation);

export default router;
