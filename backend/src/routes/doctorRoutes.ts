import { Router } from 'express';
import { getDoctors, getDoctorById, updateSchedule } from '../controllers/doctorController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.get('/', getDoctors);
router.get('/:id', getDoctorById);
router.put('/schedule', authenticate, authorize('DOCTOR'), updateSchedule);

export default router;
