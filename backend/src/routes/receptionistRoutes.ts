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
  rescheduleAppointment,
} from '../controllers/receptionistController';
import { updateCabinStatus } from '../controllers/doctorController';
import { checkInAppointmentDirect } from '../controllers/appointmentController';
import { authenticate, authorize, requireActiveReceptionist } from '../middleware/authMiddleware';

const router = Router();

// Public route: Receptionist application to join a verified clinic
router.post('/apply', applyReceptionist);

// Authenticated receptionist account management (FIX-008)
// Must NOT be blocked by requireActiveReceptionist: receptionists must be able to change
// their temporary/initial password even if their affiliated clinic is pending admin verification.
router.put('/change-password', authenticate, authorize('RECEPTIONIST'), changeReceptionistPassword);

// Authenticated & Active receptionist operations
router.use(authenticate, authorize('RECEPTIONIST'), requireActiveReceptionist);

router.get('/my-receptionist', getMyReceptionist);
router.post('/doctors', addDoctorToReceptionist);
router.delete('/doctors/:doctorId', removeDoctorFromReceptionist);
router.get('/doctors/:doctorId/queue', getDoctorQueue);
router.put('/doctor-status', updateCabinStatus);
router.get('/pending-appointments', getPendingAppointments);
router.post('/appointments/:appointmentId/approve', approveAppointment);
router.post('/appointments/:appointmentId/reject', rejectAppointment);
router.post('/appointments/:appointmentId/reschedule', rescheduleAppointment);
router.post('/book-walkin', bookWalkin);
router.patch('/appointments/:appointmentId/status', updateAppointmentStatus);
router.patch('/appointments/:appointmentId/check-in', checkInAppointmentDirect);

export default router;
