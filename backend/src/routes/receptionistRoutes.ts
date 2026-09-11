import { Router } from 'express';
import {
  getMyReceptionist,
  addDoctorToReceptionist,
  removeDoctorFromReceptionist,
  getDoctorQueue,
  bookWalkin,
  updateAppointmentStatus,
} from '../controllers/receptionistController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/my-receptionist', getMyReceptionist);
router.post('/doctors', addDoctorToReceptionist);
router.delete('/doctors/:doctorId', removeDoctorFromReceptionist);
router.get('/doctors/:doctorId/queue', getDoctorQueue);
router.post('/book-walkin', bookWalkin);
router.patch('/appointments/:appointmentId/status', updateAppointmentStatus);

export default router;
