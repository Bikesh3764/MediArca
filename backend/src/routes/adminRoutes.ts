import { Router } from 'express';
import {
  getStats,
  getDoctorsList,
  verifyDoctor,
  getClinicsList,
  verifyClinic,
  getAllAppointments,
} from '../controllers/adminController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/stats', getStats);
router.get('/doctors', getDoctorsList);
router.post('/verify-doctor', verifyDoctor);
router.get('/clinics', getClinicsList);
router.post('/verify-clinic', verifyClinic);
router.get('/appointments', getAllAppointments);

export default router;
