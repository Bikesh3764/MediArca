import { Router } from 'express';
import {
  getDoctorQueue,
  callPatient,
  updateNotesAndVitals,
  completeConsultation,
  completeWithPrescription,
  holdConsultation,
} from '../controllers/consultationController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate, authorize('DOCTOR'));

router.get('/queue', getDoctorQueue);
router.post('/call-patient', callPatient);
router.put('/notes', updateNotesAndVitals);
router.post('/complete', completeConsultation);
router.post('/complete-prescription', completeWithPrescription);
router.post('/hold', holdConsultation);

export default router;
