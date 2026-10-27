import { Router } from 'express';
import {
  getQueuePreview,
  bookAppointment,
  getPatientAppointments,
  cancelAppointment,
  getAppointmentById,
  checkInAppointmentWithQR,
  checkInAppointmentDirect,
  trackWalkin,
} from '../controllers/appointmentController';
import { authenticate } from '../middleware/authMiddleware';

import { rescheduleAppointment } from '../controllers/receptionistController';

const router = Router();

// Public / Authenticated preview for doctor queue before booking
router.get('/queue-preview', getQueuePreview);

// Public walk-in tracker: mobile number + 6-character code (FIX-058). POST keeps the number out of URLs.
router.post('/walkin-track', trackWalkin);

// Protected patient booking & appointment retrieval
router.post('/book', authenticate, bookAppointment);
router.get('/patient', authenticate, getPatientAppointments);
router.post('/check-in', authenticate, checkInAppointmentWithQR);
router.patch('/:id/check-in', authenticate, checkInAppointmentDirect);
router.get('/:id', authenticate, getAppointmentById);
router.patch('/:id/cancel', authenticate, cancelAppointment);
router.post('/:id/reschedule', authenticate, rescheduleAppointment);

export default router;
