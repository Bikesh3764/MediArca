import { Router } from 'express';
import {
  getStats,
  getDoctorsList,
  verifyDoctor,
  getClinicsList,
  verifyClinic,
  getAllAppointments,
  getContactMessages,
  markContactMessageRead,
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
router.get('/contact-messages', getContactMessages);
router.patch('/contact-messages/:id/read', markContactMessageRead);

export default router;
