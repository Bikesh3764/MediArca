import { Router } from 'express';
import {
  getMyReceptionist,
  addDoctorToReceptionist,
  removeDoctorFromReceptionist,
  getDoctorQueue,
  bookWalkin,
  updateAppointmentStatus,
  changeReceptionistPassword,
  getPendingAppointments,
  approveAppointment,
  rejectAppointment,
  applyReceptionist,
} from '../controllers/receptionistController';
import { authenticate, authorize, requireActiveReceptionist } from '../middleware/authMiddleware';

const router = Router();

// Public route: Receptionist application to join a verified clinic
router.post('/apply', applyReceptionist);

// Authenticated & Active receptionist operations
router.use(authenticate, authorize('RECEPTIONIST'), requireActiveReceptionist);

router.get('/my-receptionist', getMyReceptionist);
router.post('/doctors', addDoctorToReceptionist);
router.delete('/doctors/:doctorId', removeDoctorFromReceptionist);
router.get('/doctors/:doctorId/queue', getDoctorQueue);
router.get('/pending-appointments', getPendingAppointments);
router.post('/appointments/:appointmentId/approve', approveAppointment);
router.post('/appointments/:appointmentId/reject', rejectAppointment);
router.post('/book-walkin', bookWalkin);
router.patch('/appointments/:appointmentId/status', updateAppointmentStatus);
router.put('/change-password', changeReceptionistPassword);

export default router;
