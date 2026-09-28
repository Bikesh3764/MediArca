import { Router } from 'express';
import {
  getMyClinic,
  addDoctorToClinic,
  respondToDoctorAffiliation,
  removeDoctorFromClinic,
  getPublicClinics,
  addClinicReceptionist,
  getClinicReceptionists,
  updateClinicReceptionistDoctors,
  removeClinicReceptionist,
  respondToReceptionistRequest,
} from '../controllers/clinicController';
import { authenticate, requireActiveClinic } from '../middleware/authMiddleware';

const router = Router();

// Public route to view verified clinic list
router.get('/public', getPublicClinics);

// Clinic authenticated operations
router.use(authenticate);
router.get('/my-clinic', getMyClinic);

// Operations strictly requiring verified, non-suspended clinic status (Finding M6)
router.post('/doctors', requireActiveClinic, addDoctorToClinic);
router.put('/affiliations/:affiliationId/respond', requireActiveClinic, respondToDoctorAffiliation);
router.put('/doctors/:affiliationId/respond', requireActiveClinic, respondToDoctorAffiliation);
router.delete('/doctors/:doctorId', requireActiveClinic, removeDoctorFromClinic);

// Receptionist provisioning and management by Clinic
router.get('/receptionists', requireActiveClinic, getClinicReceptionists);
router.post('/receptionists', requireActiveClinic, addClinicReceptionist);
router.put('/receptionists/:receptionistId/doctors', requireActiveClinic, updateClinicReceptionistDoctors);
router.put('/receptionists/:receptionistId/respond', requireActiveClinic, respondToReceptionistRequest);
router.delete('/receptionists/:receptionistId', requireActiveClinic, removeClinicReceptionist);

export default router;
