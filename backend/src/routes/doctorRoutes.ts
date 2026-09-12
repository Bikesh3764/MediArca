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
} from '../controllers/doctorController';
import { updateProfile } from '../controllers/authController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.get('/', getDoctors);
router.get('/me/affiliations', authenticate, authorize('DOCTOR'), getDoctorAffiliations);
router.post('/me/clinics', authenticate, authorize('DOCTOR'), addDoctorClinic);
router.put('/me/affiliations/:affiliationId/respond', authenticate, authorize('DOCTOR'), respondToClinicAffiliation);
router.put('/me/clinics/:affiliationId/respond', authenticate, authorize('DOCTOR'), respondToClinicAffiliation);
router.delete('/me/clinics/:clinicId', authenticate, authorize('DOCTOR'), removeDoctorClinic);
router.post('/me/receptionists', authenticate, authorize('DOCTOR'), addDoctorReceptionist);
router.delete('/me/receptionists/:receptionistId', authenticate, authorize('DOCTOR'), removeDoctorReceptionist);

router.put('/profile', authenticate, authorize('DOCTOR'), updateProfile);
router.get('/:id', getDoctorById);
router.put('/schedule', authenticate, authorize('DOCTOR'), updateSchedule);

export default router;
