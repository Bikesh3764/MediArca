import { Router } from 'express';
import {
  getQueuePreview,
  bookAppointment,
  getPatientAppointments,
  cancelAppointment,
  getAppointmentById,
} from '../controllers/appointmentController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Public / Authenticated preview for doctor queue before booking
router.get('/queue-preview', getQueuePreview);

// Protected patient booking & appointment retrieval
router.post('/book', authenticate, bookAppointment);
router.get('/patient', authenticate, getPatientAppointments);
router.get('/:id', authenticate, getAppointmentById);
router.patch('/:id/cancel', authenticate, cancelAppointment);

export default router;
