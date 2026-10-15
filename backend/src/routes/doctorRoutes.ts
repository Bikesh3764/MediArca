import { Router } from 'express';
import {
  getDoctors,
  getDoctorById,
  updateSchedule,
  getDoctorAffiliations,
  addDoctorClinic,
  respondToClinicAffiliation,
  removeDoctorClinic,
  addDoctorReceptionist,
  removeDoctorReceptionist,
  updateCabinStatus,
  getDoctorReviews,
  getDoctorReport,
  getDoctorScheduleConfig,
  updateDoctorWorkingDays,
  addDoctorLeave,
  cancelDoctorLeave,
} from '../controllers/doctorController';
import { updateProfile } from '../controllers/authController';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/authMiddleware';
import { publicCache } from '../middleware/cacheMiddleware';

const router = Router();

router.get('/', publicCache(60, 30), getDoctors);
router.get('/me/affiliations', authenticate, authorize('DOCTOR'), getDoctorAffiliations);
router.get('/me/report', authenticate, authorize('DOCTOR'), getDoctorReport);
router.get('/me/schedule-config', authenticate, authorize('DOCTOR'), getDoctorScheduleConfig);
router.put('/me/working-days', authenticate, authorize('DOCTOR'), updateDoctorWorkingDays);
router.post('/me/leaves', authenticate, authorize('DOCTOR'), addDoctorLeave);
router.delete('/me/leaves/:leaveId', authenticate, authorize('DOCTOR'), cancelDoctorLeave);
router.post('/me/clinics', authenticate, authorize('DOCTOR'), addDoctorClinic);
router.put('/me/affiliations/:affiliationId/respond', authenticate, authorize('DOCTOR'), respondToClinicAffiliation);
router.put('/me/clinics/:affiliationId/respond', authenticate, authorize('DOCTOR'), respondToClinicAffiliation);
router.delete('/me/clinics/:clinicId', authenticate, authorize('DOCTOR'), removeDoctorClinic);
router.post('/me/receptionists', authenticate, authorize('DOCTOR'), addDoctorReceptionist);
router.delete('/me/receptionists/:receptionistId', authenticate, authorize('DOCTOR'), removeDoctorReceptionist);

router.put('/cabin-status', authenticate, authorize('DOCTOR', 'RECEPTIONIST'), updateCabinStatus);
router.put('/profile', authenticate, authorize('DOCTOR'), updateProfile);

// Specific doctor schedule and leave endpoints accessible by DOCTOR and RECEPTIONIST
router.get('/:doctorId/schedule-config', authenticate, authorize('DOCTOR', 'RECEPTIONIST', 'CLINIC'), getDoctorScheduleConfig);
router.put('/:doctorId/working-days', authenticate, authorize('DOCTOR', 'RECEPTIONIST'), updateDoctorWorkingDays);
router.post('/:doctorId/leaves', authenticate, authorize('DOCTOR', 'RECEPTIONIST'), addDoctorLeave);
router.delete('/:doctorId/leaves/:leaveId', authenticate, authorize('DOCTOR', 'RECEPTIONIST'), cancelDoctorLeave);

router.get('/:id/reviews', publicCache(60, 30), getDoctorReviews);
router.get('/:id', optionalAuthenticate, publicCache(60, 30), getDoctorById);
router.put('/schedule', authenticate, authorize('DOCTOR'), updateSchedule);

export default router;
