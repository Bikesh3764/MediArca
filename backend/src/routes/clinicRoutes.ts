import { Router } from 'express';
import {
  getMyClinic,
  addDoctorToClinic,
  removeDoctorFromClinic,
  getPublicClinics,
  addClinicReceptionist,
  getClinicReceptionists,
  updateClinicReceptionistDoctors,
  removeClinicReceptionist,
} from '../controllers/clinicController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Public route to view verified clinic list
router.get('/public', getPublicClinics);

// Clinic authenticated operations
router.use(authenticate);
router.get('/my-clinic', getMyClinic);
router.post('/doctors', addDoctorToClinic);
router.delete('/doctors/:doctorId', removeDoctorFromClinic);

// Receptionist provisioning and management by Clinic
router.get('/receptionists', getClinicReceptionists);
router.post('/receptionists', addClinicReceptionist);
router.put('/receptionists/:receptionistId/doctors', updateClinicReceptionistDoctors);
router.delete('/receptionists/:receptionistId', removeClinicReceptionist);

export default router;
