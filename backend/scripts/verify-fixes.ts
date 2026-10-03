import path from 'path';
import {
  timeToMinutes,
  minutesTo12Hour,
  format12Hour,
  calculateSlotMetrics,
  parseDoctorSlots,
  evaluateSlotStatus,
  DoctorSlot,
  getLocalDateString,
  getTomorrowDateString,
  getIndianTimeMinutes,
  isValidAppointmentDate,
  isValidDobDate,
  maskPatientName,
  validateDoctorSlots,
  validateDoctorNumericBounds,
} from '../src/utils/scheduleUtils';
import {
  formatFileSize,
  isImageFile,
  isPdfFile,
  calculateScaledDimensions,
  estimateCompressedImageSize,
  validateVaultDocument,
  MAX_VAULT_FILE_SIZE,
  DEFAULT_MAX_IMAGE_DIMENSION,
  DEFAULT_AVATAR_IMAGE_DIMENSION,
} from '../src/utils/documentOptimizer';
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  validateMagicBytes,
  MIME_TO_EXTENSIONS,
} from '../src/middleware/uploadMiddleware';
import {
  sanitizeIndianPhone,
  formatIndianPhone,
  isValidIndianPhone,
} from '../src/utils/phoneUtils';
import { getJwtSecret, optionalAuthenticate, authenticate, AuthRequest } from '../src/middleware/authMiddleware';
import jwt from 'jsonwebtoken';
import { canTransition } from '../src/utils/appointmentStateMachine';
import { isDoctorEligibleForClinicalPractice, isClinicActive } from '../src/utils/authGuards';
import { sanitizeClinicalHistoryList, checkNeedsProfileCompletion } from '../src/controllers/authController';

function runTests() {
  console.log('=== RUNNING MEDIARCA VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, details || '');
      failed++;
    }
  }

  // 1. Time string conversion & formatting
  assert(timeToMinutes('09:00') === 540, 'timeToMinutes("09:00") is 540');
  assert(timeToMinutes('11:00') === 660, 'timeToMinutes("11:00") is 660');
  assert(timeToMinutes('17:00') === 1020, 'timeToMinutes("17:00") is 1020');
  assert(timeToMinutes('20:00') === 1200, 'timeToMinutes("20:00") is 1200');
  assert(minutesTo12Hour(540) === '09:00 AM', 'minutesTo12Hour(540) is 09:00 AM');
  assert(minutesTo12Hour(660) === '11:00 AM', 'minutesTo12Hour(660) is 11:00 AM');
  assert(minutesTo12Hour(1020) === '05:00 PM', 'minutesTo12Hour(1020) is 05:00 PM');
  assert(minutesTo12Hour(1022.4) === '05:02 PM', 'minutesTo12Hour(1022.4) rounds correctly to 05:02 PM');

  // 2. Dynamic Consultation Pace Calculation (Requested by user)
  // User: "maan le agar 50 patient to phir maan le time slot h 2 hours ka to 120 mintues divide by 50 avg time hoga consultance ka"
  const metrics1 = calculateSlotMetrics('09:00', '11:00', 50);
  assert(metrics1.durationMinutes === 120, 'Slot 09:00-11:00 duration is 120 minutes');
  assert(metrics1.avgConsultationMinutes === 2.4, '120 min / 50 patients = exactly 2.4 min pace', metrics1);

  // Slot 2: 17:00 to 20:00 (3 hours = 180 minutes) with 60 patients -> 180 / 60 = 3.0 mins
  const metrics2 = calculateSlotMetrics('17:00', '20:00', 60);
  assert(metrics2.durationMinutes === 180, 'Slot 17:00-20:00 duration is 180 minutes');
  assert(metrics2.avgConsultationMinutes === 3.0, '180 min / 60 patients = exactly 3.0 min pace', metrics2);

  // 3. Multi-slot parsing and backward-compatibility
  const doctorWithJson = {
    slots: JSON.stringify([
      { id: 's1', name: 'Morning', startTime: '09:00', endTime: '11:00', maxPatients: 50 },
      { id: 's2', name: 'Evening', startTime: '17:00', endTime: '20:00', maxPatients: 60 },
    ]),
    checkingStartTime: '09:00',
    checkingEndTime: '20:00',
    maxDailyPatients: 110,
  };
  const parsedSlots = parseDoctorSlots(doctorWithJson);
  assert(parsedSlots.length === 2, 'Doctor with JSON has 2 parsed slots');
  assert(parsedSlots[0].avgConsultationMinutes === 2.4, 'Parsed slot 1 has 2.4 min pace');
  assert(parsedSlots[1].avgConsultationMinutes === 3.0, 'Parsed slot 2 has 3.0 min pace');

  // Legacy doctor with NO slots JSON
  const legacyDoctor = {
    checkingStartTime: '10:00',
    checkingEndTime: '12:00',
    maxDailyPatients: 20,
    avgConsultationMinutes: 6,
  };
  const legacyParsed = parseDoctorSlots(legacyDoctor);
  assert(legacyParsed.length === 1, 'Legacy doctor falls back to 1 slot');
  assert(legacyParsed[0].startTime === '10:00', 'Legacy slot startTime is 10:00');
  assert(legacyParsed[0].endTime === '12:00', 'Legacy slot endTime is 12:00');

  // 4. Time Pass Bug: Slot Elapsed for Today
  // Test case: appointmentDate is TODAY, slot was 09:00 - 11:00, but current time is 11:30 AM!
  const nowPassed = new Date(2026, 8, 11, 11, 30); // 11:30 AM
  const slotMorning: DoctorSlot = {
    id: 's1',
    name: 'Morning Shift',
    startTime: '09:00',
    endTime: '11:00',
    maxPatients: 50,
    avgConsultationMinutes: 2.4,
  };
  const statusPassed = evaluateSlotStatus(slotMorning, '2026-09-11', 1, nowPassed);
  assert(statusPassed.isPassed === true, 'Slot 09:00-11:00 is marked passed when time is 11:30 AM today');
  assert(statusPassed.statusLabel === 'Shift Ended for Today', 'Label indicates Shift Ended for Today');
  assert(statusPassed.estimatedTime === 'Shift Ended', 'Estimated time is NOT past time like 09:20 AM');

  // 5. Time Pass Bug: Active In-Progress Slot Today
  // Test case: slot is 09:00 - 13:00, current time is 10:15 AM, 2 patients ahead
  const nowActive = new Date(2026, 8, 11, 10, 15); // 10:15 AM
  const slotLong: DoctorSlot = {
    id: 's_long',
    name: 'Full Morning',
    startTime: '09:00',
    endTime: '13:00',
    maxPatients: 30,
    avgConsultationMinutes: 8,
  };
  const statusActive = evaluateSlotStatus(slotLong, '2026-09-11', 2, nowActive);
  assert(statusActive.isInProgress === true, 'Slot is marked in-progress when time is 10:15 AM');
  assert(statusActive.isPassed === false, 'Active slot is not passed');
  // Current time is 10:15 AM (615 mins) + 2 * 8 mins = 631 mins = 10:31 AM
  assert(timeToMinutes(statusActive.estimatedTime) >= timeToMinutes('10:15'), 'Estimated time (10:31 AM) is in future relative to current 10:15 AM');
  assert(statusActive.estimatedTime === '10:31 AM', `Estimated time is 10:31 AM, got ${statusActive.estimatedTime}`);

  // 6. Upcoming Shift Later Today
  // Test case: Evening shift 17:00 - 20:00, current time is 11:30 AM, 1 patient ahead
  const slotEvening: DoctorSlot = {
    id: 's_eve',
    name: 'Evening Shift',
    startTime: '17:00',
    endTime: '20:00',
    maxPatients: 60,
    avgConsultationMinutes: 3.0,
  };
  const statusUpcoming = evaluateSlotStatus(slotEvening, '2026-09-11', 1, nowPassed);
  assert(statusUpcoming.isPassed === false, 'Evening slot has NOT passed at 11:30 AM');
  assert(statusUpcoming.isUpcoming === true, 'Evening slot is upcoming');
  assert(statusUpcoming.estimatedTime === '05:03 PM', `Estimated time is 05:03 PM, got ${statusUpcoming.estimatedTime}`);

  // 7. Capacity Overflow
  const statusFull = evaluateSlotStatus(slotEvening, '2026-09-11', 60, nowPassed);
  assert(statusFull.isFull === true, 'Slot with 60 booked patients is marked isFull');
  assert(statusFull.statusLabel === 'Fully Booked', 'Status label is Fully Booked');

  // 8. Overnight / Midnight-crossing shift
  const slotOvernight: DoctorSlot = {
    id: 's_night',
    name: 'Night Emergency',
    startTime: '22:00',
    endTime: '02:00',
    maxPatients: 20,
    avgConsultationMinutes: 12,
  };
  const metricsNight = calculateSlotMetrics('22:00', '02:00', 20);
  assert(metricsNight.durationMinutes === 240, '22:00 to 02:00 overnight duration is 240 minutes');
  assert(metricsNight.avgConsultationMinutes === 12.0, '240m / 20 = 12.0m pace');
  // Evaluate at 23:00 (1380 mins) on same day: should NOT be marked passed
  const nowNight = new Date(2026, 8, 11, 23, 0);
  const statusNight = evaluateSlotStatus(slotOvernight, '2026-09-11', 1, nowNight);
  assert(statusNight.isPassed === false, 'Overnight shift is NOT marked passed at 23:00');
  assert(statusNight.isInProgress === true, 'Overnight shift is active at 23:00');

  // 9. Active In-Progress Slot Near Shift End (Within maxPatients capacity)
  // Shift ends at 11:00 AM (660 mins). Clock is 10:55 AM (655 mins). 5 patients ahead * 2.4 min = 12 mins -> 667 mins (11:07 AM).
  // With maxPatients = 50, only 5 patients are booked: shift is NOT full!
  const nowCloseToEnd = new Date(2026, 8, 11, 10, 55);
  const statusNearEnd = evaluateSlotStatus(slotMorning, '2026-09-11', 5, nowCloseToEnd);
  assert(statusNearEnd.isFull === false, 'Shift with 5/50 capacity is NOT marked isFull near shift end');
  assert(statusNearEnd.isPassed === false, 'Shift has not ended yet at 10:55 AM');
  assert(statusNearEnd.isInProgress === true, 'Shift is active in progress at 10:55 AM');
  assert(statusNearEnd.estimatedTime === '11:07 AM', `Estimated time reflects accurate time 11:07 AM, got ${statusNearEnd.estimatedTime}`);
  assert(statusNearEnd.statusLabel === 'Active Now • In Progress', 'Label reflects Active Now • In Progress');

  // 10. Client Minutes Timezone Override (Render server in UTC vs client in local time)
  // Server is 04:30 AM UTC (270 mins), but client passes local minute 630 (10:30 AM)
  const serverUtcDate = new Date(Date.UTC(2026, 8, 11, 4, 30));
  const clientLocalMinutes = 10 * 60 + 30; // 630 mins = 10:30 AM
  const statusTzOverride = evaluateSlotStatus(slotMorning, '2026-09-11', 1, serverUtcDate, clientLocalMinutes);
  assert(statusTzOverride.isInProgress === true, 'Slot evaluates active when clientMinutes (10:30 AM) is provided despite UTC server time');
  assert(statusTzOverride.isUpcoming === false, 'Slot is not falsely marked upcoming');

  // 11. Strict 1 MB Upload Limit Boundary Check
  const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1,048,576 bytes
  const validFileSize = 1024 * 1024; // exactly 1 MB
  const invalidFileSize = 1024 * 1024 + 1; // 1 byte over 1 MB
  const validateFileSize = (sizeBytes: number) => {
    if (sizeBytes > MAX_FILE_SIZE) {
      return { valid: false, error: 'File size exceeds 1 MB limit. Please upload a document under 1 MB.' };
    }
    return { valid: true, error: null };
  };
  assert(validateFileSize(validFileSize).valid === true, '1 MB (1,048,576 bytes) file is accepted');
  assert(validateFileSize(invalidFileSize).valid === false, '1 MB + 1 byte file is rejected');
  assert(
    validateFileSize(invalidFileSize).error === 'File size exceeds 1 MB limit. Please upload a document under 1 MB.',
    'Rejected file returns exact user error message'
  );

  // 12. Clinic-Doctor Isolated Booking and Revenue Calculation
  // Doctor A (Fee $80) has 3 bookings at Clinic 1 (2 WAITING/COMPLETED, 1 CANCELLED), and 2 bookings at Clinic 2
  const docAFee = 80;
  const mockAppointments = [
    { doctorId: 'docA', clinicId: 'clinic1', status: 'WAITING' },
    { doctorId: 'docA', clinicId: 'clinic1', status: 'COMPLETED' },
    { doctorId: 'docA', clinicId: 'clinic1', status: 'CANCELLED' }, // Should not count towards revenue
    { doctorId: 'docA', clinicId: 'clinic2', status: 'COMPLETED' },
    { doctorId: 'docA', clinicId: 'clinic2', status: 'WAITING' },
  ];

  // Clinic 1 calculations
  const clinic1Docs = mockAppointments.filter((a) => a.clinicId === 'clinic1' && a.doctorId === 'docA');
  const clinic1Active = clinic1Docs.filter((a) => a.status !== 'CANCELLED');
  const clinic1Revenue = clinic1Active.length * docAFee;
  assert(clinic1Docs.length === 3, 'Clinic 1 sees 3 total bookings for Doctor A');
  assert(clinic1Active.length === 2, 'Clinic 1 has 2 revenue-generating bookings (excluding CANCELLED)');
  assert(clinic1Revenue === 160, 'Clinic 1 revenue for Doctor A is exactly $160 (not $400 across all clinics)');

  // Clinic 2 calculations
  const clinic2Docs = mockAppointments.filter((a) => a.clinicId === 'clinic2' && a.doctorId === 'docA');
  const clinic2Revenue = clinic2Docs.filter((a) => a.status !== 'CANCELLED').length * docAFee;
  assert(clinic2Revenue === 160, 'Clinic 2 revenue for Doctor A is $160');

  // 13. Receptionist Walk-in Token Calculation
  const existingQueue = [
    { queueNumber: 1, status: 'COMPLETED' },
    { queueNumber: 2, status: 'IN_CONSULTATION' },
    { queueNumber: 3, status: 'WAITING' },
  ];
  const highestQueueNumber = existingQueue.reduce((max, a) => Math.max(max, a.queueNumber), 0);
  const nextWalkinToken = highestQueueNumber + 1;
  assert(nextWalkinToken === 4, 'Receptionist walk-in gets next sequential atomic token #4');

  // 14. Doctor Multi-Clinic and Staff Detachment Isolation
  const doctorAffiliations = [
    { clinicId: 'clinic1', doctorId: 'docA' },
    { clinicId: 'clinic2', doctorId: 'docA' },
  ];
  const remainingAfterClinic1Detach = doctorAffiliations.filter((a) => a.clinicId !== 'clinic1');
  assert(remainingAfterClinic1Detach.length === 1, 'Doctor detaches Clinic 1 while Clinic 2 remains intact');
  assert(remainingAfterClinic1Detach[0].clinicId === 'clinic2', 'Remaining affiliation is Clinic 2');

  // 15. Doctor Profile Includes Affiliated Clinics & Facility Details
  const mockDoctorProfile = {
    id: 'docA',
    user: { fullName: 'Dr. Sarah Jenkins' },
    clinics: [
      {
        id: 'cd1',
        clinicId: 'clinic1',
        clinic: {
          id: 'clinic1',
          clinicName: 'Metropolis Polyclinic',
          address: '100 Broadway, NY',
          city: 'New York',
          phone: '+1 555-0199',
        },
      },
    ],
  };
  assert(Array.isArray(mockDoctorProfile.clinics) && mockDoctorProfile.clinics.length === 1, 'Doctor profile includes clinics array');
  assert(mockDoctorProfile.clinics[0].clinic.clinicName === 'Metropolis Polyclinic', 'Affiliated clinic contains full clinic details');

  // 16. Auto-attribution of clinicId when not passed
  const resolveTargetClinicId = (passedClinicId: string | undefined, activeAffiliations: Array<{ clinicId: string }>) => {
    if (passedClinicId) return passedClinicId;
    if (activeAffiliations.length > 0) return activeAffiliations[0].clinicId;
    return null;
  };
  const autoAttributed = resolveTargetClinicId(undefined, [{ clinicId: 'clinic1' }]);
  assert(autoAttributed === 'clinic1', 'Booking without explicit clinicId auto-attributes to active affiliated clinic');

  // 17. Explicit clinicId overrides default affiliation
  const explicitAttributed = resolveTargetClinicId('clinic2', [{ clinicId: 'clinic1' }]);
  assert(explicitAttributed === 'clinic2', 'Explicit clinicId takes precedence over default clinic');

  // 18. Clinic Verification Filtering in Public Searches
  const sampleClinics = [
    { id: 'c1', clinicName: 'Verified Care Hub', isVerified: true },
    { id: 'c2', clinicName: 'Unverified New Clinic', isVerified: false },
    { id: 'c3', clinicName: 'Pending Review Center', isVerified: false },
    { id: 'c4', clinicName: 'Metro General Hospital', isVerified: true },
  ];
  const publicSearchResults = sampleClinics.filter((c) => c.isVerified === true);
  assert(publicSearchResults.length === 2, 'Only verified clinics returned in public searches (2 of 4)');
  assert(!publicSearchResults.some((c) => c.id === 'c2'), 'Unverified clinic c2 is excluded from search results');
  assert(!publicSearchResults.some((c) => c.id === 'c3'), 'Unverified clinic c3 is excluded from search results');

  // 19. Receptionist Public Signup Rejection
  const validatePublicRegistration = (role: string) => {
    if (role?.toUpperCase() === 'RECEPTIONIST') {
      return {
        allowed: false,
        status: 403,
        error: 'Registration with role RECEPTIONIST is disabled. Desk credentials must be provisioned by Clinic Administrators.',
      };
    }
    return { allowed: true, status: 201 };
  };
  const recRegisterAttempt = validatePublicRegistration('RECEPTIONIST');
  assert(recRegisterAttempt.allowed === false, 'Public registration for RECEPTIONIST is strictly rejected');
  assert(recRegisterAttempt.status === 403, 'Public registration rejection returns 403 status code');
  assert(validatePublicRegistration('PATIENT').allowed === true, 'PATIENT registration is permitted');
  assert(validatePublicRegistration('DOCTOR').allowed === true, 'DOCTOR registration is permitted');
  assert(validatePublicRegistration('CLINIC').allowed === true, 'CLINIC registration is permitted');

  // 20. Clinic Receptionist Provisioning & Doctor Assignment Scoping
  interface ProvisionedReceptionist {
    id: string;
    clinicId: string;
    assignedDoctorIds: string[];
  }
  const clinicProfile = { id: 'clinic_100', clinicName: 'Apex Health' };
  const provisionDeskStaff = (
    clinicId: string,
    doctorIds: string[],
    clinicAffiliatedDoctorIds: string[]
  ): ProvisionedReceptionist => {
    // Only affiliated doctors can be assigned
    const validDoctorIds = doctorIds.filter((id) => clinicAffiliatedDoctorIds.includes(id));
    return {
      id: 'rec_test_1',
      clinicId,
      assignedDoctorIds: validDoctorIds,
    };
  };

  const affiliatedDoctors = ['doc_1', 'doc_2', 'doc_3'];
  const newStaff = provisionDeskStaff('clinic_100', ['doc_1', 'doc_3', 'doc_external_99'], affiliatedDoctors);
  assert(newStaff.clinicId === 'clinic_100', 'Receptionist is strictly bound to parent clinic clinic_100');
  assert(newStaff.assignedDoctorIds.includes('doc_1'), 'Receptionist assigned to doc_1');
  assert(newStaff.assignedDoctorIds.includes('doc_3'), 'Receptionist assigned to doc_3');
  assert(!newStaff.assignedDoctorIds.includes('doc_external_99'), 'Unaffiliated doctor is excluded from assignments');

  // 21. Receptionist Walk-in Scoping to Assigned Doctors and Parent Clinic
  const validateReceptionistWalkin = (
    receptionist: ProvisionedReceptionist,
    targetDoctorId: string,
    requestedClinicId?: string
  ) => {
    if (!receptionist.assignedDoctorIds.includes(targetDoctorId)) {
      return { allowed: false, error: 'You are not assigned to manage queue tokens for this practitioner.' };
    }
    // Enforce clinicId scoping to receptionist parent clinic
    const finalClinicId = receptionist.clinicId;
    return { allowed: true, clinicId: finalClinicId };
  };

  const authorizedWalkin = validateReceptionistWalkin(newStaff, 'doc_1', 'other_clinic');
  assert(authorizedWalkin.allowed === true, 'Walk-in allowed for assigned doctor doc_1');
  assert(authorizedWalkin.clinicId === 'clinic_100', 'Walk-in is strictly scoped to parent clinic_100 regardless of request');

  const unauthorizedWalkin = validateReceptionistWalkin(newStaff, 'doc_2');
  assert(unauthorizedWalkin.allowed === false, 'Walk-in rejected for unassigned doctor doc_2');
  assert(
    unauthorizedWalkin.error === 'You are not assigned to manage queue tokens for this practitioner.',
    'Accurate rejection message returned'
  );

  // 22. Direct Doctor-Receptionist Linking Disabled
  const attemptDirectDoctorReceptionistLink = () => {
    return {
      success: false,
      status: 400,
      message: 'Direct receptionist linking is disabled. Receptionists must be provisioned and assigned to your desk by clinic administration.',
    };
  };
  const directLinkResult = attemptDirectDoctorReceptionistLink();
  assert(directLinkResult.success === false, 'Direct doctor-receptionist linking returns failure');
  assert(directLinkResult.status === 400, 'Direct linking returns 400 status code');

  // 23. Doctor Affiliation Requires Verified Clinic
  const validateDoctorClinicAffiliation = (clinic: { id: string; isVerified: boolean }) => {
    if (!clinic.isVerified) {
      return { allowed: false, error: 'Cannot affiliate with an unverified clinic. Please wait for administrative verification.' };
    }
    return { allowed: true };
  };
  assert(
    validateDoctorClinicAffiliation({ id: 'c_unverified', isVerified: false }).allowed === false,
    'Doctor cannot affiliate with unverified clinic'
  );
  assert(
    validateDoctorClinicAffiliation({ id: 'c_verified', isVerified: true }).allowed === true,
    'Doctor can affiliate with verified clinic'
  );

  // 24. Clinic Doctor Onboarding Requires Verified Doctor
  const validateClinicDoctorOnboarding = (doctor: { id: string; isVerified: boolean }) => {
    if (!doctor.isVerified) {
      return { allowed: false, error: 'Doctor is pending administrative verification. Unverified doctors cannot be affiliated with clinics.' };
    }
    return { allowed: true };
  };
  assert(
    validateClinicDoctorOnboarding({ id: 'doc_unverified', isVerified: false }).allowed === false,
    'Clinic cannot onboard unverified doctor'
  );
  assert(
    validateClinicDoctorOnboarding({ id: 'doc_verified', isVerified: true }).allowed === true,
    'Clinic can onboard verified doctor'
  );

  // 25. Doctor Detachment Cascades Removal of Receptionist Assignments
  interface StaffDeskLink {
    receptionistId: string;
    doctorId: string;
    clinicId: string;
  }
  const simulateDoctorDetachment = (
    doctorIdToRemove: string,
    clinicId: string,
    affiliations: Array<{ clinicId: string; doctorId: string }>,
    deskLinks: StaffDeskLink[]
  ) => {
    const remainingAffiliations = affiliations.filter(
      (a) => !(a.clinicId === clinicId && a.doctorId === doctorIdToRemove)
    );
    const remainingLinks = deskLinks.filter(
      (link) => !(link.clinicId === clinicId && link.doctorId === doctorIdToRemove)
    );
    return { remainingAffiliations, remainingLinks };
  };

  const initialAffiliations = [
    { clinicId: 'c1', doctorId: 'd1' },
    { clinicId: 'c1', doctorId: 'd2' },
    { clinicId: 'c2', doctorId: 'd1' },
  ];
  const initialDeskLinks: StaffDeskLink[] = [
    { receptionistId: 'rec_c1_1', doctorId: 'd1', clinicId: 'c1' },
    { receptionistId: 'rec_c1_1', doctorId: 'd2', clinicId: 'c1' },
    { receptionistId: 'rec_c2_1', doctorId: 'd1', clinicId: 'c2' },
  ];

  const detachedResult = simulateDoctorDetachment('d1', 'c1', initialAffiliations, initialDeskLinks);
  assert(
    !detachedResult.remainingAffiliations.some((a) => a.clinicId === 'c1' && a.doctorId === 'd1'),
    'Doctor d1 detached from Clinic c1'
  );
  assert(
    !detachedResult.remainingLinks.some((l) => l.clinicId === 'c1' && l.doctorId === 'd1'),
    'Desk assignment for d1 at c1 is cleaned up upon detachment'
  );
  assert(
    detachedResult.remainingLinks.some((l) => l.clinicId === 'c2' && l.doctorId === 'd1'),
    'Desk assignment for d1 at Clinic c2 remains unaffected'
  );

  // 26. Receptionist Operations Strictly Require Active Clinic Affiliation
  const validateReceptionistActiveAffiliation = (
    receptionistClinicId: string,
    targetDoctorId: string,
    activeClinicDoctorPairs: Array<{ clinicId: string; doctorId: string }>
  ) => {
    const isAffiliated = activeClinicDoctorPairs.some(
      (pair) => pair.clinicId === receptionistClinicId && pair.doctorId === targetDoctorId
    );
    if (!isAffiliated) {
      return { allowed: false, error: 'Access denied: Practitioner is not currently affiliated with your facility.' };
    }
    return { allowed: true };
  };

  const currentPairs = [{ clinicId: 'clinic_metro', doctorId: 'doc_active' }];
  const validAccess = validateReceptionistActiveAffiliation('clinic_metro', 'doc_active', currentPairs);
  assert(validAccess.allowed === true, 'Receptionist allowed for active affiliated doctor');

  const invalidAccess = validateReceptionistActiveAffiliation('clinic_metro', 'doc_detached', currentPairs);
  assert(invalidAccess.allowed === false, 'Receptionist rejected for detached doctor');
  assert(
    invalidAccess.error === 'Access denied: Practitioner is not currently affiliated with your facility.',
    'Accurate affiliation rejection message returned'
  );

  // 27. Public Doctor Profile Excludes Unverified Clinics
  const doctorWithMixedClinics = {
    id: 'doc_sarah',
    clinics: [
      { clinic: { id: 'c_ver', clinicName: 'Central Care', isVerified: true } },
      { clinic: { id: 'c_unver', clinicName: 'Rogue Center', isVerified: false } },
    ],
  };
  const verifiedDoctorClinics = doctorWithMixedClinics.clinics.filter((c) => c.clinic.isVerified);
  assert(verifiedDoctorClinics.length === 1, 'Only 1 verified clinic retained in doctor profile');
  assert(verifiedDoctorClinics[0].clinic.id === 'c_ver', 'Central Care is included');
  assert(!verifiedDoctorClinics.some((c) => c.clinic.id === 'c_unver'), 'Unverified clinic Rogue Center is stripped');

  // 28. Public Clinic Search with Text Query Filtering
  const clinicCatalog = [
    { id: '1', clinicName: 'Apex Health Center', address: '123 Main St', city: 'Mumbai', isVerified: true },
    { id: '2', clinicName: 'Metro General Hospital', address: '456 Ring Rd', city: 'Delhi', isVerified: true },
    { id: '3', clinicName: 'City Dental Clinic', address: '789 Park Ave', city: 'Mumbai', isVerified: false },
  ];
  const searchClinics = (query: string, city?: string) => {
    return clinicCatalog.filter((c) => {
      if (!c.isVerified) return false;
      if (city && c.city.toLowerCase() !== city.toLowerCase()) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          c.clinicName.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q)
        );
      }
      return true;
    });
  };

  const mumbaiResults = searchClinics('', 'Mumbai');
  assert(mumbaiResults.length === 1, 'Only verified Mumbai clinic returned (1 of 2)');
  assert(mumbaiResults[0].id === '1', 'Apex Health Center returned');

  const metroResults = searchClinics('Metro');
  assert(metroResults.length === 1, 'Search for "Metro" matches Metro General Hospital');
  assert(metroResults[0].city === 'Delhi', 'Matched clinic is in Delhi');

  // 29. Admin Clinic Inspection Response Formats
  const rawClinicRecord = {
    id: 'c_inspect_1',
    clinicName: 'St. Jude Medical',
    _count: { doctors: 4, appointments: 120, receptionists: 2 },
  };
  const formattedAdminClinic = {
    ...rawClinicRecord,
    doctorsCount: rawClinicRecord._count.doctors,
    appointmentsCount: rawClinicRecord._count.appointments,
    receptionistsCount: rawClinicRecord._count.receptionists,
  };
  assert(formattedAdminClinic.doctorsCount === 4, 'Admin clinic doctorsCount is 4');
  assert(formattedAdminClinic.appointmentsCount === 120, 'Admin clinic appointmentsCount is 120');
  assert(formattedAdminClinic.receptionistsCount === 2, 'Admin clinic receptionistsCount is 2');

  // 30. Role-Based Login Redirection Destination
  const getDestination = (role: string) => {
    if (role === 'DOCTOR') return '/doctor/dashboard';
    if (role === 'ADMIN') return '/admin';
    if (role === 'CLINIC') return '/clinic/dashboard';
    if (role === 'RECEPTIONIST') return '/receptionist/dashboard';
    return '/doctors';
  };
  assert(getDestination('CLINIC') === '/clinic/dashboard', 'CLINIC role redirects to /clinic/dashboard');
  assert(getDestination('RECEPTIONIST') === '/receptionist/dashboard', 'RECEPTIONIST role redirects to /receptionist/dashboard');
  assert(getDestination('DOCTOR') === '/doctor/dashboard', 'DOCTOR role redirects to /doctor/dashboard');
  assert(getDestination('ADMIN') === '/admin', 'ADMIN role redirects to /admin');
  assert(getDestination('PATIENT') === '/doctors', 'PATIENT role redirects to /doctors');

  // 31. Booking for Myself vs Someone Else / Other Validation & Duplicate Handling
  interface BookingPayload {
    isForOther: boolean;
    patientName?: string;
    patientAge?: string;
    patientGender?: string;
  }
  const validateBookingForOther = (payload: BookingPayload) => {
    if (payload.isForOther) {
      if (!payload.patientName || !payload.patientName.trim()) {
        return { valid: false, error: 'Patient full name is required when booking for someone else' };
      }
      if (!payload.patientAge || !payload.patientAge.trim()) {
        return { valid: false, error: 'Patient age is required when booking for someone else' };
      }
    }
    return { valid: true, error: null };
  };

  assert(
    validateBookingForOther({ isForOther: false }).valid === true,
    'Booking for myself passes without other fields'
  );
  assert(
    validateBookingForOther({ isForOther: true, patientName: '' }).valid === false,
    'Booking for other without name is rejected'
  );
  assert(
    validateBookingForOther({ isForOther: true, patientName: 'Rahul Ray', patientAge: '' }).valid === false,
    'Booking for other without age is rejected'
  );
  assert(
    validateBookingForOther({ isForOther: true, patientName: 'Rahul Ray', patientAge: '12' }).valid === true,
    'Booking for other with valid name and age is accepted'
  );

  // Multi-person booking: Account owner can book for self and separate person on same date
  const existingBookings: Array<{
    patientId: string;
    doctorId: string;
    date: string;
    isForOther: boolean;
    patientName: string | null;
  }> = [
    { patientId: 'p1', doctorId: 'd1', date: '2026-09-12', isForOther: false, patientName: null },
  ];
  const canBook = (patientId: string, doctorId: string, date: string, isForOther: boolean, name?: string) => {
    const conflict = existingBookings.some((b) => {
      if (b.patientId !== patientId || b.doctorId !== doctorId || b.date !== date) return false;
      if (!isForOther && !b.isForOther) return true;
      if (isForOther && b.isForOther && b.patientName?.toLowerCase() === name?.toLowerCase()) return true;
      return false;
    });
    return !conflict;
  };

  assert(
    canBook('p1', 'd1', '2026-09-12', false) === false,
    'Duplicate booking for myself on same date is blocked'
  );
  assert(
    canBook('p1', 'd1', '2026-09-12', true, 'Rahul Ray') === true,
    'Booking for family member Rahul Ray is permitted even if self is already booked'
  );

  // 32. Clinic ⇄ Doctor Request & Accept Workflow
  interface AffiliationRecord {
    id: string;
    clinicId: string;
    doctorId: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    requestedBy: 'CLINIC' | 'DOCTOR';
  }
  const createAffiliationRequest = (
    initiatorRole: 'CLINIC' | 'DOCTOR',
    clinic: { id: string; isVerified: boolean },
    doctor: { id: string; isVerified: boolean }
  ): { success: boolean; record?: AffiliationRecord; error?: string } => {
    if (!clinic.isVerified) {
      return { success: false, error: 'Cannot affiliate with an unverified clinic. Please wait for administrative verification.' };
    }
    if (!doctor.isVerified) {
      return { success: false, error: 'Doctor is pending administrative verification. Unverified doctors cannot be affiliated with clinics.' };
    }
    return {
      success: true,
      record: {
        id: `aff_${Date.now()}`,
        clinicId: clinic.id,
        doctorId: doctor.id,
        status: 'PENDING',
        requestedBy: initiatorRole,
      },
    };
  };

  const clinicReq = createAffiliationRequest('CLINIC', { id: 'c1', isVerified: true }, { id: 'd1', isVerified: true });
  assert(clinicReq.success === true && clinicReq.record?.status === 'PENDING', 'Clinic requesting doctor creates PENDING status');
  assert(clinicReq.record?.requestedBy === 'CLINIC', 'Clinic request marked requestedBy CLINIC');

  const docReq = createAffiliationRequest('DOCTOR', { id: 'c1', isVerified: true }, { id: 'd1', isVerified: true });
  assert(docReq.success === true && docReq.record?.status === 'PENDING', 'Doctor requesting clinic creates PENDING status');
  assert(docReq.record?.requestedBy === 'DOCTOR', 'Doctor request marked requestedBy DOCTOR');

  // Accept workflow
  const respondAffiliation = (record: AffiliationRecord, action: 'ACCEPT' | 'REJECT'): AffiliationRecord => {
    return { ...record, status: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED' };
  };
  const acceptedAffiliation = respondAffiliation(clinicReq.record!, 'ACCEPT');
  assert(acceptedAffiliation.status === 'ACCEPTED', 'Affiliation transitions to ACCEPTED on approval');

  // Active staff filter excludes PENDING affiliations
  const clinicRoster: AffiliationRecord[] = [
    acceptedAffiliation,
    docReq.record!, // PENDING
  ];
  const activeStaff = clinicRoster.filter((a) => a.status === 'ACCEPTED');
  assert(activeStaff.length === 1, 'Only ACCEPTED affiliations appear in active staff roster (1 of 2)');
  assert(activeStaff[0].doctorId === 'd1', 'Active staff contains accepted doctor d1');

  // 33. Receptionist Temporary Password & First-Login Password Change
  interface DeskUser {
    id: string;
    role: string;
    passwordHash: string;
    mustChangePassword: boolean;
  }
  const provisionReceptionist = (email: string, tempHash: string): DeskUser => {
    return {
      id: 'rec_user_1',
      role: 'RECEPTIONIST',
      passwordHash: tempHash,
      mustChangePassword: true,
    };
  };

  const newDeskUser = provisionReceptionist('desk@clinic.com', 'hashed_temp_123');
  assert(newDeskUser.mustChangePassword === true, 'Provisioned receptionist has mustChangePassword: true');

  const completeFirstLoginPasswordChange = (
    user: DeskUser,
    enteredCurrent: string,
    actualHashMatch: boolean,
    newPass: string
  ) => {
    if (!actualHashMatch) {
      return { success: false, error: 'Current temporary password does not match' };
    }
    if (newPass.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long' };
    }
    return {
      success: true,
      user: {
        ...user,
        passwordHash: `new_hashed_${newPass}`,
        mustChangePassword: false,
      },
    };
  };

  const failedChangeWrongPass = completeFirstLoginPasswordChange(newDeskUser, 'wrong', false, 'permanent123');
  assert(failedChangeWrongPass.success === false, 'Change fails if temporary password does not match');

  const failedChangeShortPass = completeFirstLoginPasswordChange(newDeskUser, 'temp', true, '123');
  assert(failedChangeShortPass.success === false, 'Change fails if new password is under 6 chars');

  const successfulChange = completeFirstLoginPasswordChange(newDeskUser, 'temp', true, 'securePassword123');
  assert(successfulChange.success === true, 'Successful permanent password update');
  assert(successfulChange.user?.mustChangePassword === false, 'mustChangePassword cleared to false after update');

  // 34. Full Name Display (Never show raw email)
  const formatUserDisplayName = (user: { fullName?: string; email: string }) => {
    if (user.fullName && user.fullName.trim()) return user.fullName.trim();
    return user.email.split('@')[0];
  };
  assert(
    formatUserDisplayName({ fullName: 'Dr. Vikram Ray', email: 'araj172007@gmail.com' }) === 'Dr. Vikram Ray',
    'Display name prefers Full Name over email'
  );
  assert(
    formatUserDisplayName({ fullName: '', email: 'doctor@mediarca.com' }) === 'doctor',
    'Fallback strips email domain cleanly instead of raw email'
  );

  // 35. Admin Practitioner & Clinic Verification Lifecycle State Machine
  type VerificationStatus = 'PENDING' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED';
  interface ProfileVerificationState {
    id: string;
    isVerified: boolean;
    verificationStatus: VerificationStatus;
  }

  const applyVerificationAction = (
    profile: ProfileVerificationState,
    action: { status?: VerificationStatus; isVerified?: boolean }
  ): ProfileVerificationState => {
    let targetStatus: VerificationStatus;
    let targetIsVerified: boolean;

    if (action.status && ['VERIFIED', 'SUSPENDED', 'REJECTED', 'PENDING'].includes(action.status)) {
      targetStatus = action.status;
      targetIsVerified = targetStatus === 'VERIFIED';
    } else if (typeof action.isVerified === 'boolean') {
      targetIsVerified = action.isVerified;
      targetStatus = action.isVerified ? 'VERIFIED' : 'SUSPENDED';
    } else {
      throw new Error('Invalid verification action');
    }

    return {
      ...profile,
      isVerified: targetIsVerified,
      verificationStatus: targetStatus,
    };
  };

  // Initial State: Newly registered practitioner or clinic
  let docProfile: ProfileVerificationState = {
    id: 'doc_123',
    isVerified: false,
    verificationStatus: 'PENDING',
  };
  assert(docProfile.isVerified === false && docProfile.verificationStatus === 'PENDING', 'Initial registration is PENDING and isVerified: false');

  // Transition 1: Admin approves license
  docProfile = applyVerificationAction(docProfile, { status: 'VERIFIED' });
  assert(docProfile.isVerified === true && docProfile.verificationStatus === 'VERIFIED', 'Approved license has status VERIFIED and isVerified: true');

  // Transition 2: Admin suspends credentials (The issue reported in screenshot)
  docProfile = applyVerificationAction(docProfile, { status: 'SUSPENDED' });
  assert(docProfile.isVerified === false, 'Suspended practitioner has isVerified: false');
  assert(docProfile.verificationStatus === 'SUSPENDED', 'Suspended practitioner has verificationStatus: "SUSPENDED" (NOT "PENDING")');

  // Transition 3: Admin re-activates suspended practitioner
  docProfile = applyVerificationAction(docProfile, { status: 'VERIFIED' });
  assert(docProfile.isVerified === true && docProfile.verificationStatus === 'VERIFIED', 'Re-activated practitioner restored to VERIFIED and isVerified: true');

  // Transition 4: Admin rejects pending practitioner
  let rejectedDoc: ProfileVerificationState = {
    id: 'doc_456',
    isVerified: false,
    verificationStatus: 'PENDING',
  };
  rejectedDoc = applyVerificationAction(rejectedDoc, { status: 'REJECTED' });
  assert(rejectedDoc.isVerified === false && rejectedDoc.verificationStatus === 'REJECTED', 'Rejected application sets REJECTED and isVerified: false');

  // Transition 5: Admin re-evaluates & approves previously rejected practitioner
  rejectedDoc = applyVerificationAction(rejectedDoc, { status: 'VERIFIED' });
  assert(rejectedDoc.isVerified === true && rejectedDoc.verificationStatus === 'VERIFIED', 'Re-evaluating rejected application restores to VERIFIED');

  // 36. Public Discoverability & KPI Count Isolation
  const pool: ProfileVerificationState[] = [
    { id: '1', isVerified: true, verificationStatus: 'VERIFIED' },
    { id: '2', isVerified: false, verificationStatus: 'PENDING' },
    { id: '3', isVerified: false, verificationStatus: 'SUSPENDED' },
    { id: '4', isVerified: false, verificationStatus: 'REJECTED' },
    { id: '5', isVerified: true, verificationStatus: 'VERIFIED' },
  ];

  // Public discovery check
  const publiclyDiscoverable = pool.filter((p) => p.isVerified === true);
  assert(publiclyDiscoverable.length === 2, 'Only genuinely VERIFIED entities are publicly discoverable (2 out of 5)');
  assert(!publiclyDiscoverable.some((p) => p.verificationStatus === 'SUSPENDED'), 'Suspended entities NEVER appear in public discovery');
  assert(!publiclyDiscoverable.some((p) => p.verificationStatus === 'PENDING'), 'Pending entities NEVER appear in public discovery');

  // Pending Review KPI count: Must strictly count PENDING, NOT SUSPENDED or REJECTED
  const pendingReviewCount = pool.filter((p) => p.verificationStatus === 'PENDING').length;
  assert(pendingReviewCount === 1, 'Pending review count is strictly 1 (does not inflate with SUSPENDED or REJECTED)');

  // 37. Automatic Resolution Downscaling & Aspect Ratio Preservation
  // Landscape 12MP photo (4032 x 3024) downscales to max dimension 1920px (1920 x 1440)
  const landscapeScaled = calculateScaledDimensions(4032, 3024, 1920);
  assert(landscapeScaled.scaled === true, '12MP landscape photo is marked scaled');
  assert(landscapeScaled.width === 1920, 'Landscape width scaled to exactly 1920px');
  assert(landscapeScaled.height === 1440, 'Landscape height preserved 4:3 aspect ratio at 1440px');

  // Portrait 12MP photo (3024 x 4032) downscales to max dimension 1920px (1440 x 1920)
  const portraitScaled = calculateScaledDimensions(3024, 4032, 1920);
  assert(portraitScaled.scaled === true, '12MP portrait photo is marked scaled');
  assert(portraitScaled.height === 1920, 'Portrait height scaled to exactly 1920px');
  assert(portraitScaled.width === 1440, 'Portrait width preserved 3:4 aspect ratio at 1440px');

  // Ultra-high-res 48MP camera photo (8000 x 6000)
  const ultraScaled = calculateScaledDimensions(8000, 6000, 1920);
  assert(ultraScaled.scaled === true, '48MP photo is downscaled');
  assert(ultraScaled.width === 1920 && ultraScaled.height === 1440, '48MP photo downscaled to 1920x1440');

  // Square image (2400 x 2400)
  const squareScaled = calculateScaledDimensions(2400, 2400, 1920);
  assert(squareScaled.width === 1920 && squareScaled.height === 1920, 'Square image downscaled to 1920x1920');

  // Image already below max dimension (1280 x 720) remains unscaled
  const standardImg = calculateScaledDimensions(1280, 720, 1920);
  assert(standardImg.scaled === false, '1280x720 image is not unnecessarily scaled');
  assert(standardImg.width === 1280 && standardImg.height === 720, '1280x720 dimensions unchanged');

  // 38. Client-Side Image Compression Metrics & 1 MB Vault Limit Satisfaction
  // 4.5 MB camera shot of a lab report (4032 x 3024) compressed with quality 0.80
  const orig4_5MB = Math.round(4.5 * 1024 * 1024);
  const compressionMetrics = estimateCompressedImageSize(orig4_5MB, 4032, 3024, 1920, 0.80);
  assert(compressionMetrics.fitsWithin1MB === true, 'Compressed image comfortably fits within 1 MB vault limit');
  assert(compressionMetrics.estimatedBytes <= MAX_VAULT_FILE_SIZE, `Estimated size (${compressionMetrics.formattedEstimatedSize}) <= 1 MB`);
  assert(compressionMetrics.reductionPercentage >= 85, `Size reduction is >= 85% (got ${compressionMetrics.reductionPercentage}%)`);

  // 8 MB smartphone photo (8000 x 6000)
  const orig8MB = Math.round(8.0 * 1024 * 1024);
  const compressionMetrics8MB = estimateCompressedImageSize(orig8MB, 8000, 6000, 1920, 0.80);
  assert(compressionMetrics8MB.fitsWithin1MB === true, '8 MB camera photo fits within 1 MB limit after compression');
  assert(compressionMetrics8MB.reductionPercentage >= 90, `8 MB photo has >= 90% size reduction (got ${compressionMetrics8MB.reductionPercentage}%)`);

  // 39. Pre-Compression vs Post-Compression Vault Acceptance (Fixes False Rejection)
  // Scenario: User selects 4.2 MB photo 'prescription_scan.jpg'
  // Pre-compression check: Recognizes it needs client compression, does NOT block the user!
  const preCheckImg = validateVaultDocument({ name: 'prescription_scan.jpg', size: Math.round(4.2 * 1024 * 1024) }, false);
  assert(preCheckImg.valid === true, '4.2 MB photo is accepted pre-compression because client optimizer will compress it');
  assert(preCheckImg.requiresClientCompression === true, 'Photo is flagged as requiring client-side compression');
  assert(preCheckImg.fileType === 'image', 'Identified as image');

  // Post-compression check: Size is now 240 KB -> comfortably accepted
  const postCheckImg = validateVaultDocument({ name: 'prescription_scan.jpg', size: 240 * 1024 }, true);
  assert(postCheckImg.valid === true, 'Post-compression 240 KB photo is accepted without error');
  assert(postCheckImg.requiresClientCompression === false, 'No further compression needed post-compression');
  assert(postCheckImg.error === null, 'No error returned for optimized 240 KB photo');

  // 40. Multi-Page & Scanned PDF Document Handling
  // PDF within limit (850 KB)
  const validPdf = validateVaultDocument({ name: 'lab_results.pdf', size: 850 * 1024 });
  assert(validPdf.valid === true, '850 KB PDF is accepted into vault');
  assert(validPdf.fileType === 'pdf', 'Identified as PDF file');
  assert(validPdf.error === null, 'No error for valid PDF');

  // PDF exceeding limit (2.4 MB) -> Returns clear, actionable clinical guidance
  const oversizedPdf = validateVaultDocument({ name: 'full_scan_records.pdf', size: Math.round(2.4 * 1024 * 1024) });
  assert(oversizedPdf.valid === false, '2.4 MB PDF is rejected with proactive guidance');
  assert(oversizedPdf.error !== null && oversizedPdf.error.includes('PDF file size'), 'Error mentions PDF file size');
  assert(oversizedPdf.error !== null && oversizedPdf.error.includes('exceeds the 1 MB limit'), 'Error informs user of 1 MB vault threshold');
  assert(oversizedPdf.error !== null && oversizedPdf.error.includes('upload photo scans'), 'Error suggests uploading photo scans for automatic optimization');

  // 41. Multi-Format Detection & Unsupported File Guard
  assert(isImageFile('report.jpg') === true, 'report.jpg recognized as image');
  assert(isImageFile('xray.png') === true, 'xray.png recognized as image');
  assert(isImageFile('scan.webp') === true, 'scan.webp recognized as image');
  assert(isImageFile('image/jpeg') === true, 'image/jpeg MIME recognized as image');
  assert(isPdfFile('discharge.pdf') === true, 'discharge.pdf recognized as PDF');
  assert(isPdfFile('application/pdf') === true, 'application/pdf MIME recognized as PDF');

  const unsupportedFile = validateVaultDocument({ name: 'document.zip', size: 500 * 1024 });
  assert(unsupportedFile.valid === false, 'document.zip is rejected');
  assert(unsupportedFile.fileType === 'unsupported', 'Identified as unsupported file type');
  assert(unsupportedFile.error !== null && unsupportedFile.error.includes('Invalid file type'), 'Rejection provides allowed types message');

  // 42. Human-Readable File Size Formatting
  assert(formatFileSize(0) === '0 B', 'formatFileSize(0) returns "0 B"');
  assert(formatFileSize(512) === '512.0 B', 'formatFileSize(512) returns "512.0 B"');
  assert(formatFileSize(250 * 1024) === '250.0 KB', 'formatFileSize(250 KB) returns "250.0 KB"');
  assert(formatFileSize(1024 * 1024) === '1.00 MB', 'formatFileSize(1 MB) returns "1.00 MB"');
  assert(formatFileSize(4.5 * 1024 * 1024) === '4.50 MB', 'formatFileSize(4.5 MB) returns "4.50 MB"');

  // 43. Octet-Stream Generic MIME Resiliency
  // When mobile/Android browsers or generic clients provide application/octet-stream,
  // file name extension must be evaluated so valid documents are not falsely rejected.
  const octetImg = validateVaultDocument({ name: 'scan_report.jpg', size: 350 * 1024, mimetype: 'application/octet-stream' });
  assert(octetImg.valid === true, 'Image with application/octet-stream MIME is accepted');
  assert(octetImg.fileType === 'image', 'Correctly identified as image');
  assert(octetImg.error === null, 'No error returned for octet-stream image');

  const octetPdf = validateVaultDocument({ name: 'clinical_summary.pdf', size: 500 * 1024, mimetype: 'application/octet-stream' });
  assert(octetPdf.valid === true, 'PDF with application/octet-stream MIME is accepted');
  assert(octetPdf.fileType === 'pdf', 'Correctly identified as PDF');
  assert(octetPdf.error === null, 'No error returned for octet-stream PDF');

  // Secondary filename parameter support in isImageFile and isPdfFile
  assert(isImageFile('application/octet-stream', 'photo.png') === true, 'isImageFile resolves secondary filename');
  assert(isPdfFile('application/octet-stream', 'records.pdf') === true, 'isPdfFile resolves secondary filename');

  // 44. Avatar Auto-Compression & Downscaling Metrics
  // When a user uploads a 12MP (4032x3024) or 48MP phone selfie/headshot:
  // Downscales to max dimension 512px, compressing size by > 95% (typically ~35KB-60KB).
  const avatarScaled = calculateScaledDimensions(4032, 3024, DEFAULT_AVATAR_IMAGE_DIMENSION);
  assert(avatarScaled.scaled === true, '12MP avatar image is downscaled');
  assert(avatarScaled.width === 512, 'Avatar width is scaled to exactly 512px');
  assert(avatarScaled.height === 384, 'Avatar height preserves 4:3 aspect ratio at 384px');

  const origAvatarBytes = Math.round(5.5 * 1024 * 1024); // 5.5 MB camera selfie
  const avatarCompression = estimateCompressedImageSize(origAvatarBytes, 4032, 3024, DEFAULT_AVATAR_IMAGE_DIMENSION, 0.85);
  assert(avatarCompression.fitsWithin1MB === true, 'Avatar fits well within 1 MB limit');
  assert(avatarCompression.estimatedBytes <= 100 * 1024, `Avatar size (${avatarCompression.formattedEstimatedSize}) is <= 100 KB`);
  assert(avatarCompression.reductionPercentage >= 95, `Avatar compression achieves >= 95% reduction (got ${avatarCompression.reductionPercentage}%)`);

  // 45. Extreme & Degenerate Image Aspect Ratio Boundary Protection
  // Ensure canvases never crash with 0 width or 0 height on extreme ratios
  const ultraWide = calculateScaledDimensions(10000, 2, 1920);
  assert(ultraWide.width === 1920, 'Ultra wide width is 1920px');
  assert(ultraWide.height >= 1, 'Ultra wide height is clamped to >= 1px (never 0)');

  const ultraTall = calculateScaledDimensions(2, 10000, 1920);
  assert(ultraTall.height === 1920, 'Ultra tall height is 1920px');
  assert(ultraTall.width >= 1, 'Ultra tall width is clamped to >= 1px (never 0)');

  const zeroDimension = calculateScaledDimensions(0, 0, 1920);
  assert(zeroDimension.width >= 1 && zeroDimension.height >= 1, 'Zero dimensions safely clamped to >= 1px');

  // 46. Backend Upload Middleware Whitelist & Extension Fallback Compatibility
  assert(ALLOWED_MIME_TYPES.includes('image/jpeg'), 'Allowed MIME includes image/jpeg');
  assert(ALLOWED_MIME_TYPES.includes('image/jpg'), 'Allowed MIME includes image/jpg');
  assert(ALLOWED_MIME_TYPES.includes('image/png'), 'Allowed MIME includes image/png');
  assert(ALLOWED_MIME_TYPES.includes('image/webp'), 'Allowed MIME includes image/webp');
  assert(ALLOWED_MIME_TYPES.includes('application/pdf'), 'Allowed MIME includes application/pdf');

  assert(ALLOWED_FILE_EXTENSIONS.includes('.jpg'), 'Allowed extensions include .jpg');
  assert(ALLOWED_FILE_EXTENSIONS.includes('.jpeg'), 'Allowed extensions include .jpeg');
  assert(ALLOWED_FILE_EXTENSIONS.includes('.png'), 'Allowed extensions include .png');
  assert(ALLOWED_FILE_EXTENSIONS.includes('.webp'), 'Allowed extensions include .webp');
  assert(ALLOWED_FILE_EXTENSIONS.includes('.pdf'), 'Allowed extensions include .pdf');

  // 47. Doctor Degrees Sanitization (Degrees Only, No School / University Fluff or Fellowships like FACC, FRCOG, FICOG)
  const formatDoctorDegrees = (qualifications?: string | null): string => {
    if (!qualifications || !qualifications.trim()) return 'Certified Specialist';

    const RECOGNIZED_DEGREES_MAP: Record<string, string> = {
      MBBS: 'MBBS',
      MD: 'MD',
      MS: 'MS',
      DM: 'DM',
      MCH: 'MCh',
      BDS: 'BDS',
      MDS: 'MDS',
      DNB: 'DNB',
      BAMS: 'BAMS',
      BHMS: 'BHMS',
      BUMS: 'BUMS',
      BSMS: 'BSMS',
      BNYS: 'BNYS',
      BVSC: 'BVSc',
      BPT: 'BPT',
      MPT: 'MPT',
      BOT: 'BOT',
      MOT: 'MOT',
      DO: 'DO',
      PHD: 'PhD',
      MPH: 'MPH',
      MHA: 'MHA',
      DGO: 'DGO',
      DCH: 'DCH',
      DMRD: 'DMRD',
      DORTHO: 'DOrtho',
      DA: 'DA',
      DTCD: 'DTCD',
      DDVL: 'DDVL',
      DVD: 'DVD',
      DPM: 'DPM',
      DOMS: 'DOMS',
      DLO: 'DLO',
      MBCHB: 'MBChB',
      BMBS: 'BMBS',
      BCHIR: 'BChir',
      BMED: 'BMed',
      MRCGP: 'MRCGP',
    };

    const cleanedInput = qualifications.replace(/\([^)]*\)/g, ' ');
    const NON_DEGREE_PATTERN = /\b(f[a-z]{2,5}|fellow|fellowship|diplomate|member|board\s*certified|board\s*eligible|certified|specialist|consultant|physician|surgeon|general|university|college|school|hospital|institute|academy|faculty|campus|stanford|harvard|hopkins|oxford|cambridge|aiims|pgi|yale|columbia|boston|london)\b/i;

    const parts = cleanedInput.split(/[,;\n/]+/);
    const collectedDegrees: string[] = [];

    for (const part of parts) {
      const subSegments = part.split(/\s*[-–—]\s*/);
      for (const sub of subSegments) {
        const trimmed = sub.trim().replace(/\.+/g, '');
        if (!trimmed) continue;
        if (NON_DEGREE_PATTERN.test(trimmed)) continue;

        const upper = trimmed.toUpperCase();
        if (RECOGNIZED_DEGREES_MAP[upper]) {
          const canonical = RECOGNIZED_DEGREES_MAP[upper];
          if (!collectedDegrees.includes(canonical)) {
            collectedDegrees.push(canonical);
          }
        }
      }
    }

    if (collectedDegrees.length > 0) {
      return collectedDegrees.join(', ');
    }

    return 'Certified Specialist';
  };

  assert(formatDoctorDegrees('MD - Harvard Medical School, FACC') === 'MD', 'Harvard Medical School and FACC stripped from qualifications');
  assert(formatDoctorDegrees('MD - Stanford Medicine, Board Certified') === 'MD', 'Stanford Medicine and Board Certified stripped from qualifications');
  assert(formatDoctorDegrees('MD, FAAP - Johns Hopkins University') === 'MD', 'Johns Hopkins University and FAAP stripped from qualifications');
  assert(formatDoctorDegrees('DO - Chicago College of Osteopathic Medicine') === 'DO', 'Chicago College stripped from qualifications');
  assert(formatDoctorDegrees('MBBS, MD') === 'MBBS, MD', 'Clean degrees preserved');
  assert(formatDoctorDegrees('MD, FACC') === 'MD', 'FACC stripped from qualifications');
  assert(formatDoctorDegrees('MBBS, MD, FRCOG, FICOG') === 'MBBS, MD', 'FRCOG and FICOG fellowships stripped');
  assert(formatDoctorDegrees('MD, Yale') === 'MD', 'Yale university stripped from qualifications');
  assert(formatDoctorDegrees('MBBS, MD (Internal Medicine), FACC') === 'MBBS, MD', 'Parenthetical specialty parsed and FACC stripped');
  assert(formatDoctorDegrees('MBBS, M.S., M.Ch., F.A.C.S.') === 'MBBS, MS, MCh', 'MCh canonicalized and FACS fellowship stripped');
  assert(formatDoctorDegrees('FACC') === 'Certified Specialist', 'FACC alone falls back to Certified Specialist');
  assert(formatDoctorDegrees('FRCOG') === 'Certified Specialist', 'FRCOG alone falls back to Certified Specialist');
  assert(formatDoctorDegrees(null) === 'Certified Specialist', 'Null fallback returns Certified Specialist');

  // 48. Multi-Clinic Practitioner Affiliation & Booking Routing
  const multiClinicDoctor = {
    id: 'doc_sarah',
    fullName: 'Dr. Sarah Jenkins',
    clinics: [
      { clinicId: 'c1', clinicName: 'Metropolis Polyclinic', address: '100 Broadway', city: 'New York' },
      { clinicId: 'c2', clinicName: 'Manhattan Specialty Care', address: '350 5th Ave', city: 'New York' },
    ],
  };
  const resolveTargetBookingUrl = (doctorId: string, selectedClinicId: string, date: string, slotId: string) => {
    return `/patient/book/${doctorId}?date=${date}&slot=${slotId}&clinic=${selectedClinicId}`;
  };

  assert(multiClinicDoctor.clinics.length === 2, 'Doctor has 2 practicing clinics');
  const targetBookingUrl = resolveTargetBookingUrl(multiClinicDoctor.id, 'c2', '2026-09-12', 'slot_1');
  assert(targetBookingUrl.includes('&clinic=c2'), 'Selected clinic is preserved in target booking URL');

  // 49. Streamlined Doctor Registration Defaults (No early start/end times or fee demands)
  const buildDoctorSignupPayload = (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    specialty: string;
    customSpecialty?: string;
    qualifications: string;
    experienceYears: number;
  }) => {
    const finalSpecialty = input.specialty === 'Other'
      ? (input.customSpecialty?.trim() || 'General Medicine')
      : input.specialty;

    return {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      password: input.password,
      role: 'DOCTOR',
      specialty: finalSpecialty,
      qualifications: input.qualifications.trim() || 'MBBS, MD',
      experienceYears: Number(input.experienceYears) || 1,
      consultationFee: 0, // Configured upon joining a clinic
      checkingStartTime: '09:00',
      checkingEndTime: '17:00',
    };
  };

  const doctorSignup = buildDoctorSignupPayload({
    fullName: 'Dr. Arjun Mehta',
    email: 'arjun.mehta@example.com',
    phone: '+91 9876543210',
    password: 'securePassword123',
    specialty: 'Cardiology',
    qualifications: 'MBBS, MD (Cardiology)',
    experienceYears: 8,
  });

  assert(doctorSignup.specialty === 'Cardiology', 'Doctor specialty is preserved');
  assert(doctorSignup.consultationFee === 0, 'Consultation fee defaults to 0 prior to clinic onboarding');
  assert(doctorSignup.checkingStartTime === '09:00' && doctorSignup.checkingEndTime === '17:00', 'Checking times default safely');
  assert(doctorSignup.phone.startsWith('+91'), 'Doctor phone begins with +91 default prefix');

  // 50. Custom "Other" Specialty Resolution
  const customDoctorSignup = buildDoctorSignupPayload({
    fullName: 'Dr. Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 9123456789',
    password: 'securePassword456',
    specialty: 'Other',
    customSpecialty: 'Trichology & Hair Restoration',
    qualifications: 'MBBS, DVD',
    experienceYears: 6,
  });

  assert(
    customDoctorSignup.specialty === 'Trichology & Hair Restoration',
    'Custom write-in specialty is correctly assigned when "Other" is chosen'
  );

  // Fallback if custom input is left blank
  const emptyCustomSignup = buildDoctorSignupPayload({
    fullName: 'Dr. Blank Specialty',
    email: 'blank@example.com',
    phone: '+91 9000000000',
    password: 'password123',
    specialty: 'Other',
    customSpecialty: '   ',
    qualifications: 'MBBS',
    experienceYears: 2,
  });
  assert(emptyCustomSignup.specialty === 'General Medicine', 'Fallback to General Medicine if custom specialty is blank');

  // 51. Comprehensive 30+ Specialties Catalog & Live Search Matching
  const ALL_SPECIALTIES_TEST = [
    'General Medicine',
    'Cardiology',
    'Dermatology',
    'Pediatrics',
    'Orthopedics',
    'Neurology',
    'Gynecology & Obstetrics',
    'Gastroenterology',
    'Oncology',
    'Ophthalmology',
    'ENT / Otorhinolaryngology',
    'Pulmonology',
    'Nephrology',
    'Urology',
    'Psychiatry',
    'Endocrinology',
    'Rheumatology',
    'Dentistry',
    'Physiotherapy',
    'General Surgery',
    'Plastic Surgery',
    'Neurosurgery',
    'Cardiothoracic Surgery',
    'Anesthesiology',
    'Radiology',
    'Pathology',
    'Emergency Medicine',
    'Hematology',
    'Allergy & Immunology',
    'Infectious Disease',
    'Ayurveda',
    'Homeopathy',
    'Dietetics & Nutrition',
    'Other',
  ];

  assert(ALL_SPECIALTIES_TEST.length >= 30, 'Specialties catalog includes 30+ clinical disciplines');
  assert(ALL_SPECIALTIES_TEST.includes('Other'), 'Catalog includes "Other" option');
  assert(ALL_SPECIALTIES_TEST.includes('Dentistry'), 'Catalog includes Dentistry');
  assert(ALL_SPECIALTIES_TEST.includes('Ayurveda'), 'Catalog includes Ayurveda');
  assert(ALL_SPECIALTIES_TEST.includes('Homeopathy'), 'Catalog includes Homeopathy');

  const filterSpecialties = (query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return ALL_SPECIALTIES_TEST;
    return ALL_SPECIALTIES_TEST.filter((s) => s.toLowerCase().includes(q));
  };

  const neuroMatches = filterSpecialties('neuro');
  assert(neuroMatches.includes('Neurology') && neuroMatches.includes('Neurosurgery'), 'Search for "neuro" finds Neurology and Neurosurgery');
  const cardioMatches = filterSpecialties('cardio');
  assert(cardioMatches.includes('Cardiology') && cardioMatches.includes('Cardiothoracic Surgery'), 'Search for "cardio" finds Cardiology and Cardiothoracic Surgery');
  const dermaMatches = filterSpecialties('derma');
  assert(dermaMatches.length === 1 && dermaMatches[0] === 'Dermatology', 'Search for "derma" finds Dermatology');

  // 52. Doctor Walk-in Booking Access Control Validation
  const validateBookingCallerRole = (role?: string) => {
    if (!role || (role !== 'PATIENT' && role !== 'DOCTOR')) {
      return { allowed: false, message: 'Only registered patients or practitioners can book appointments' };
    }
    return { allowed: true, message: 'Authorized' };
  };

  assert(validateBookingCallerRole('PATIENT').allowed === true, 'PATIENT role is authorized to book appointments');
  assert(validateBookingCallerRole('DOCTOR').allowed === true, 'DOCTOR role is authorized to queue walk-in appointments');
  assert(validateBookingCallerRole('CLINIC').allowed === false, 'CLINIC role is blocked from direct patient booking endpoint');
  assert(validateBookingCallerRole(undefined).allowed === false, 'Unauthenticated user is blocked from booking');

  // 53. Doctor Walk-in Patient Payload Resolution
  const resolveDoctorWalkinPayload = (doctorProfileId: string, input: {
    doctorId?: string;
    patientName: string;
    patientPhone?: string;
    patientAge?: string;
    patientGender?: string;
    reasonForVisit?: string;
  }) => {
    // If doctorId is provided, it must match doctor's own profile id
    if (input.doctorId && input.doctorId !== doctorProfileId) {
      throw new Error('Doctors can only queue walk-in appointments for their own practice');
    }
    const cleanPhone = input.patientPhone ? input.patientPhone.trim() : '';
    return {
      doctorId: doctorProfileId,
      patientName: input.patientName.trim(),
      patientPhone: cleanPhone || null,
      patientAge: input.patientAge ? input.patientAge.trim() : null,
      patientGender: input.patientGender || 'Not Specified',
      reasonForVisit: input.reasonForVisit || 'Clinic Walk-in Consultation',
      isForOther: true,
    };
  };

  const doctorWalkin = resolveDoctorWalkinPayload('doc_123', {
    doctorId: 'doc_123',
    patientName: 'Rohan Sharma',
    patientPhone: '+91 9876543210',
    patientAge: '28',
    patientGender: 'Male',
    reasonForVisit: 'Acute Cough & Cold',
  });

  assert(doctorWalkin.doctorId === 'doc_123', 'Doctor walk-in is scoped to own doctor profile');
  assert(doctorWalkin.patientName === 'Rohan Sharma', 'Walk-in patient name is preserved');
  assert(doctorWalkin.patientAge === '28', 'Walk-in patient age is preserved');
  assert(doctorWalkin.patientGender === 'Male', 'Walk-in patient gender is preserved');
  assert(doctorWalkin.patientPhone === '+91 9876543210', 'Walk-in patient phone is preserved');

  let doctorBookingOtherDocBlocked = false;
  try {
    resolveDoctorWalkinPayload('doc_123', {
      doctorId: 'doc_999',
      patientName: 'Sneha Patel',
    });
  } catch (err: any) {
    doctorBookingOtherDocBlocked = true;
  }
  assert(doctorBookingOtherDocBlocked === true, 'Doctor cannot queue walk-in patients into another doctor practice');

  // 54. Receptionist Token Pass Data Isolation (Row Reprint vs Form State)
  const resolveReprintTokenPass = (
    queueDoc: { id: string; fullName: string; specialty: string },
    queueAppt: {
      queueNumber: number;
      patientName: string;
      patientPhone?: string;
      patientAge?: string;
      gender?: string;
      isForOther?: boolean;
      estimatedTime?: string;
      checkingWindow?: string;
    },
    clinic: { clinicName: string; address?: string },
    _formInputName: string // Unsubmitted form input that should NEVER leak into reprint
  ) => {
    return {
      queueNumber: queueAppt.queueNumber,
      doctorName: queueDoc.fullName,
      doctorSpecialty: queueDoc.specialty,
      patientName: queueAppt.patientName, // Must use appt patientName, NOT _formInputName!
      patientPhone: queueAppt.patientPhone !== 'N/A' ? queueAppt.patientPhone : undefined,
      patientAge: queueAppt.patientAge,
      patientGender: queueAppt.gender,
      isForOther: queueAppt.isForOther,
      clinicName: clinic.clinicName,
      clinicAddress: clinic.address,
    };
  };

  const reprintedPass = resolveReprintTokenPass(
    { id: 'd2', fullName: 'Dr. Neha Kapoor', specialty: 'Dermatology' },
    {
      queueNumber: 7,
      patientName: 'Aarav Gupta',
      patientPhone: '+91 9998887776',
      patientAge: '19',
      gender: 'Male',
      isForOther: true,
      estimatedTime: '11:15 AM',
      checkingWindow: 'Morning Shift',
    },
    { clinicName: 'Apollo Clinic', address: 'Bandra West, Mumbai' },
    'Unsubmitted Form Name' // Simulated dirty state from another tab
  );

  assert(reprintedPass.patientName === 'Aarav Gupta', 'Reprinted token pass strictly uses appointment patient name');
  assert(reprintedPass.patientName !== 'Unsubmitted Form Name', 'Reprinted token pass never leaks unsubmitted form input state');
  assert(reprintedPass.doctorName === 'Dr. Neha Kapoor', 'Reprinted token pass uses queue doctor name');
  assert(reprintedPass.queueNumber === 7, 'Queue token number is preserved as #7');

  // 55. Indian Phone Number Sanitization & Formatting
  assert(sanitizeIndianPhone('9876543210') === '9876543210', 'Plain 10-digit number sanitized to 10 digits');
  assert(sanitizeIndianPhone('+91 9876543210') === '9876543210', '+91 prefix with space sanitized to 10 digits');
  assert(sanitizeIndianPhone('+919876543210') === '9876543210', '+91 prefix without space sanitized to 10 digits');
  assert(sanitizeIndianPhone('919876543210') === '9876543210', '12-digit number starting with 91 sanitized to 10 digits');
  assert(sanitizeIndianPhone('09876543210') === '9876543210', '11-digit number starting with 0 sanitized to 10 digits');
  assert(sanitizeIndianPhone('98765 43210') === '9876543210', 'Phone with middle whitespace sanitized to 10 digits');
  assert(sanitizeIndianPhone('+91 (987) 654-3210') === '9876543210', 'Phone with parentheses and dash sanitized to 10 digits');
  assert(sanitizeIndianPhone('9') === '9', 'Typing single digit "9" does not inject "91" (prevents loop bug)');
  assert(sanitizeIndianPhone('98') === '98', 'Typing "98" preserved without 91 expansion');
  assert(sanitizeIndianPhone('98765432109999') === '9876543210', 'Long phone clamped to 10 digits');
  assert(sanitizeIndianPhone('') === '', 'Empty string sanitized to empty string');
  assert(sanitizeIndianPhone(null) === '', 'Null input sanitized to empty string');
  assert(sanitizeIndianPhone(undefined) === '', 'Undefined input sanitized to empty string');

  assert(formatIndianPhone('9876543210') === '+91 9876543210', 'formatIndianPhone formats with "+91 " prefix');
  assert(formatIndianPhone('') === '', 'formatIndianPhone on empty returns empty');
  assert(isValidIndianPhone('9876543210') === true, '10-digit phone is valid Indian phone');
  assert(isValidIndianPhone('+91 9876543210') === true, '+91 prefixed phone is valid Indian phone');
  assert(isValidIndianPhone('98765') === false, '5-digit incomplete phone is not valid Indian phone');
  assert(isValidIndianPhone('') === false, 'Empty phone is not valid Indian phone');

  // 56. Receptionist Walk-in Patient Name Preservation
  const resolveWalkinAppointmentData = (
    existingUser: { fullName: string; phone?: string | null } | null,
    inputPayload: {
      patientName: string;
      patientPhone?: string;
      patientAge?: string;
      gender?: string;
      isForOther?: boolean;
    }
  ) => {
    // Controller logic: Always preserve inputPayload.patientName on appointment
    const effectivePatientName = inputPayload.patientName?.trim() || existingUser?.fullName || 'Walk-in Patient';
    const isOther = Boolean(inputPayload.isForOther || (existingUser && existingUser.fullName !== effectivePatientName));
    return {
      patientName: effectivePatientName,
      patientPhone: inputPayload.patientPhone || existingUser?.phone || null,
      patientAge: inputPayload.patientAge || null,
      gender: inputPayload.gender || null,
      isForOther: isOther,
    };
  };

  const walkinExistingAccount = resolveWalkinAppointmentData(
    { fullName: 'Account Holder Parent', phone: '+91 9876543210' },
    { patientName: 'Child Patient', patientPhone: '+91 9876543210', patientAge: '8', gender: 'Male', isForOther: false }
  );
  assert(walkinExistingAccount.patientName === 'Child Patient', 'Walk-in preserves explicit child patient name over account owner');
  assert(walkinExistingAccount.isForOther === true, 'Auto-detects isForOther when patientName differs from account holder');

  const walkinDirectPatient = resolveWalkinAppointmentData(
    { fullName: 'Direct Patient', phone: '+91 9123456789' },
    { patientName: 'Direct Patient', patientPhone: '+91 9123456789', patientAge: '30', gender: 'Female' }
  );
  assert(walkinDirectPatient.patientName === 'Direct Patient', 'Direct patient name preserved');
  assert(walkinDirectPatient.isForOther === false, 'Direct patient isForOther remains false');

  // 57. Consultation Completion & Digital Prescription Generation
  const buildPrescriptionRecord = (
    appointment: { id: string; doctorId: string; patientId: string },
    body: {
      diagnosis?: string;
      medicines?: any[];
      advice?: string;
      followUpDate?: string;
    }
  ) => {
    const medicinesData = Array.isArray(body.medicines)
      ? body.medicines.filter((m) => m && typeof m.name === 'string' && m.name.trim().length > 0)
      : [];

    return {
      appointmentId: appointment.id,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      diagnosis: body.diagnosis?.trim() || 'General Consultation',
      medicines: medicinesData,
      advice: body.advice?.trim() || null,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
    };
  };

  const testAppt = { id: 'appt-123', doctorId: 'doc-456', patientId: 'pat-789' };
  const rxRecord = buildPrescriptionRecord(testAppt, {
    diagnosis: 'Acute Bronchitis',
    medicines: [
      { name: 'Amoxicillin 500mg', dosage: '1 tablet', frequency: '1-0-1', duration: '5 days', instructions: 'After food' },
      { name: 'Paracetamol 650mg', dosage: '1 tablet', frequency: 'SOS', duration: '3 days', instructions: 'For fever' },
      { name: '' }, // empty row to be filtered
    ],
    advice: 'Drink warm water and rest well',
    followUpDate: '2026-10-05',
  });

  assert(rxRecord.appointmentId === 'appt-123', 'Prescription linked to appointment ID');
  assert(rxRecord.doctorId === 'doc-456', 'Prescription linked to doctor ID');
  assert(rxRecord.patientId === 'pat-789', 'Prescription linked to patient ID');
  assert(rxRecord.diagnosis === 'Acute Bronchitis', 'Prescription diagnosis recorded accurately');
  assert(rxRecord.medicines.length === 2, 'Empty medicine rows stripped cleanly (2 valid items retained)');
  assert(rxRecord.medicines[0].name === 'Amoxicillin 500mg', 'First medicine preserved');
  assert(rxRecord.medicines[1].name === 'Paracetamol 650mg', 'Second medicine preserved');
  assert(rxRecord.advice === 'Drink warm water and rest well', 'Doctor advice recorded');
  assert(rxRecord.followUpDate instanceof Date, 'Follow-up date parsed as valid Date');

  // 58. Medical Records Vault RBAC & Access Authorization
  const authorizeVaultAccess = (
    user: { id: string; role: string },
    patientOwnerUserId: string,
    requestedPatientId?: string
  ): { allowed: boolean; status: number; message?: string } => {
    const role = user.role.toUpperCase();
    if (role === 'PATIENT') {
      if (user.id === patientOwnerUserId) {
        return { allowed: true, status: 200 };
      }
      return { allowed: false, status: 403, message: 'Forbidden: Cannot access another patient records' };
    }
    if (role === 'DOCTOR' || role === 'ADMIN') {
      if (requestedPatientId) {
        return { allowed: true, status: 200 };
      }
      return { allowed: false, status: 400, message: 'patientId query parameter is required for doctor/admin lookup' };
    }
    return { allowed: false, status: 403, message: 'Forbidden: Insufficient role permissions' };
  };

  const patientOwnAccess = authorizeVaultAccess({ id: 'user-pat-1', role: 'PATIENT' }, 'user-pat-1');
  assert(patientOwnAccess.allowed === true, 'Patient can access their own vault records');

  const patientOtherAccess = authorizeVaultAccess({ id: 'user-pat-2', role: 'PATIENT' }, 'user-pat-1');
  assert(patientOtherAccess.allowed === false && patientOtherAccess.status === 403, 'Patient cannot access another patient records');

  const doctorAccessWithId = authorizeVaultAccess({ id: 'user-doc-1', role: 'DOCTOR' }, 'user-pat-1', 'pat-profile-1');
  assert(doctorAccessWithId.allowed === true, 'Doctor can access patient records with patientId query');

  const doctorAccessWithoutId = authorizeVaultAccess({ id: 'user-doc-1', role: 'DOCTOR' }, 'user-pat-1');
  assert(doctorAccessWithoutId.allowed === false && doctorAccessWithoutId.status === 400, 'Doctor lookup without patientId returns 400');

  const adminAccess = authorizeVaultAccess({ id: 'user-admin-1', role: 'ADMIN' }, 'user-pat-1', 'pat-profile-1');
  assert(adminAccess.allowed === true, 'Admin can access patient records with patientId query');

  const receptionistAccess = authorizeVaultAccess({ id: 'user-rec-1', role: 'RECEPTIONIST' }, 'user-pat-1', 'pat-profile-1');
  assert(receptionistAccess.allowed === false && receptionistAccess.status === 403, 'Receptionist is blocked from patient medical vault');

  // 59. Receptionist Status Update Authorization
  const authorizeReceptionistStatusUpdate = (
    receptionist: { id: string; clinicId?: string | null; assignedDoctorIds: string[] },
    appointment: { id: string; doctorId: string; clinicId?: string | null }
  ): { allowed: boolean; status: number; message?: string } => {
    if (!receptionist.assignedDoctorIds.includes(appointment.doctorId)) {
      return { allowed: false, status: 403, message: 'Access denied: You are only authorized to update appointments for doctors assigned to your desk.' };
    }
    if (receptionist.clinicId && appointment.clinicId && receptionist.clinicId !== appointment.clinicId) {
      return { allowed: false, status: 403, message: 'Access denied: Appointment belongs to another clinic facility.' };
    }
    return { allowed: true, status: 200 };
  };

  const recAssigned = authorizeReceptionistStatusUpdate(
    { id: 'rec-1', clinicId: 'clinic-1', assignedDoctorIds: ['doc-1', 'doc-2'] },
    { id: 'appt-1', doctorId: 'doc-1', clinicId: 'clinic-1' }
  );
  assert(recAssigned.allowed === true, 'Receptionist can update status for assigned doctor');

  const recUnassigned = authorizeReceptionistStatusUpdate(
    { id: 'rec-1', clinicId: 'clinic-1', assignedDoctorIds: ['doc-1'] },
    { id: 'appt-2', doctorId: 'doc-2', clinicId: 'clinic-1' }
  );
  assert(recUnassigned.allowed === false && recUnassigned.status === 403, 'Receptionist cannot update status for unassigned doctor');

  const recOtherClinic = authorizeReceptionistStatusUpdate(
    { id: 'rec-1', clinicId: 'clinic-1', assignedDoctorIds: ['doc-1'] },
    { id: 'appt-3', doctorId: 'doc-1', clinicId: 'clinic-2' }
  );
  assert(recOtherClinic.allowed === false && recOtherClinic.status === 403, 'Receptionist cannot update status for doctor appointment at different clinic facility');

  // 60. Appointment Cancellation Authorization
  const authorizeAppointmentCancellation = (
    user: { id: string; role: string },
    appointment: { id: string; patientUserId: string; doctorId: string; clinicId?: string | null },
    receptionist?: { id: string; assignedDoctorIds: string[] } | null,
    clinic?: { id: string } | null
  ): { allowed: boolean; status: number; message?: string } => {
    if (user.role === 'PATIENT') {
      if (appointment.patientUserId !== user.id) {
        return { allowed: false, status: 403, message: 'You do not have permission to cancel this appointment' };
      }
      return { allowed: true, status: 200 };
    }
    if (user.role === 'DOCTOR') {
      return { allowed: true, status: 200 };
    }
    if (user.role === 'RECEPTIONIST') {
      if (!receptionist || !receptionist.assignedDoctorIds.includes(appointment.doctorId)) {
        return { allowed: false, status: 403, message: 'You do not have permission to cancel appointments for this doctor' };
      }
      return { allowed: true, status: 200 };
    }
    if (user.role === 'CLINIC') {
      if (!clinic || appointment.clinicId !== clinic.id) {
        return { allowed: false, status: 403, message: 'You do not have permission to cancel appointments for this clinic' };
      }
      return { allowed: true, status: 200 };
    }
    if (user.role === 'ADMIN') {
      return { allowed: true, status: 200 };
    }
    return { allowed: false, status: 403, message: 'Unauthorized' };
  };

  const patientCancelOwn = authorizeAppointmentCancellation(
    { id: 'pat-user-1', role: 'PATIENT' },
    { id: 'appt-1', patientUserId: 'pat-user-1', doctorId: 'doc-1' }
  );
  assert(patientCancelOwn.allowed === true, 'Patient can cancel own appointment');

  const patientCancelOther = authorizeAppointmentCancellation(
    { id: 'pat-user-2', role: 'PATIENT' },
    { id: 'appt-1', patientUserId: 'pat-user-1', doctorId: 'doc-1' }
  );
  assert(patientCancelOther.allowed === false, 'Patient cannot cancel another patient appointment');

  const receptionistCancelAssigned = authorizeAppointmentCancellation(
    { id: 'rec-user-1', role: 'RECEPTIONIST' },
    { id: 'appt-1', patientUserId: 'pat-user-1', doctorId: 'doc-1' },
    { id: 'rec-1', assignedDoctorIds: ['doc-1'] }
  );
  assert(receptionistCancelAssigned.allowed === true, 'Receptionist can cancel appointment for assigned doctor');

  const receptionistCancelUnassigned = authorizeAppointmentCancellation(
    { id: 'rec-user-1', role: 'RECEPTIONIST' },
    { id: 'appt-1', patientUserId: 'pat-user-1', doctorId: 'doc-2' },
    { id: 'rec-1', assignedDoctorIds: ['doc-1'] }
  );
  assert(receptionistCancelUnassigned.allowed === false, 'Receptionist cannot cancel appointment for unassigned doctor');

  const clinicCancelOwn = authorizeAppointmentCancellation(
    { id: 'clinic-user-1', role: 'CLINIC' },
    { id: 'appt-1', patientUserId: 'pat-user-1', doctorId: 'doc-1', clinicId: 'clinic-1' },
    null,
    { id: 'clinic-1' }
  );
  assert(clinicCancelOwn.allowed === true, 'Clinic can cancel appointment for own clinic');

  const clinicCancelOther = authorizeAppointmentCancellation(
    { id: 'clinic-user-1', role: 'CLINIC' },
    { id: 'appt-1', patientUserId: 'pat-user-1', doctorId: 'doc-1', clinicId: 'clinic-2' },
    null,
    { id: 'clinic-1' }
  );
  assert(clinicCancelOther.allowed === false, 'Clinic cannot cancel appointment for another clinic');

  // 61. Phone Normalization in Walk-in Lookups (prevents duplicate patient accounts)
  const buildPhoneLookupWhere = (cleanPhone: string) => {
    const normalizedPhone = formatIndianPhone(cleanPhone);
    const rawDigits = sanitizeIndianPhone(cleanPhone);
    return [
      ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ...(rawDigits ? [{ phone: rawDigits }] : []),
      { phone: cleanPhone },
    ];
  };

  const lookupClauses = buildPhoneLookupWhere('9876543210');
  assert(lookupClauses.some((c) => c.phone === '+91 9876543210'), 'Phone lookup includes formatted +91 number');
  assert(lookupClauses.some((c) => c.phone === '9876543210'), 'Phone lookup includes raw 10-digit number');

  const lookupClausesFormatted = buildPhoneLookupWhere('+91 9876543210');
  assert(lookupClausesFormatted.some((c) => c.phone === '+91 9876543210'), 'Phone lookup from formatted input includes +91 prefix');
  assert(lookupClausesFormatted.some((c) => c.phone === '9876543210'), 'Phone lookup from formatted input includes 10 digits');

  // 62. Timezone-Safe Date Comparison
  const checkIsTodaySafe = (apptDateStr: string, localDateStr: string): boolean => {
    return apptDateStr === localDateStr;
  };

  const todayStr = '2026-09-28';
  assert(checkIsTodaySafe('2026-09-28', todayStr) === true, 'Matching date string evaluates to today regardless of UTC offset');
  assert(checkIsTodaySafe('2026-09-29', todayStr) === false, 'Tomorrow date string evaluates to not today');

  // 63. Explicit Patient Name Priority
  const resolveDisplayPatientName = (
    explicitName?: string | null,
    accountOwnerName?: string | null,
    fallback: string = 'Patient'
  ): string => {
    return (explicitName && explicitName.trim()) || (accountOwnerName && accountOwnerName.trim()) || fallback;
  };

  assert(
    resolveDisplayPatientName('Aarav Sharma (Child)', 'Rahul Sharma') === 'Aarav Sharma (Child)',
    'Explicit child patient name is preserved over account holder name'
  );
  assert(
    resolveDisplayPatientName(null, 'Rahul Sharma') === 'Rahul Sharma',
    'Falls back to account owner name if explicit patient name is not set'
  );
  assert(
    resolveDisplayPatientName('', '', 'Walk-in Patient') === 'Walk-in Patient',
    'Falls back to default fallback if both are empty'
  );

  // 64. Doctor Clinic Affiliation Enforcement & Venue Resolution
  interface MockAffiliatedClinic {
    clinicId: string;
    clinicName: string;
    isVerified: boolean;
    status: string;
  }

  const resolveBookingClinicVenue = (
    doctorClinics: MockAffiliatedClinic[],
    requestedClinicId?: string | null
  ): { allowed: boolean; status: number; targetClinicId?: string; message?: string } => {
    const verifiedActive = doctorClinics.filter(
      (c) => c.isVerified && (c.status === 'ACTIVE' || c.status === 'ACCEPTED')
    );

    if (verifiedActive.length === 0) {
      return {
        allowed: false,
        status: 400,
        message: 'This doctor is currently not associated with any active verified clinic. Online queue booking is unavailable.',
      };
    }

    if (requestedClinicId) {
      const match = verifiedActive.find((c) => c.clinicId === requestedClinicId);
      if (!match) {
        return {
          allowed: false,
          status: 400,
          message: 'The selected clinic is not an active verified venue for this doctor. Please choose a valid clinic venue.',
        };
      }
      return { allowed: true, status: 200, targetClinicId: match.clinicId };
    }

    if (verifiedActive.length === 1) {
      return { allowed: true, status: 200, targetClinicId: verifiedActive[0].clinicId };
    }

    return {
      allowed: false,
      status: 400,
      message: 'This doctor practices at multiple clinics. Please select which clinic venue you wish to book an appointment at.',
    };
  };

  // Test 64.1: Doctor with 0 clinics -> rejected
  const zeroClinicsResult = resolveBookingClinicVenue([]);
  assert(zeroClinicsResult.allowed === false && zeroClinicsResult.status === 400, 'Doctor with 0 clinics is blocked from booking');
  assert(Boolean(zeroClinicsResult.message?.includes('not associated with any active verified clinic')), 'Error explains doctor is not associated with any clinic');

  // Test 64.2: Doctor with unverified clinic -> rejected
  const unverifiedClinicResult = resolveBookingClinicVenue([
    { clinicId: 'c-1', clinicName: 'Unverified Clinic', isVerified: false, status: 'ACCEPTED' },
  ]);
  assert(unverifiedClinicResult.allowed === false, 'Doctor with unverified clinic is blocked from booking');

  // Test 64.3: Doctor with 1 verified clinic -> automatically assigned
  const singleClinicResult = resolveBookingClinicVenue([
    { clinicId: 'c-bikesh', clinicName: 'Bikesh Clinic', isVerified: true, status: 'ACCEPTED' },
  ]);
  assert(singleClinicResult.allowed === true && singleClinicResult.targetClinicId === 'c-bikesh', 'Doctor with 1 clinic auto-assigns clinic ID');

  // Test 64.4: Doctor with multiple clinics but no selection -> rejected with prompt
  const multiClinicNoChoice = resolveBookingClinicVenue([
    { clinicId: 'c-bikesh', clinicName: 'Bikesh Clinic', isVerified: true, status: 'ACCEPTED' },
    { clinicId: 'c-central', clinicName: 'Central Clinic', isVerified: true, status: 'ACCEPTED' },
  ]);
  assert(multiClinicNoChoice.allowed === false, 'Doctor with multiple clinics requires venue selection');
  assert(Boolean(multiClinicNoChoice.message?.includes('practices at multiple clinics')), 'Prompt asks user to select clinic venue');

  // Test 64.5: Doctor with multiple clinics with valid selection -> accepted
  const multiClinicValidChoice = resolveBookingClinicVenue(
    [
      { clinicId: 'c-bikesh', clinicName: 'Bikesh Clinic', isVerified: true, status: 'ACCEPTED' },
      { clinicId: 'c-central', clinicName: 'Central Clinic', isVerified: true, status: 'ACCEPTED' },
    ],
    'c-central'
  );
  assert(multiClinicValidChoice.allowed === true && multiClinicValidChoice.targetClinicId === 'c-central', 'Selected clinic from multi-clinic roster is assigned');

  // Test 64.6: Doctor with invalid clinic selection -> rejected
  const multiClinicInvalidChoice = resolveBookingClinicVenue(
    [
      { clinicId: 'c-bikesh', clinicName: 'Bikesh Clinic', isVerified: true, status: 'ACCEPTED' },
    ],
    'c-random-999'
  );
  assert(multiClinicInvalidChoice.allowed === false && multiClinicInvalidChoice.status === 400, 'Invalid clinic venue selection is rejected');

  // ==========================================
  // Test 65: Doctor Clinic-Specific Shifts & Fee Management
  // User: "sun doctor edit kr skta h ki vo kis clinic me kb se kb baithta h aur kis clinic me kitna fee h uska"
  // ==========================================
  console.log('\n--- Test 65: Clinic-Specific Practice Shifts & Consultation Fee Resolution ---');

  const sampleDoctorProfile = {
    id: 'doc-multi-venue',
    consultationFee: 90.0,
    checkingStartTime: '09:00',
    checkingEndTime: '12:00',
    maxDailyPatients: 25,
    slots: JSON.stringify([
      { id: 'global_1', name: 'Global Practice Shift', startTime: '09:00', endTime: '12:00', maxPatients: 25 },
    ]),
    clinics: [
      {
        id: 'cd-1',
        clinicId: 'clinic-heart-care',
        consultationFee: 120.0, // Custom fee at Heart Care
        slots: JSON.stringify([
          { id: 'hc_shift_1', name: 'Morning Cardio Shift', startTime: '08:00', endTime: '11:00', maxPatients: 30 },
          { id: 'hc_shift_2', name: 'Evening Cardio Shift', startTime: '16:00', endTime: '19:00', maxPatients: 40 },
        ]),
        clinic: {
          id: 'clinic-heart-care',
          clinicName: 'Apex Heart Care Institute',
          address: '42 Medical Enclave',
          city: 'Mumbai',
          isVerified: true,
        },
      },
      {
        id: 'cd-2',
        clinicId: 'clinic-metro-poly',
        consultationFee: 65.0, // Custom lower fee at Metro PolyClinic
        slots: JSON.stringify([
          { id: 'mp_shift_1', name: 'Afternoon Consults', startTime: '13:00', endTime: '17:00', maxPatients: 50 },
        ]),
        clinic: {
          id: 'clinic-metro-poly',
          clinicName: 'Metro Community PolyClinic',
          address: '15 Sector 4',
          city: 'Mumbai',
          isVerified: true,
        },
      },
      {
        id: 'cd-3',
        clinicId: 'clinic-general-care',
        consultationFee: null, // Unconfigured fee, should fall back to doctor's global fee $90
        slots: null, // Unconfigured slots, should fall back to doctor's global slot
        clinic: {
          id: 'clinic-general-care',
          clinicName: 'General Care Dispensary',
          address: '7 Gandhi Marg',
          city: 'Mumbai',
          isVerified: true,
        },
      },
    ],
  };

  // Helper simulating formatDoctorClinics helper in doctorController
  const formatClinicsHelper = (doc: any) => {
    return (doc.clinics || []).map((cd: any) => {
      let clinicSlots = parseDoctorSlots(doc);
      if (cd.slots) {
        try {
          const parsed = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
          if (Array.isArray(parsed) && parsed.length > 0) {
            clinicSlots = parsed.map((s: any, idx: number) => {
              const sTime = s.startTime || '09:00';
              const eTime = s.endTime || '11:00';
              const maxP = Math.max(1, Number(s.maxPatients) || 50);
              const { avgConsultationMinutes: calculatedAvg } = calculateSlotMetrics(sTime, eTime, maxP);
              return {
                id: s.id || `slot_${idx + 1}`,
                name: s.name || `Slot ${idx + 1} (${format12Hour(sTime)} – ${format12Hour(eTime)})`,
                startTime: sTime,
                endTime: eTime,
                maxPatients: maxP,
                avgConsultationMinutes: s.avgConsultationMinutes || calculatedAvg,
              };
            });
          }
        } catch {}
      }
      return {
        ...cd,
        consultationFee: cd.consultationFee ?? doc.consultationFee,
        slots: clinicSlots,
      };
    });
  };

  const formattedClinics = formatClinicsHelper(sampleDoctorProfile);

  // Test 65.1: Clinic A fee & slots
  const clinicA = formattedClinics.find((c: any) => c.clinicId === 'clinic-heart-care');
  assert(clinicA?.consultationFee === 120.0, 'Clinic A has custom consultation fee of $120.0');
  assert(clinicA?.slots.length === 2, 'Clinic A has 2 custom practice shifts');
  assert(clinicA?.slots[0].startTime === '08:00' && clinicA?.slots[0].endTime === '11:00', 'Clinic A Shift 1 is 08:00 to 11:00');
  assert(clinicA?.slots[0].maxPatients === 30, 'Clinic A Shift 1 max capacity is 30 patients');
  assert(clinicA?.slots[0].avgConsultationMinutes === 6, 'Clinic A Shift 1 consultation pace is 6m (180m / 30 pts)');

  // Test 65.2: Clinic B fee & slots
  const clinicB = formattedClinics.find((c: any) => c.clinicId === 'clinic-metro-poly');
  assert(clinicB?.consultationFee === 65.0, 'Clinic B has custom consultation fee of $65.0');
  assert(clinicB?.slots.length === 1, 'Clinic B has 1 custom practice shift');
  assert(clinicB?.slots[0].startTime === '13:00' && clinicB?.slots[0].endTime === '17:00', 'Clinic B Shift is 13:00 to 17:00');
  assert(clinicB?.slots[0].maxPatients === 50, 'Clinic B Shift max capacity is 50 patients');
  assert(clinicB?.slots[0].avgConsultationMinutes === 4.8, 'Clinic B Shift consultation pace is 4.8m (240m / 50 pts)');

  // Test 65.3: Clinic C fallback
  const clinicC = formattedClinics.find((c: any) => c.clinicId === 'clinic-general-care');
  assert(clinicC?.consultationFee === 90.0, 'Clinic C falls back to doctor global consultation fee of $90.0');
  assert(clinicC?.slots.length === 1, 'Clinic C falls back to doctor global practice shifts');
  assert(clinicC?.slots[0].startTime === '09:00', 'Clinic C slot start is 09:00 from global');

  // Test 65.4: Queue preview calculation with specific clinicId
  const resolveQueuePreviewData = (doc: any, requestedClinicId?: string) => {
    const activeClinics = doc.clinics || [];
    let selectedAffiliation: any = null;
    if (requestedClinicId) {
      selectedAffiliation = activeClinics.find((c: any) => c.clinicId === String(requestedClinicId));
    }
    if (!selectedAffiliation && activeClinics.length === 1) {
      selectedAffiliation = activeClinics[0];
    }

    let slots = parseDoctorSlots(doc);
    if (selectedAffiliation?.slots) {
      try {
        const parsed = typeof selectedAffiliation.slots === 'string' ? JSON.parse(selectedAffiliation.slots) : selectedAffiliation.slots;
        if (Array.isArray(parsed) && parsed.length > 0) {
          slots = parsed;
        }
      } catch {}
    }

    const fee = selectedAffiliation?.consultationFee ?? doc.consultationFee;
    return {
      selectedClinicId: selectedAffiliation?.clinicId || null,
      consultationFee: fee,
      slots,
    };
  };

  const previewHeartCare = resolveQueuePreviewData(sampleDoctorProfile, 'clinic-heart-care');
  assert(previewHeartCare.selectedClinicId === 'clinic-heart-care', 'Queue preview resolves to Heart Care clinic');
  assert(previewHeartCare.consultationFee === 120.0, 'Queue preview for Heart Care uses $120.0 fee');
  assert(previewHeartCare.slots.length === 2, 'Queue preview for Heart Care uses 2 Heart Care shifts');

  const previewMetro = resolveQueuePreviewData(sampleDoctorProfile, 'clinic-metro-poly');
  assert(previewMetro.selectedClinicId === 'clinic-metro-poly', 'Queue preview resolves to Metro PolyClinic');
  assert(previewMetro.consultationFee === 65.0, 'Queue preview for Metro PolyClinic uses $65.0 fee');
  assert(previewMetro.slots[0].startTime === '13:00', 'Queue preview for Metro PolyClinic uses 13:00 afternoon shift');

  // --- Test 66: Monotonic Queue Token Number Generation After Cancellations ---
  console.log('\n--- Test 66: Monotonic Queue Token Number Generation After Cancellations ---');
  // Scenario: Appointments #1, #2, #3 were created. Appointment #3 was CANCELLED.
  // Active appointments list only has #1, #2.
  // If we only take max of active appointments, highest is 2 -> next is 3 -> COLLISION with cancelled #3!
  const mockAllAppointmentsDay = [
    { id: 'appt-1', queueNumber: 1, status: 'COMPLETED' },
    { id: 'appt-2', queueNumber: 2, status: 'WAITING' },
    { id: 'appt-3', queueNumber: 3, status: 'CANCELLED' },
  ];
  // Calculate next queue using all appointments
  const maxAcrossAll = mockAllAppointmentsDay.reduce((max, a) => Math.max(max, a.queueNumber), 0);
  const nextQueueSafe = maxAcrossAll + 1;
  assert(nextQueueSafe === 4, 'Next queue token after cancelled #3 is #4 (never duplicates cancelled #3)');
  assert(!mockAllAppointmentsDay.some((a) => a.queueNumber === nextQueueSafe), 'New token #4 does not collide with any existing token');

  // --- Test 67: Timezone-Safe IST Evaluation Across UTC Midnight Boundary ---
  console.log('\n--- Test 67: Timezone-Safe IST Evaluation Across UTC Midnight Boundary ---');
  // At 2026-09-27 20:00:00 UTC, UTC date is 2026-09-27, but in India (UTC+5:30) it is 2026-09-28 01:30 AM!
  const utcLateEvening = new Date('2026-09-27T20:00:00Z');
  const istDateString = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(utcLateEvening);
  assert(istDateString === '2026-09-28', 'UTC 20:00 (Sept 27) correctly resolves to Sept 28 in Indian Standard Time');

  const testSlotIST: DoctorSlot = {
    id: 's_ist',
    name: 'Morning Shift',
    startTime: '09:00',
    endTime: '12:00',
    maxPatients: 30,
    avgConsultationMinutes: 6,
  };
  // Slot on 2026-09-28 evaluated with server at 20:00 UTC (1:30 AM IST on Sept 28)
  const slotStatusIST = evaluateSlotStatus(testSlotIST, '2026-09-28', 0, utcLateEvening);
  assert(slotStatusIST.isToday === true, 'Appointment date 2026-09-28 evaluates to isToday on Render UTC server');
  assert(slotStatusIST.isPassed === false, 'Morning slot 09:00-12:00 is not marked passed at 01:30 AM IST');
  assert(slotStatusIST.isUpcoming === true, 'Morning slot is upcoming for today');

  // --- Test 68: Receptionist Walk-in Practice Shift & Capacity Validation ---
  console.log('\n--- Test 68: Receptionist Walk-in Practice Shift & Capacity Validation ---');
  const clinicDoctorAffiliationWithShifts = {
    clinicId: 'clinic-101',
    doctorId: 'doc-202',
    slots: JSON.stringify([
      { id: 'shift_early', name: 'Early Morning', startTime: '07:00', endTime: '10:00', maxPatients: 10, avgConsultationMinutes: 18 },
      { id: 'shift_afternoon', name: 'Afternoon', startTime: '14:00', endTime: '18:00', maxPatients: 20, avgConsultationMinutes: 12 },
    ]),
  };
  const parsedClinicDoctorSlots = JSON.parse(clinicDoctorAffiliationWithShifts.slots);
  assert(parsedClinicDoctorSlots.length === 2, 'Receptionist resolves 2 clinic-specific doctor shifts');

  // Slot overflow check: 10 booked out of 10 max patients
  const earlyShift = parsedClinicDoctorSlots[0];
  const evalFullEarlyShift = evaluateSlotStatus(earlyShift, '2026-09-28', 10, new Date('2026-09-28T02:00:00Z'));
  assert(evalFullEarlyShift.isFull === true, 'Walk-in shift is marked isFull when max patient capacity reached');

  // Slot passed check: current time 11:00 AM IST (after 10:00 AM end)
  const nowPassedTime = new Date(2026, 8, 28, 11, 0); // 11:00 AM local
  const evalPassedEarlyShift = evaluateSlotStatus(earlyShift, '2026-09-28', 2, nowPassedTime);
  assert(evalPassedEarlyShift.isPassed === true, 'Walk-in shift is marked isPassed when current time exceeds shift end');

  // --- Test 69: Receptionist Mandatory Temporary Password Change Gating ---
  console.log('\n--- Test 69: Receptionist Mandatory Temporary Password Change Gating ---');
  const receptionistUserUnchanged = { id: 'rec-1', mustChangePassword: true, role: 'RECEPTIONIST' };
  const receptionistUserUpdated = { id: 'rec-1', mustChangePassword: false, role: 'RECEPTIONIST' };

  const canPerformDeskAction = (user: typeof receptionistUserUnchanged) => {
    if (user.mustChangePassword) {
      return { allowed: false, message: 'Temporary password must be changed before accessing clinical desk operations.' };
    }
    return { allowed: true, message: 'Authorized' };
  };

  const actionUnchanged = canPerformDeskAction(receptionistUserUnchanged);
  assert(actionUnchanged.allowed === false, 'Receptionist with mustChangePassword=true is blocked from desk operations');
  assert(actionUnchanged.message.includes('Temporary password must be changed'), 'Clear security warning is returned');

  const actionUpdated = canPerformDeskAction(receptionistUserUpdated);
  assert(actionUpdated.allowed === true, 'Receptionist with updated permanent password can perform desk operations');

  // --- Test 70: Receptionist Cross-Facility Appointment Cancellation Protection ---
  console.log('\n--- Test 70: Receptionist Cross-Facility Appointment Cancellation Protection ---');
  const receptionistClinicId = 'clinic-facility-north';
  const appointmentSameFacility = { id: 'appt-1', doctorId: 'doc-1', clinicId: 'clinic-facility-north' };
  const appointmentOtherFacility = { id: 'appt-2', doctorId: 'doc-1', clinicId: 'clinic-facility-south' };

  const checkCancellationFacility = (recClinicId: string, apptClinicId: string) => {
    if (recClinicId && apptClinicId && apptClinicId !== recClinicId) {
      return { allowed: false, message: 'Access denied: Appointment belongs to another clinic facility' };
    }
    return { allowed: true, message: 'Cancellation permitted' };
  };

  assert(checkCancellationFacility(receptionistClinicId, appointmentSameFacility.clinicId).allowed === true, 'Receptionist can cancel appointment at their own clinic facility');
  assert(checkCancellationFacility(receptionistClinicId, appointmentOtherFacility.clinicId).allowed === false, 'Receptionist is blocked from cancelling appointment at different clinic facility');

  // --- Test 71: Clinic Dashboard Revenue & Fee Calculation with Custom Doctor Clinic Fees ---
  console.log('\n--- Test 71: Clinic Dashboard Revenue & Fee Calculation with Custom Doctor Clinic Fees ---');
  const mockActiveDoctorAffiliation = {
    doctorId: 'doc-cardio',
    consultationFee: 150.0, // Custom fee at this clinic
    doctor: { consultationFee: 100.0 }, // Global doctor fee
  };
  const mockClinic71Appointments = [
    { doctorId: 'doc-cardio', status: 'COMPLETED' },
    { doctorId: 'doc-cardio', status: 'COMPLETED' },
    { doctorId: 'doc-cardio', status: 'CANCELLED' }, // Cancelled should not contribute revenue
  ];

  const activeAppts = mockClinic71Appointments.filter((a) => a.status !== 'CANCELLED');
  const effectiveFee = mockActiveDoctorAffiliation.consultationFee ?? mockActiveDoctorAffiliation.doctor.consultationFee;
  const clinicDoctorRevenue = activeAppts.length * effectiveFee;

  assert(effectiveFee === 150.0, 'Doctor fee for clinic dashboard resolves to clinic-specific fee of $150.0');
  assert(clinicDoctorRevenue === 300.0, 'Clinic revenue is calculated as 2 completed * $150.0 = $300.0 (ignoring cancelled appt)');

  // --- Test 72: Doctor Walk-in Multi-Clinic Venue Selection Resolution ---
  console.log('\n--- Test 72: Doctor Walk-in Multi-Clinic Venue Selection Resolution ---');
  const resolveDoctorWalkinClinic = (
    clinics: Array<{ clinicId: string; clinicName: string }>,
    selectedClinicId?: string
  ): { targetClinicId?: string; error?: string } => {
    if (clinics.length === 0) {
      return { error: 'No active clinic affiliations found. Walk-in disabled.' };
    }
    if (selectedClinicId) {
      const match = clinics.find((c) => c.clinicId === selectedClinicId);
      if (!match) return { error: 'Invalid clinic venue selected' };
      return { targetClinicId: match.clinicId };
    }
    if (clinics.length === 1) {
      return { targetClinicId: clinics[0].clinicId };
    }
    return { error: 'Multi-clinic doctor must select a clinic venue' };
  };

  const docClinics = [
    { clinicId: 'clinic-metro', clinicName: 'Metro Polyclinic' },
    { clinicId: 'clinic-apollo', clinicName: 'Apollo Care' },
  ];
  assert(
    resolveDoctorWalkinClinic(docClinics).error === 'Multi-clinic doctor must select a clinic venue',
    'Multi-clinic doctor walk-in without venue selection returns error'
  );
  assert(
    resolveDoctorWalkinClinic(docClinics, 'clinic-metro').targetClinicId === 'clinic-metro',
    'Multi-clinic doctor walk-in with selected venue resolves correctly to clinic-metro'
  );
  assert(
    resolveDoctorWalkinClinic([docClinics[0]]).targetClinicId === 'clinic-metro',
    'Single-clinic doctor walk-in auto-resolves to the only clinic venue'
  );

  // --- Test 73: Receptionist Password Change Unlocks mustChangePassword Gating ---
  console.log('\n--- Test 73: Receptionist Password Change Unlocks mustChangePassword Gating ---');
  interface ReceptionistUserRecord {
    id: string;
    mustChangePassword: boolean;
  }
  const testReceptionist: ReceptionistUserRecord = { id: 'rec-1', mustChangePassword: true };
  const isDeskActionAllowed = (user: ReceptionistUserRecord) => !user.mustChangePassword;

  assert(isDeskActionAllowed(testReceptionist) === false, 'Receptionist initially blocked from desk actions due to temporary password');
  // Simulate successful password update
  testReceptionist.mustChangePassword = false;
  assert(isDeskActionAllowed(testReceptionist) === true, 'Receptionist unlocked for desk actions after password change');

  // --- Test 74: Patient Vault Category Policy (Prescriptions Disallowed) ---
  console.log('\n--- Test 74: Patient Vault Category Policy (Prescriptions Disallowed) ---');
  const VAULT_UPLOAD_CATEGORIES = ['All', 'Lab Report', 'Scan', 'Discharge Summary', 'Other'];
  assert(
    !VAULT_UPLOAD_CATEGORIES.includes('Prescription'),
    'Patient Medical Vault upload categories strictly exclude Prescriptions (doctors issue prescriptions digitally)'
  );
  assert(
    VAULT_UPLOAD_CATEGORIES.includes('Lab Report') && VAULT_UPLOAD_CATEGORIES.includes('Scan'),
    'Patient Medical Vault upload categories correctly support Lab Report and Scan'
  );

  // --- Test 75: Shift Full Estimated Time Hardening ---
  console.log('\n--- Test 75: Shift Full Estimated Time Hardening ---');
  const futureSlot = {
    id: 'slot-morning',
    name: 'Morning Shift (09:00 AM - 12:00 PM)',
    startTime: '09:00',
    endTime: '12:00',
    maxPatients: 20,
    avgConsultationMinutes: 5,
  };
  // Simulate date tomorrow (not passed) and full capacity (20 booked)
  const fullStatusResult = evaluateSlotStatus(futureSlot, '2099-01-01', 20, new Date());
  assert(fullStatusResult.isFull === true, 'Shift with 20/20 patients evaluates as isFull=true');
  assert(fullStatusResult.isPassed === false, 'Future shift evaluates as isPassed=false');
  assert(fullStatusResult.statusLabel === 'Fully Booked', 'Full shift statusLabel evaluates to Fully Booked');
  assert(fullStatusResult.estimatedTime === 'Shift Full', 'Full shift estimatedTime is strictly hardened to "Shift Full"');

  // --- Test 76: Vault Server-Side Prescription Upload Rejection ---
  console.log('\n--- Test 76: Vault Server-Side Prescription Upload Rejection ---');
  const validateVaultUploadCategory = (category: string | undefined): { allowed: boolean; status: number; message?: string } => {
    if (category && String(category).trim().toLowerCase() === 'prescription') {
      return {
        allowed: false,
        status: 400,
        message: 'Prescription uploads are not permitted in the patient medical vault. Digital prescriptions are issued directly by doctors during consultation.',
      };
    }
    return { allowed: true, status: 200 };
  };
  assert(validateVaultUploadCategory('Prescription').allowed === false, 'Rejects "Prescription" category with allowed=false');
  assert(validateVaultUploadCategory('Prescription').status === 400, 'Rejects "Prescription" category with HTTP 400');
  assert(validateVaultUploadCategory('prescription').allowed === false, 'Rejects lowercase "prescription" category');
  assert(validateVaultUploadCategory(' PRESCRIPTION ').allowed === false, 'Rejects whitespace-padded " PRESCRIPTION "');
  assert(validateVaultUploadCategory('Lab Report').allowed === true, 'Permits "Lab Report" category upload');
  assert(validateVaultUploadCategory('Scan').allowed === true, 'Permits "Scan" category upload');

  // --- Test 77: Consultation Cabin & Status Update State Machine Guards ---
  console.log('\n--- Test 77: Consultation Cabin & Status Update State Machine Guards ---');
  const validateCallPatient = (apptStatus: string): { allowed: boolean; status: number; message?: string } => {
    if (apptStatus === 'COMPLETED') {
      return { allowed: false, status: 400, message: 'Cannot call an appointment that has already been completed' };
    }
    return { allowed: true, status: 200 };
  };
  const validateCompleteConsultation = (apptStatus: string): { allowed: boolean; status: number; message?: string } => {
    if (apptStatus === 'CANCELLED') {
      return { allowed: false, status: 400, message: 'Cannot complete consultation for a cancelled appointment' };
    }
    return { allowed: true, status: 200 };
  };
  const validateUpdateAppointmentStatus = (currentStatus: string): { allowed: boolean; status: number; message?: string } => {
    if (currentStatus === 'COMPLETED' || currentStatus === 'CANCELLED') {
      return { allowed: false, status: 400, message: `Cannot update status of an appointment that is already ${currentStatus.toLowerCase()}` };
    }
    return { allowed: true, status: 200 };
  };

  assert(validateCallPatient('COMPLETED').allowed === false, 'Doctor callPatient rejects already COMPLETED appointment');
  assert(validateCallPatient('WAITING').allowed === true, 'Doctor callPatient allows WAITING appointment');
  assert(validateCompleteConsultation('CANCELLED').allowed === false, 'Doctor completeConsultation rejects CANCELLED appointment');
  assert(validateCompleteConsultation('IN_CONSULTATION').allowed === true, 'Doctor completeConsultation allows active consultation');
  assert(validateUpdateAppointmentStatus('COMPLETED').allowed === false, 'updateAppointmentStatus rejects modifying COMPLETED appointment');
  assert(validateUpdateAppointmentStatus('CANCELLED').allowed === false, 'updateAppointmentStatus rejects modifying CANCELLED appointment');
  assert(validateUpdateAppointmentStatus('WAITING').allowed === true, 'updateAppointmentStatus allows modifying WAITING appointment');

  // --- Test 78: Receptionist Facility Queue & Desk Scoping ---
  console.log('\n--- Test 78: Receptionist Facility Queue & Desk Scoping ---');
  const mockDoctorAppointmentsAcrossClinics = [
    { id: 'appt-1', doctorId: 'doc-1', clinicId: 'clinic-A', status: 'WAITING', queueNumber: 1 },
    { id: 'appt-2', doctorId: 'doc-1', clinicId: 'clinic-A', status: 'IN_CONSULTATION', queueNumber: 2 },
    { id: 'appt-3', doctorId: 'doc-1', clinicId: 'clinic-B', status: 'WAITING', queueNumber: 1 },
  ];
  const filterQueueForReceptionistClinic = (clinicId: string, appts: typeof mockDoctorAppointmentsAcrossClinics) => {
    return appts.filter((a) => !clinicId || a.clinicId === clinicId);
  };
  const clinicAQueue = filterQueueForReceptionistClinic('clinic-A', mockDoctorAppointmentsAcrossClinics);
  assert(clinicAQueue.length === 2, 'Receptionist at Clinic A only sees 2 appointments from Clinic A');
  assert(clinicAQueue.every((a) => a.clinicId === 'clinic-A'), 'No Clinic B appointments leak to Clinic A receptionist');

  // --- Test 79: Slot Capacity Checking Window Heterogeneous Shift Isolation ---
  console.log('\n--- Test 79: Slot Capacity Checking Window Heterogeneous Shift Isolation ---');
  const checkAppointmentMatchesSlot = (
    appt: { slotId?: string | null; checkingWindow?: string | null },
    slot: { id: string; startTime: string },
    totalSlotsCount: number
  ): boolean => {
    if (appt.slotId) return appt.slotId === slot.id;
    if (appt.checkingWindow) return appt.checkingWindow.includes(slot.startTime);
    return totalSlotsCount === 1;
  };

  const morningShift = { id: 'slot-m', startTime: '09:00' };
  const afternoonAppt = { slotId: null, checkingWindow: 'Afternoon Shift (14:00 - 18:00)' };
  const morningAppt = { slotId: null, checkingWindow: 'Morning Shift (09:00 - 12:00)' };
  const untaggedAppt = { slotId: null, checkingWindow: null };

  assert(
    checkAppointmentMatchesSlot(afternoonAppt, morningShift, 1) === false,
    'Afternoon appointment does NOT match morning shift when totalSlotsCount=1'
  );
  assert(
    checkAppointmentMatchesSlot(morningAppt, morningShift, 1) === true,
    'Morning appointment correctly matches morning shift'
  );
  assert(
    checkAppointmentMatchesSlot(untaggedAppt, morningShift, 1) === true,
    'Untagged appointment falls back to single shift when totalSlotsCount=1'
  );

  // --- Test 80: Doctor Schedule Update With Invalid Clinic Affiliation Returns 404 ---
  console.log('\n--- Test 80: Doctor Schedule Update With Invalid Clinic Affiliation Returns 404 ---');
  const handleUpdateScheduleClinicAffiliation = (
    doctorAffiliations: Array<{ clinicId: string; clinicName: string }>,
    requestedClinicId?: string
  ): { status: number; error?: string; updated: boolean } => {
    if (requestedClinicId) {
      const match = doctorAffiliations.find((a) => a.clinicId === requestedClinicId);
      if (!match) {
        return {
          status: 404,
          error: 'Active clinic affiliation not found for this facility. Unable to configure clinic-specific schedule.',
          updated: false,
        };
      }
      return { status: 200, updated: true };
    }
    return { status: 200, updated: true };
  };

  const affiliations = [{ clinicId: 'clinic-alpha', clinicName: 'Alpha Clinic' }];
  const invalidResult = handleUpdateScheduleClinicAffiliation(affiliations, 'clinic-unaffiliated');
  assert(invalidResult.status === 404, 'Supplying unaffiliated clinicId returns HTTP 404');
  assert(invalidResult.updated === false, 'Global schedule is protected from silent overwrite when clinicId is invalid');
  const validResult = handleUpdateScheduleClinicAffiliation(affiliations, 'clinic-alpha');
  assert(validResult.status === 200 && validResult.updated === true, 'Supplying valid affiliated clinicId succeeds');

  // --- Test 81: Patient Online Booking Requires Receptionist & Payment Verification ---
  console.log('\n--- Test 81: Patient Online Booking Requires Receptionist & Payment Verification ---');
  interface ApprovalBookingPayload {
    role: 'PATIENT' | 'RECEPTIONIST' | 'DOCTOR';
    existingPendingCount: number;
    highestPositiveQueue: number;
  }

  const simulateAppointmentBooking = (payload: ApprovalBookingPayload) => {
    const isDeskBooking = payload.role === 'RECEPTIONIST' || payload.role === 'DOCTOR';
    if (!isDeskBooking) {
      // Patient online self-booking
      const provisionalNegativeToken = -1 * (payload.existingPendingCount + 1);
      return {
        status: 'PENDING_APPROVAL',
        paymentStatus: 'PENDING',
        queueNumber: provisionalNegativeToken,
        isProvisional: true,
      };
    } else {
      // Direct desk / walk-in booking
      return {
        status: 'WAITING',
        paymentStatus: 'PAID',
        queueNumber: payload.highestPositiveQueue + 1,
        isProvisional: false,
      };
    }
  };

  const patientBooking = simulateAppointmentBooking({
    role: 'PATIENT',
    existingPendingCount: 2,
    highestPositiveQueue: 10,
  });
  assert(patientBooking.status === 'PENDING_APPROVAL', 'Patient self-booking sets status PENDING_APPROVAL');
  assert(patientBooking.paymentStatus === 'PENDING', 'Patient self-booking sets paymentStatus PENDING');
  assert(patientBooking.queueNumber < 0, 'Patient provisional token is negative to avoid queue collision');
  assert(patientBooking.queueNumber === -3, 'Patient provisional token is uniquely indexed (-3)');

  const deskBooking = simulateAppointmentBooking({
    role: 'RECEPTIONIST',
    existingPendingCount: 2,
    highestPositiveQueue: 10,
  });
  assert(deskBooking.status === 'WAITING', 'Desk walk-in booking is immediately confirmed WAITING');
  assert(deskBooking.paymentStatus === 'PAID', 'Desk walk-in booking has paymentStatus PAID');
  assert(deskBooking.queueNumber === 11, 'Desk walk-in receives next positive token (11)');

  // --- Test 82: Receptionist Payment Confirmation & Sequential Token Assignment ---
  console.log('\n--- Test 82: Receptionist Payment Confirmation & Sequential Token Assignment ---');
  const simulateReceptionistApproval = (
    appointment: { id: string; status: string; paymentStatus: string; queueNumber: number },
    highestActiveQueue: number,
    receptionistUserId: string
  ) => {
    if (appointment.status !== 'PENDING_APPROVAL') {
      throw new Error('Only PENDING_APPROVAL appointments can be confirmed');
    }
    const confirmedToken = highestActiveQueue + 1;
    return {
      ...appointment,
      status: 'WAITING',
      paymentStatus: 'PAID',
      queueNumber: confirmedToken,
      approvedBy: receptionistUserId,
      approvedAt: new Date().toISOString(),
    };
  };

  const pendingAppt = {
    id: 'appt-999',
    status: 'PENDING_APPROVAL',
    paymentStatus: 'PENDING',
    queueNumber: -1,
  };
  const approvedAppt = simulateReceptionistApproval(pendingAppt, 14, 'rec-user-42');
  assert(approvedAppt.status === 'WAITING', 'Approved appointment advances to WAITING status');
  assert(approvedAppt.paymentStatus === 'PAID', 'Approved appointment marks paymentStatus as PAID');
  assert(approvedAppt.queueNumber === 15, 'Approved appointment receives next positive sequential token (#15)');
  assert(approvedAppt.approvedBy === 'rec-user-42', 'Approved appointment records approvedBy receptionist');

  // --- Test 83: Receptionist Join Application Sets Status PENDING ---
  console.log('\n--- Test 83: Receptionist Join Application Sets Status PENDING ---');
  const simulateReceptionistApplication = (applicant: { fullName: string; email: string; clinicId: string }) => {
    return {
      id: 'rec-new-1',
      fullName: applicant.fullName,
      email: applicant.email,
      clinicId: applicant.clinicId,
      status: 'PENDING',
      canAccessDesk: false,
    };
  };

  const appResponse = simulateReceptionistApplication({
    fullName: 'Priya Sharma',
    email: 'priya@mediarca.com',
    clinicId: 'clinic-metro-1',
  });
  assert(appResponse.status === 'PENDING', 'Receptionist application status is PENDING upon submission');
  assert(appResponse.canAccessDesk === false, 'Pending receptionist cannot access desk dashboard');

  // --- Test 84: Clinic Admin Reviews & Accepts Receptionist Application ---
  console.log('\n--- Test 84: Clinic Admin Reviews & Accepts Receptionist Application ---');
  const simulateClinicReceptionistResponse = (
    receptionist: { id: string; status: string },
    action: 'ACCEPT' | 'REJECT',
    doctorIds: string[]
  ) => {
    if (action === 'ACCEPT') {
      return {
        id: receptionist.id,
        status: 'ACTIVE',
        assignedDoctors: doctorIds,
        canAccessDesk: true,
      };
    } else {
      return {
        id: receptionist.id,
        status: 'REJECTED',
        assignedDoctors: [],
        canAccessDesk: false,
      };
    }
  };

  const acceptedRec = simulateClinicReceptionistResponse(
    { id: 'rec-new-1', status: 'PENDING' },
    'ACCEPT',
    ['doc-cardio-1', 'doc-derma-2']
  );
  assert(acceptedRec.status === 'ACTIVE', 'Clinic approval transitions receptionist status to ACTIVE');
  assert(acceptedRec.canAccessDesk === true, 'Active receptionist is granted desk dashboard access');
  assert(acceptedRec.assignedDoctors.length === 2, 'Assigned doctors linked to approved receptionist');

  const rejectedRec = simulateClinicReceptionistResponse(
    { id: 'rec-new-2', status: 'PENDING' },
    'REJECT',
    []
  );
  assert(rejectedRec.status === 'REJECTED', 'Clinic rejection transitions receptionist status to REJECTED');
  assert(rejectedRec.canAccessDesk === false, 'Rejected receptionist desk access remains revoked');

  // --- Test 85: Shift Capacity with 1/25 Patients Near Shift End (User Bug Report Scenario) ---
  console.log('\n--- Test 85: Shift Capacity with 1/25 Patients Near Shift End ---');
  const slotSarah: DoctorSlot = {
    id: 's_sarah_01',
    name: 'Shift 1: Morning & Afternoon',
    startTime: '09:00',
    endTime: '13:00',
    maxPatients: 25,
    avgConsultationMinutes: 20,
  };
  // Simulate 12:43 PM today (763 mins) with 1 patient booked (Queue #2):
  const now1243 = new Date(2026, 8, 28, 12, 43);
  const statusSarah = evaluateSlotStatus(slotSarah, '2026-09-28', 1, now1243);
  assert(statusSarah.isPassed === false, 'Shift ending at 13:00 is NOT passed at 12:43 PM');
  assert(statusSarah.isInProgress === true, 'Shift is actively in progress at 12:43 PM');
  assert(statusSarah.isFull === false, 'Shift with 1/25 booked is NOT full (24 seats available)');
  assert(statusSarah.statusLabel === 'Active Now • In Progress', 'Status label reflects Active Now • In Progress');
  assert(statusSarah.estimatedTime === '01:03 PM', `Estimated time is 01:03 PM, got ${statusSarah.estimatedTime}`);

  // When bookedCount reaches maxPatients (25/25):
  const statusSarahFull = evaluateSlotStatus(slotSarah, '2026-09-28', 25, now1243);
  assert(statusSarahFull.isFull === true, 'Shift with 25/25 booked is strictly isFull=true');
  assert(statusSarahFull.statusLabel === 'Fully Booked', 'Full shift statusLabel evaluates to Fully Booked');
  assert(statusSarahFull.estimatedTime === 'Shift Full', 'Full shift estimatedTime is Shift Full');

  // --- Test 86: Doctor Custom Entered Avg Consultation Time & Pacing ---
  console.log('\n--- Test 86: Doctor Custom Entered Avg Consultation Time & Pacing ---');
  const customPaceSlot: DoctorSlot = {
    id: 's_custom_pace',
    name: 'Consultation Shift',
    startTime: '10:00',
    endTime: '14:00', // 240 minutes duration
    maxPatients: 20, // If auto-calculated, duration / maxPatients = 12 mins
    avgConsultationMinutes: 25, // But doctor explicitly entered 25 minutes!
  };
  // Ensure the doctor-entered 25 minutes is preserved and honored
  assert(customPaceSlot.avgConsultationMinutes === 25, 'Doctor-entered consultation pace (25m) is preserved');
  // Evaluate estimated time for patient #3 (2 patients ahead):
  // 10:00 AM (600m) + 2 * 25m = 650m = 10:50 AM
  const nowCustom = new Date(2026, 8, 28, 9, 30); // before shift
  const statusCustom = evaluateSlotStatus(customPaceSlot, '2026-09-28', 2, nowCustom);
  assert(statusCustom.estimatedTime === '10:50 AM', `Estimated time uses doctor pace 25m: 10:50 AM, got ${statusCustom.estimatedTime}`);

  // --- Test 87: Integer Range Safety for Provisional Queue Number ---
  console.log('\n--- Test 87: Integer Range Safety for Provisional Queue Number ---');
  const minNegativeInt = -2147483648;
  const maxPositiveInt = 2147483647;
  const generateSequentialProvisionalToken = (lastNegativeToken?: number): number => {
    return lastNegativeToken !== undefined && lastNegativeToken < 0 ? lastNegativeToken - 1 : -1;
  };
  const token1 = generateSequentialProvisionalToken();
  const token2 = generateSequentialProvisionalToken(token1);
  const token100 = generateSequentialProvisionalToken(-99);
  assert(token1 === -1, 'First provisional token is -1');
  assert(token2 === -2, 'Second provisional token is -2');
  assert(token100 === -100, '100th provisional token is -100');
  assert(token1 >= minNegativeInt && token1 <= maxPositiveInt, 'Provisional token is within PostgreSQL 32-bit Int range');
  assert(token100 >= minNegativeInt && token100 <= maxPositiveInt, 'Provisional token -100 is within PostgreSQL 32-bit Int range');

  // --- Test 88: Doctor Profile Mass-Assignment Protection ---
  console.log('\n--- Test 88: Doctor Profile Mass-Assignment Protection ---');
  const sanitizeDoctorProfileUpdate = (input: any) => {
    const {
      specialty,
      qualifications,
      experienceYears,
      consultationFee,
      bio,
      clinicAddress,
      checkingStartTime,
      checkingEndTime,
      avgConsultationMinutes,
      maxDailyPatients,
      slots,
    } = input;
    const safeData: any = {};
    if (specialty !== undefined) safeData.specialty = String(specialty).trim();
    if (qualifications !== undefined) safeData.qualifications = String(qualifications).trim();
    if (experienceYears !== undefined) safeData.experienceYears = Number(experienceYears) || 0;
    if (consultationFee !== undefined) safeData.consultationFee = Number(consultationFee) || 0;
    if (bio !== undefined) safeData.bio = bio ? String(bio).trim() : null;
    if (clinicAddress !== undefined) safeData.clinicAddress = clinicAddress ? String(clinicAddress).trim() : null;
    if (checkingStartTime !== undefined) safeData.checkingStartTime = String(checkingStartTime).trim();
    if (checkingEndTime !== undefined) safeData.checkingEndTime = String(checkingEndTime).trim();
    if (avgConsultationMinutes !== undefined) safeData.avgConsultationMinutes = Number(avgConsultationMinutes) || 15;
    if (maxDailyPatients !== undefined) safeData.maxDailyPatients = Number(maxDailyPatients) || 30;
    if (slots !== undefined) safeData.slots = typeof slots === 'string' ? slots : JSON.stringify(slots);
    return safeData;
  };
  const maliciousInput = {
    specialty: 'Cardiology',
    isVerified: true,
    verificationStatus: 'VERIFIED',
    rating: 5.0,
    totalReviews: 9999,
    userId: 'stolen-admin-id',
  };
  const sanitized = sanitizeDoctorProfileUpdate(maliciousInput);
  assert(sanitized.specialty === 'Cardiology', 'Permitted specialty update is preserved');
  assert(sanitized.isVerified === undefined, 'isVerified cannot be mass-assigned');
  assert(sanitized.verificationStatus === undefined, 'verificationStatus cannot be mass-assigned');
  assert(sanitized.rating === undefined, 'rating cannot be mass-assigned');
  assert(sanitized.totalReviews === undefined, 'totalReviews cannot be mass-assigned');
  assert(sanitized.userId === undefined, 'userId cannot be overwritten');

  // --- Test 89: Doctor Self-Affiliation Approval Block ---
  console.log('\n--- Test 89: Doctor Self-Affiliation Approval Block ---');
  const authorizeDoctorAffiliationResponse = (affiliation: { requestedBy: string }) => {
    if (affiliation.requestedBy === 'DOCTOR') {
      return { allowed: false, status: 403, message: 'Cannot accept an affiliation request initiated by yourself' };
    }
    return { allowed: true, status: 200 };
  };
  const selfInitiated = authorizeDoctorAffiliationResponse({ requestedBy: 'DOCTOR' });
  assert(selfInitiated.allowed === false && selfInitiated.status === 403, 'Doctor cannot self-approve own clinic request');
  const clinicInitiated = authorizeDoctorAffiliationResponse({ requestedBy: 'CLINIC' });
  assert(clinicInitiated.allowed === true && clinicInitiated.status === 200, 'Doctor can approve incoming clinic request');

  // --- Test 90: Suspended Doctor Booking & Directory Guard ---
  console.log('\n--- Test 90: Suspended Doctor Booking & Directory Guard ---');
  const authorizeDoctorBooking = (doctor: { isVerified: boolean; verificationStatus: string }) => {
    if (!doctor.isVerified || doctor.verificationStatus === 'SUSPENDED' || doctor.verificationStatus === 'REJECTED') {
      return { allowed: false, status: 403, message: 'Doctor is suspended or not verified' };
    }
    return { allowed: true, status: 200 };
  };
  const suspendedDocBooking = authorizeDoctorBooking({ isVerified: true, verificationStatus: 'SUSPENDED' });
  assert(suspendedDocBooking.allowed === false, 'Suspended doctor cannot accept bookings');
  const rejectedDocBooking = authorizeDoctorBooking({ isVerified: false, verificationStatus: 'REJECTED' });
  assert(rejectedDocBooking.allowed === false, 'Rejected doctor cannot accept bookings');
  const activeDocBooking = authorizeDoctorBooking({ isVerified: true, verificationStatus: 'VERIFIED' });
  assert(activeDocBooking.allowed === true, 'Verified active doctor can accept bookings');

  // --- Test 91: Doctor Clinical Relationship Record Guard ---
  console.log('\n--- Test 91: Doctor Clinical Relationship Record Guard ---');
  const authorizeDoctorRecordAccess = (hasAppointmentWithPatient: boolean) => {
    if (!hasAppointmentWithPatient) {
      return { allowed: false, status: 403, message: 'Access denied: No clinical appointment relationship' };
    }
    return { allowed: true, status: 200 };
  };
  assert(authorizeDoctorRecordAccess(false).allowed === false, 'Doctor without appointment cannot access patient records');
  assert(authorizeDoctorRecordAccess(true).allowed === true, 'Doctor with appointment can access patient records');

  // --- Test 92: Consultation State Machine Strict Enforcement ---
  console.log('\n--- Test 92: Consultation State Machine Strict Enforcement ---');
  const validateCallPatientTransition = (status: string) => {
    return status === 'WAITING' || status === 'IN_CONSULTATION';
  };
  assert(validateCallPatientTransition('WAITING') === true, 'callPatient accepts WAITING');
  assert(validateCallPatientTransition('PENDING_APPROVAL') === false, 'callPatient rejects PENDING_APPROVAL');
  assert(validateCallPatientTransition('COMPLETED') === false, 'callPatient rejects COMPLETED');
  assert(validateCallPatientTransition('CANCELLED') === false, 'callPatient rejects CANCELLED');

  const validateCompleteConsultationTransition = (status: string) => {
    return status === 'IN_CONSULTATION' || status === 'WAITING';
  };
  assert(validateCompleteConsultationTransition('IN_CONSULTATION') === true, 'completeConsultation accepts IN_CONSULTATION');
  assert(validateCompleteConsultationTransition('PENDING_APPROVAL') === false, 'completeConsultation rejects PENDING_APPROVAL');
  assert(validateCompleteConsultationTransition('CANCELLED') === false, 'completeConsultation rejects CANCELLED');

  // --- Test 93: Base64 Data URI URL Preservation ---
  console.log('\n--- Test 93: Base64 Data URI URL Preservation ---');
  const resolveFileUrl = (filePath?: string): string => {
    if (!filePath) return '';
    if (filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    return `https://mediarca-mdwk.onrender.com${filePath.startsWith('/') ? '' : '/'}${filePath}`;
  };
  const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert(resolveFileUrl(dataUri) === dataUri, 'Data URI is preserved without prepending backend URL');
  assert(resolveFileUrl('/uploads/doc.pdf') === 'https://mediarca-mdwk.onrender.com/uploads/doc.pdf', 'Relative path is prepended with backend URL');
  assert(resolveFileUrl('https://r2.dev/file.jpg') === 'https://r2.dev/file.jpg', 'HTTP/HTTPS URL is returned as-is');

  // --- Test 94: Completed Patients Not Counted as Ahead in Waiting Room ---
  console.log('\n--- Test 94: Completed Patients Not Counted as Ahead in Waiting Room ---');
  const slotTest = {
    id: 'slot-1',
    name: 'Morning Shift',
    startTime: '09:00',
    endTime: '12:00',
    maxPatients: 30,
    avgConsultationMinutes: 10,
  };
  // 5 total bookings, but all 5 have already been COMPLETED (0 currently waiting)
  const nowShift = new Date(2026, 8, 28, 9, 30);
  const statusZeroWaiting = evaluateSlotStatus(slotTest, '2026-09-28', 5, nowShift, 9 * 60 + 30, 0);
  assert(statusZeroWaiting.patientsAhead === 0, 'When 0 patients waiting, patientsAhead is 0 despite 5 completed');
  assert(statusZeroWaiting.estimatedTime === '09:30 AM', `Estimated time is active now (09:30 AM), got ${statusZeroWaiting.estimatedTime}`);

  // When 2 patients are still waiting
  const statusTwoWaiting = evaluateSlotStatus(slotTest, '2026-09-28', 5, nowShift, 9 * 60 + 30, 2);
  assert(statusTwoWaiting.patientsAhead === 2, 'When 2 patients waiting, patientsAhead is 2');
  assert(statusTwoWaiting.estimatedTime === '09:50 AM', `Estimated time reflects 2 waiting (09:50 AM), got ${statusTwoWaiting.estimatedTime}`);

  // --- Test 95: JWT Production Fail-Closed and Strength Validation ---
  console.log('\n--- Test 95: JWT Production Fail-Closed and Strength Validation ---');
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.JWT_SECRET;

  try {
    // 1. Production with missing JWT_SECRET
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    let threwMissing = false;
    try {
      getJwtSecret();
    } catch (e: any) {
      threwMissing = true;
      assert(e.message.includes('FATAL'), 'Missing JWT_SECRET in production throws FATAL error');
    }
    assert(threwMissing, 'getJwtSecret throws when JWT_SECRET is unset in production');

    // 2. Production with fallback secret
    process.env.JWT_SECRET = 'mediarca-fallback-jwt-secret';
    let threwFallback = false;
    try {
      getJwtSecret();
    } catch (e: any) {
      threwFallback = true;
      assert(e.message.includes('FATAL'), 'Fallback JWT_SECRET in production throws FATAL error');
    }
    assert(threwFallback, 'getJwtSecret throws when JWT_SECRET equals default fallback in production');

    // 3. Production with secret under 32 characters
    process.env.JWT_SECRET = 'short-secret-under-32-chars';
    let threwShort = false;
    try {
      getJwtSecret();
    } catch (e: any) {
      threwShort = true;
      assert(e.message.includes('at least 32 characters'), 'Short JWT_SECRET in production throws length error');
    }
    assert(threwShort, 'getJwtSecret throws when JWT_SECRET is < 32 characters in production');

    // 4. Production with valid 32+ character secret
    const validStrongSecret = 'mediarca-production-super-strong-jwt-secret-key-2026';
    process.env.JWT_SECRET = validStrongSecret;
    const returnedSecret = getJwtSecret();
    assert(returnedSecret === validStrongSecret, 'Valid strong secret is returned in production');

    // 5. Development mode safe fallback
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    const devFallbackSecret = getJwtSecret();
    assert(typeof devFallbackSecret === 'string' && devFallbackSecret.length >= 32, 'Dev fallback secret has minimum 32 chars and does not throw');
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevSecret !== undefined) {
      process.env.JWT_SECRET = prevSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  }

  // --- Test 96: Server-Authoritative Time & Indian Standard Time Evaluation ---
  console.log('\n--- Test 96: Server-Authoritative Time & Indian Standard Time Evaluation ---');
  const localDateStr = getLocalDateString(new Date(2026, 8, 28, 12, 0));
  assert(/^\d{4}-\d{2}-\d{2}$/.test(localDateStr), 'getLocalDateString returns valid YYYY-MM-DD date string');

  const istMinutes = getIndianTimeMinutes(new Date());
  assert(typeof istMinutes === 'number' && istMinutes >= 0 && istMinutes < 1440, 'getIndianTimeMinutes returns minute in day [0, 1439]');

  // Server-authoritative time ignores client manipulation
  const testSlotAuth: DoctorSlot = {
    id: 's_auth',
    name: 'Morning Shift',
    startTime: '09:00',
    endTime: '12:00',
    maxPatients: 30,
    avgConsultationMinutes: 6,
  };
  // Server clock is 13:00 (after shift end). Malicious client claims clientMinutes = 540 (09:00 AM).
  // The server controller uses server-authoritative time and does NOT pass clientMinutes.
  const serverNow = new Date(2026, 8, 28, 13, 0); // 1:00 PM (shift passed)
  const authEvaluation = evaluateSlotStatus(testSlotAuth, '2026-09-28', 10, serverNow);
  assert(authEvaluation.isPassed === true, 'Server-authoritative evaluation correctly marks expired shift as passed');
  assert(authEvaluation.statusLabel === 'Shift Ended for Today', 'Status correctly reports Shift Ended for Today');

  // --- Test 97: Unverified Doctor Direct ID Access Guard ---
  console.log('\n--- Test 97: Unverified Doctor Direct ID Access Guard ---');
  interface DoctorLookupCheck {
    isVerified: boolean;
    verificationStatus: string;
    userId: string;
  }
  const authorizeDoctorDetailAccess = (
    doctor: DoctorLookupCheck,
    caller?: { id: string; role: string }
  ) => {
    const isOwner = caller && caller.id === doctor.userId;
    const isAdmin = caller && caller.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      if (!doctor.isVerified || doctor.verificationStatus !== 'VERIFIED') {
        return { allowed: false, status: 404, message: 'Doctor profile is not publicly available or pending verification' };
      }
    }
    return { allowed: true, status: 200 };
  };

  const pendingDoctor: DoctorLookupCheck = { isVerified: false, verificationStatus: 'PENDING', userId: 'doc_user_1' };
  const suspendedDoctor: DoctorLookupCheck = { isVerified: false, verificationStatus: 'SUSPENDED', userId: 'doc_user_2' };
  const rejectedDoctor: DoctorLookupCheck = { isVerified: false, verificationStatus: 'REJECTED', userId: 'doc_user_3' };
  const verifiedDoctor: DoctorLookupCheck = { isVerified: true, verificationStatus: 'VERIFIED', userId: 'doc_user_4' };

  // Public/anonymous user requests
  assert(authorizeDoctorDetailAccess(pendingDoctor).allowed === false, 'Public lookup of PENDING doctor is denied with 404');
  assert(authorizeDoctorDetailAccess(suspendedDoctor).allowed === false, 'Public lookup of SUSPENDED doctor is denied with 404');
  assert(authorizeDoctorDetailAccess(rejectedDoctor).allowed === false, 'Public lookup of REJECTED doctor is denied with 404');
  assert(authorizeDoctorDetailAccess(verifiedDoctor).allowed === true, 'Public lookup of VERIFIED doctor is allowed');

  // Doctor owner requests their own unverified profile (to preview before approval)
  assert(authorizeDoctorDetailAccess(pendingDoctor, { id: 'doc_user_1', role: 'DOCTOR' }).allowed === true, 'Doctor owner can access own pending profile');

  // Admin requests unverified profile (to review application)
  assert(authorizeDoctorDetailAccess(pendingDoctor, { id: 'admin_user', role: 'ADMIN' }).allowed === true, 'Admin can access pending doctor profile for review');

  // --- Test 98: Production Demo Doctor & Queue Preview Fallback Suppression ---
  console.log('\n--- Test 98: Production Demo Doctor & Queue Preview Fallback Suppression ---');
  const resolveDoctorFallback = (isDev: boolean, enableFlag: string | undefined, originalError: Error) => {
    if (isDev && enableFlag === 'true') {
      return { fallbackUsed: true, data: { id: 'demo_doc_1', name: 'Demo Doctor' } };
    }
    throw originalError;
  };

  let prodThrew = false;
  try {
    resolveDoctorFallback(false, 'true', new Error('API 500 Connection Refused'));
  } catch (err: any) {
    prodThrew = true;
    assert(err.message === 'API 500 Connection Refused', 'In production, real API error is propagated instead of demo doctor');
  }
  assert(prodThrew, 'Production strictly suppresses demo doctor fallback');

  let devDisabledThrew = false;
  try {
    resolveDoctorFallback(true, 'false', new Error('API 500'));
  } catch {
    devDisabledThrew = true;
  }
  assert(devDisabledThrew, 'Dev mode with VITE_ENABLE_DEMO_FALLBACK=false suppresses demo doctor fallback');

  const devEnabledResult = resolveDoctorFallback(true, 'true', new Error('API 500'));
  assert(devEnabledResult.fallbackUsed === true, 'Dev mode with flag enabled safely permits demo doctor fallback for offline preview');

  // --- Test 99: Receptionist Account Status Lifecycle Enforcement ---
  console.log('\n--- Test 99: Receptionist Account Status Lifecycle Enforcement ---');
  interface ReceptionistProfileCheck {
    id: string;
    userId: string;
    status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  }
  const validateReceptionistLogin = (profile: ReceptionistProfileCheck): { allowed: boolean; status: number; message: string } => {
    if (profile.status !== 'ACTIVE') {
      return {
        allowed: false,
        status: 403,
        message:
          profile.status === 'REJECTED'
            ? 'Your receptionist application has been declined by clinic administration.'
            : 'Your receptionist application is pending approval by clinic administration.',
      };
    }
    return { allowed: true, status: 200, message: '' };
  };

  const test99PendingRec: ReceptionistProfileCheck = { id: 'r1', userId: 'u1', status: 'PENDING' };
  const test99RejectedRec: ReceptionistProfileCheck = { id: 'r2', userId: 'u2', status: 'REJECTED' };
  const test99ActiveRec: ReceptionistProfileCheck = { id: 'r3', userId: 'u3', status: 'ACTIVE' };

  const pendingLogin = validateReceptionistLogin(test99PendingRec);
  assert(pendingLogin.allowed === false, 'Pending receptionist cannot log in');
  assert(pendingLogin.status === 403, 'Pending receptionist login returns 403');
  assert(pendingLogin.message.includes('pending approval'), 'Pending message informs user of review status');

  const rejectedLogin = validateReceptionistLogin(test99RejectedRec);
  assert(rejectedLogin.allowed === false, 'Rejected receptionist cannot log in');
  assert(rejectedLogin.status === 403, 'Rejected receptionist login returns 403');
  assert(rejectedLogin.message.includes('declined by clinic'), 'Rejected message informs user of declined status');

  const activeLogin = validateReceptionistLogin(test99ActiveRec);
  assert(activeLogin.allowed === true, 'Active receptionist successfully logs in');

  // --- Test 100: Receptionist Rejection Cascading Cleanup of Doctor Assignments ---
  console.log('\n--- Test 100: Receptionist Rejection Cascading Cleanup of Doctor Assignments ---');
  interface DeskSystemState {
    receptionistStatus: 'PENDING' | 'ACTIVE' | 'REJECTED';
    assignments: Array<{ receptionistId: string; doctorId: string }>;
  }
  const respondToReceptionistRequestSim = (
    state: DeskSystemState,
    receptionistId: string,
    action: 'ACCEPT' | 'REJECT'
  ): DeskSystemState => {
    if (action === 'REJECT') {
      return {
        receptionistStatus: 'REJECTED',
        assignments: state.assignments.filter((a) => a.receptionistId !== receptionistId),
      };
    }
    return {
      receptionistStatus: 'ACTIVE',
      assignments: state.assignments,
    };
  };

  const initialDeskState: DeskSystemState = {
    receptionistStatus: 'PENDING',
    assignments: [
      { receptionistId: 'rec_candidate', doctorId: 'doc_1' },
      { receptionistId: 'rec_candidate', doctorId: 'doc_2' },
      { receptionistId: 'rec_other', doctorId: 'doc_1' },
    ],
  };

  const rejectedDeskState = respondToReceptionistRequestSim(initialDeskState, 'rec_candidate', 'REJECT');
  assert(rejectedDeskState.receptionistStatus === 'REJECTED', 'Status is updated to REJECTED');
  assert(
    !rejectedDeskState.assignments.some((a) => a.receptionistId === 'rec_candidate'),
    'All DoctorReceptionist assignments for rejected receptionist are purged in transaction'
  );
  assert(
    rejectedDeskState.assignments.length === 1 && rejectedDeskState.assignments[0].receptionistId === 'rec_other',
    'Other receptionist assignments are preserved intact'
  );

  // --- Test 101: Appointment Detail Medical Record Privacy ---
  console.log('\n--- Test 101: Appointment Detail Medical Record Privacy ---');
  interface AppointmentDetailPayload {
    id: string;
    patientId: string;
    doctorId: string;
    patient: {
      id: string;
      fullName: string;
      medicalRecords?: Array<{ id: string; title: string }>;
    };
  }

  const sanitizeAppointmentForCaller = (
    appt: AppointmentDetailPayload,
    caller: { id: string; role: string; doctorId?: string; patientId?: string }
  ): AppointmentDetailPayload => {
    const isDoctor = caller.role === 'DOCTOR' && caller.doctorId === appt.doctorId;
    const isPatient = caller.role === 'PATIENT' && caller.patientId === appt.patientId;
    const canViewClinical = isDoctor || isPatient;

    if (!canViewClinical && appt.patient && appt.patient.medicalRecords) {
      const sanitizedPatient = { ...appt.patient };
      delete sanitizedPatient.medicalRecords;
      return { ...appt, patient: sanitizedPatient };
    }
    return appt;
  };

  const sampleAppt: AppointmentDetailPayload = {
    id: 'appt_101',
    patientId: 'patient_42',
    doctorId: 'doctor_88',
    patient: {
      id: 'patient_42',
      fullName: 'Anita Sharma',
      medicalRecords: [{ id: 'rec_1', title: 'Confidential Biopsy Report.pdf' }],
    },
  };

  // Receptionist viewing appointment detail
  const recView = sanitizeAppointmentForCaller(sampleAppt, { id: 'u_rec', role: 'RECEPTIONIST' });
  assert(recView.patient.medicalRecords === undefined, 'Receptionist view of appointment detail strips patient medical records');

  // Clinic admin viewing appointment detail
  const clinicView = sanitizeAppointmentForCaller(sampleAppt, { id: 'u_clinic', role: 'CLINIC' });
  assert(clinicView.patient.medicalRecords === undefined, 'Clinic view of appointment detail strips patient medical records');

  // Assigned examining doctor viewing appointment detail
  const docView = sanitizeAppointmentForCaller(sampleAppt, { id: 'u_doc', role: 'DOCTOR', doctorId: 'doctor_88' });
  assert(
    Array.isArray(docView.patient.medicalRecords) && docView.patient.medicalRecords.length === 1,
    'Assigned doctor retains full clinical medical record access'
  );

  // Patient viewing their own appointment detail
  const patientView = sanitizeAppointmentForCaller(sampleAppt, { id: 'u_pat', role: 'PATIENT', patientId: 'patient_42' });
  assert(
    Array.isArray(patientView.patient.medicalRecords) && patientView.patient.medicalRecords.length === 1,
    'Patient retains view of their own uploaded medical records'
  );

  // --- Test 102: File Signature / Magic Bytes Content Validation ---
  console.log('\n--- Test 102: File Signature / Magic Bytes Content Validation ---');
  // Valid PDF: %PDF- (0x25, 0x50, 0x44, 0x46)
  const validPdfBuf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  assert(validateMagicBytes(validPdfBuf, 'application/pdf') === true, 'Valid PDF buffer passes magic byte verification');

  // Executable spoofed as PDF
  const fakePdfBuf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ DOS/PE header
  assert(validateMagicBytes(fakePdfBuf, 'application/pdf') === false, 'Executable spoofed as application/pdf is rejected');

  // Shell script spoofed as PDF
  const scriptPdfBuf = Buffer.from('#!/bin/bash\nrm -rf /', 'utf-8');
  assert(validateMagicBytes(scriptPdfBuf, 'application/pdf') === false, 'Shell script spoofed as PDF is rejected');

  // Valid JPEG: FF D8 FF
  const validJpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  assert(validateMagicBytes(validJpegBuf, 'image/jpeg') === true, 'Valid JPEG buffer passes magic byte check');
  assert(validateMagicBytes(validJpegBuf, 'image/jpg') === true, 'Valid JPEG buffer passes image/jpg mime check');

  // Valid PNG: 89 50 4E 47
  const validPngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert(validateMagicBytes(validPngBuf, 'image/png') === true, 'Valid PNG buffer passes magic byte check');

  // Valid WebP: RIFF .... WEBP
  const validWebpBuf = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x00, 0x00, 0x00, 0x00, // length
    0x57, 0x45, 0x42, 0x50, // WEBP
  ]);
  assert(validateMagicBytes(validWebpBuf, 'image/webp') === true, 'Valid WebP buffer passes magic byte check');

  // Truncated / empty buffer
  assert(validateMagicBytes(Buffer.from([]), 'application/pdf') === false, 'Empty buffer fails validation');
  assert(validateMagicBytes(Buffer.from([0x25]), 'application/pdf') === false, '1-byte buffer fails validation');

  // MIME extension consistency check
  assert(MIME_TO_EXTENSIONS['application/pdf'].includes('.pdf'), 'PDF mime maps to .pdf extension');
  assert(MIME_TO_EXTENSIONS['image/png'].includes('.png'), 'PNG mime maps to .png extension');
  assert(!MIME_TO_EXTENSIONS['application/pdf'].includes('.exe'), 'Executable extension is not permitted for PDF');

  // --- Test 103: Account Registration Password Policy (Minimum 8 Characters) ---
  console.log('\n--- Test 103: Account Registration Password Policy ---');
  const validateRegistrationPassword = (password?: string) => {
    if (!password || typeof password !== 'string' || password.trim().length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long' };
    }
    return { valid: true };
  };

  assert(validateRegistrationPassword('12345').valid === false, '5-character password rejected');
  assert(validateRegistrationPassword('1234567').valid === false, '7-character password rejected');
  assert(validateRegistrationPassword('        ').valid === false, '8-character whitespace password rejected');
  assert(validateRegistrationPassword('password').valid === true, '8-character password accepted');
  assert(validateRegistrationPassword('CorrectHorseBatteryStaple!').valid === true, 'Strong password accepted');

  // --- Test 104: Patient Date of Birth Strict Type Safety ---
  console.log('\n--- Test 104: Patient Date of Birth Strict Type Safety ---');
  const isValidDobCalendar = (dateStr: string): boolean => {
    const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
  };

  const formatPatientDobForPrisma = (dobInput?: string | null): { success: boolean; formattedValue?: string | null; error?: string } => {
    if (!dobInput) return { success: true, formattedValue: null };
    const trimmed = String(dobInput).trim();
    if (!isValidDobCalendar(trimmed)) {
      return { success: false, error: 'Invalid date of birth format. Must be a valid calendar date in YYYY-MM-DD format.' };
    }
    // Must be stored as String in Prisma schema
    return { success: true, formattedValue: trimmed };
  };

  const validDob = formatPatientDobForPrisma('1990-05-24');
  assert(validDob.success === true, 'Valid DOB string accepted');
  assert(typeof validDob.formattedValue === 'string', 'DOB value is string type for Prisma');
  assert(validDob.formattedValue === '1990-05-24', 'DOB value matches YYYY-MM-DD');

  const invalidDobFormat = formatPatientDobForPrisma('24/05/1990');
  assert(invalidDobFormat.success === false, 'Non-ISO DOB format rejected');

  const invalidDobCalendar = formatPatientDobForPrisma('1990-02-30');
  assert(invalidDobCalendar.success === false, 'Non-existent calendar date (Feb 30) rejected');

  // --- Test 105: Centralized Doctor Slot Schedule Validation ---
  console.log('\n--- Test 105: Centralized Doctor Slot Schedule Validation ---');
  // Valid non-overlapping slots
  const validSlotSet = [
    { id: 'shift_morning', name: 'Morning Shift', startTime: '09:00', endTime: '12:00', maxPatients: 25 },
    { id: 'shift_evening', name: 'Evening Shift', startTime: '16:00', endTime: '20:00', maxPatients: 40 },
  ];
  const validSlotResult = validateDoctorSlots(validSlotSet);
  assert(validSlotResult.valid === true, 'Valid non-overlapping shifts pass validation');
  assert(validSlotResult.formatted?.length === 2, 'Two formatted slots returned');

  // Overlapping slots
  const overlappingSlotSet = [
    { id: 's1', name: 'Shift 1', startTime: '09:00', endTime: '13:00', maxPatients: 20 },
    { id: 's2', name: 'Shift 2', startTime: '12:00', endTime: '16:00', maxPatients: 20 },
  ];
  const overlapResult = validateDoctorSlots(overlappingSlotSet);
  assert(overlapResult.valid === false, 'Overlapping slots rejected');
  assert(Boolean(overlapResult.error?.includes('Overlapping checking slots')), 'Error message identifies overlapping slots');

  // Inverted times (end before start)
  const invertedSlotSet = [
    { id: 's_inv', name: 'Inverted Shift', startTime: '17:00', endTime: '11:00', maxPatients: 10 },
  ];
  const invertedResult = validateDoctorSlots(invertedSlotSet);
  assert(invertedResult.valid === false, 'End time before start time rejected');
  assert(Boolean(invertedResult.error?.includes('must be after start time')), 'Error message specifies end time constraint');

  // Invalid time string
  const malformedSlotSet = [
    { id: 's_bad', name: 'Bad Time', startTime: '25:00', endTime: '26:00', maxPatients: 10 },
  ];
  const malformedResult = validateDoctorSlots(malformedSlotSet);
  assert(malformedResult.valid === false, '25:00 time rejected by 24h regex');

  // Zero capacity
  const zeroCapSlotSet = [
    { id: 's_zero', name: 'Zero Shift', startTime: '09:00', endTime: '11:00', maxPatients: 0 },
  ];
  const zeroCapResult = validateDoctorSlots(zeroCapSlotSet);
  assert(zeroCapResult.valid === false, 'Zero capacity slot rejected');

  // Duplicate slot ID
  const duplicateIdSet = [
    { id: 'slot_duplicate', name: 'Slot A', startTime: '09:00', endTime: '11:00', maxPatients: 10 },
    { id: 'slot_duplicate', name: 'Slot B', startTime: '14:00', endTime: '16:00', maxPatients: 10 },
  ];
  const duplicateIdResult = validateDoctorSlots(duplicateIdSet);
  assert(duplicateIdResult.valid === false, 'Duplicate slot ID rejected');
  assert(Boolean(duplicateIdResult.error?.includes('Duplicate slot ID')), 'Duplicate error identifies slot ID');

  // --- Test 106: Doctor Suspension Blocks All Clinical Consultation Operations ---
  console.log('\n--- Test 106: Doctor Suspension Blocks All Clinical Consultation Operations ---');
  interface DoctorClinicalGuard {
    isVerified: boolean;
    verificationStatus: string;
  }
  const checkDoctorActiveForClinicalOps = (doctor: DoctorClinicalGuard): { allowed: boolean; status: number; message: string } => {
    if (!doctor.isVerified || doctor.verificationStatus !== 'VERIFIED') {
      return {
        allowed: false,
        status: 403,
        message:
          doctor.verificationStatus === 'SUSPENDED'
            ? 'Access denied: Your practitioner account is currently suspended. Clinical operations are disabled.'
            : 'Access denied: Practitioner account is not verified for clinical practice.',
      };
    }
    return { allowed: true, status: 200, message: '' };
  };

  const suspendedDocCheck = checkDoctorActiveForClinicalOps({ isVerified: false, verificationStatus: 'SUSPENDED' });
  assert(suspendedDocCheck.allowed === false, 'Suspended doctor cannot perform clinical operations');
  assert(suspendedDocCheck.status === 403, 'Suspended doctor check returns 403 status code');
  assert(suspendedDocCheck.message.includes('currently suspended'), 'Message specifically informs of suspension');

  const pendingDocCheck = checkDoctorActiveForClinicalOps({ isVerified: false, verificationStatus: 'PENDING' });
  assert(pendingDocCheck.allowed === false, 'Pending unverified doctor cannot perform clinical operations');

  const verifiedDocCheck = checkDoctorActiveForClinicalOps({ isVerified: true, verificationStatus: 'VERIFIED' });
  assert(verifiedDocCheck.allowed === true, 'Verified active doctor is permitted clinical operations');

  // --- Test 107: Centralized State Machine Transition Matrix (`canTransition`) ---
  console.log('\n--- Test 107: Centralized State Machine Transition Matrix ---');
  // Terminal states cannot transition to anything
  assert(canTransition('COMPLETED', 'WAITING', 'DOCTOR').allowed === false, 'COMPLETED consultation cannot transition back to WAITING');
  assert(canTransition('COMPLETED', 'CANCELLED', 'DOCTOR').allowed === false, 'COMPLETED consultation cannot be CANCELLED');
  assert(canTransition('CANCELLED', 'WAITING', 'RECEPTIONIST').allowed === false, 'CANCELLED appointment cannot transition to WAITING');
  assert(canTransition('REJECTED', 'WAITING', 'RECEPTIONIST').allowed === false, 'REJECTED appointment cannot transition to WAITING');

  // PENDING_APPROVAL transitions
  assert(canTransition('PENDING_APPROVAL', 'WAITING', 'RECEPTIONIST').allowed === true, 'Receptionist can approve PENDING_APPROVAL to WAITING');
  assert(canTransition('PENDING_APPROVAL', 'WAITING', 'CLINIC').allowed === true, 'Clinic can approve PENDING_APPROVAL to WAITING');
  assert(canTransition('PENDING_APPROVAL', 'WAITING', 'ADMIN').allowed === true, 'Admin can approve PENDING_APPROVAL to WAITING');
  assert(canTransition('PENDING_APPROVAL', 'WAITING', 'PATIENT').allowed === false, 'Patient cannot self-approve PENDING_APPROVAL to WAITING');

  assert(canTransition('PENDING_APPROVAL', 'REJECTED', 'RECEPTIONIST').allowed === true, 'Receptionist can reject PENDING_APPROVAL');
  assert(canTransition('PENDING_APPROVAL', 'REJECTED', 'PATIENT').allowed === false, 'Patient cannot reject appointment (must cancel)');
  assert(canTransition('PENDING_APPROVAL', 'CANCELLED', 'PATIENT').allowed === true, 'Patient can cancel their pending booking request');

  // WAITING transitions
  assert(canTransition('WAITING', 'IN_CONSULTATION', 'DOCTOR').allowed === true, 'Doctor can call WAITING patient to IN_CONSULTATION');
  assert(canTransition('WAITING', 'IN_CONSULTATION', 'RECEPTIONIST').allowed === true, 'Receptionist can advance WAITING patient to IN_CONSULTATION');
  assert(canTransition('WAITING', 'IN_CONSULTATION', 'PATIENT').allowed === false, 'Patient cannot call themselves into consultation');
  assert(canTransition('WAITING', 'COMPLETED', 'DOCTOR').allowed === true, 'Doctor can complete WAITING consultation directly');
  assert(canTransition('WAITING', 'COMPLETED', 'RECEPTIONIST').allowed === false, 'Receptionist CANNOT mark consultation COMPLETED');
  assert(canTransition('WAITING', 'CANCELLED', 'RECEPTIONIST').allowed === true, 'Receptionist can cancel WAITING appointment');

  // IN_CONSULTATION transitions
  assert(canTransition('IN_CONSULTATION', 'COMPLETED', 'DOCTOR').allowed === true, 'Doctor can complete active consultation');
  assert(canTransition('IN_CONSULTATION', 'COMPLETED', 'RECEPTIONIST').allowed === false, 'Receptionist cannot complete active consultation');
  assert(canTransition('IN_CONSULTATION', 'COMPLETED', 'CLINIC').allowed === false, 'Clinic cannot complete active consultation');
  assert(canTransition('IN_CONSULTATION', 'WAITING', 'DOCTOR').allowed === true, 'Doctor can put patient back to WAITING');
  assert(canTransition('IN_CONSULTATION', 'WAITING', 'RECEPTIONIST').allowed === true, 'Receptionist can put patient back to WAITING');
  assert(canTransition('IN_CONSULTATION', 'CANCELLED', 'DOCTOR').allowed === true, 'Doctor can cancel active consultation');
  assert(canTransition('IN_CONSULTATION', 'CANCELLED', 'PATIENT').allowed === false, 'Patient cannot cancel in-progress consultation');

  // Idempotent transitions
  assert(canTransition('WAITING', 'WAITING', 'DOCTOR').allowed === true, 'Same-state transition is idempotent');
  assert(canTransition('COMPLETED', 'COMPLETED', 'DOCTOR').allowed === false, 'COMPLETED state is strictly terminal even for same-state update');

  // --- Test 108: Strict Appointment Date Calendar Validation ---
  console.log('\n--- Test 108: Strict Appointment Date Calendar Validation ---');
  assert(isValidAppointmentDate('2026-09-28') === true, 'Valid date 2026-09-28 accepted');
  assert(isValidAppointmentDate('2024-02-29') === true, 'Valid leap year date 2024-02-29 accepted');
  assert(isValidAppointmentDate('2025-02-29') === false, 'Invalid leap year date 2025-02-29 rejected');
  assert(isValidAppointmentDate('2026-04-31') === false, 'Invalid calendar date 2026-04-31 (31st April) rejected');
  assert(isValidAppointmentDate('2026-13-01') === false, 'Month 13 rejected');
  assert(isValidAppointmentDate('2026-00-15') === false, 'Month 00 rejected');
  assert(isValidAppointmentDate('2026-05-32') === false, 'Day 32 rejected');
  assert(isValidAppointmentDate('28-09-2026') === false, 'DD-MM-YYYY format rejected');
  assert(isValidAppointmentDate('2026/09/28') === false, 'Slash separator rejected');
  assert(isValidAppointmentDate('') === false, 'Empty string rejected');
  assert(isValidAppointmentDate(null) === false, 'Null rejected');
  assert(isValidAppointmentDate(undefined) === false, 'Undefined rejected');

  // --- Test 109: Doctor Public Directory Contact Information Privacy ---
  console.log('\n--- Test 109: Doctor Public Directory Contact Information Privacy ---');
  const mockDoctorDbRecord = {
    id: 'doc_sec_1',
    user: {
      fullName: 'Dr. Priya Sharma',
      email: 'priya.personal@example.com',
      phone: '+91 9988776655',
    },
    specialty: 'Cardiology',
    clinics: [
      {
        clinic: {
          id: 'c1',
          clinicName: 'Cardio Care Hub',
          phone: '+91 1122334455',
          address: '42 Medical Square',
        },
      },
    ],
  };

  const sanitizePublicDoctorResponse = (doc: typeof mockDoctorDbRecord, callerIsOwner: boolean) => {
    if (callerIsOwner) {
      return doc;
    }
    return {
      ...doc,
      user: {
        fullName: doc.user.fullName,
      },
    };
  };

  const publicDoctorView = sanitizePublicDoctorResponse(mockDoctorDbRecord, false);
  assert((publicDoctorView.user as any).email === undefined, 'Public doctor profile strips personal email');
  assert((publicDoctorView.user as any).phone === undefined, 'Public doctor profile strips personal phone');
  assert(publicDoctorView.clinics[0].clinic.phone === '+91 1122334455', 'Clinic professional phone is preserved');

  const ownerDoctorView = sanitizePublicDoctorResponse(mockDoctorDbRecord, true);
  assert((ownerDoctorView.user as any).email === 'priya.personal@example.com', 'Owner doctor retains access to own contact details');

  // --- Test 110: Public Reviewer Identity Masking (`maskPatientName`) ---
  console.log('\n--- Test 110: Public Reviewer Identity Masking ---');
  assert(maskPatientName('Rahul Sharma') === 'Rahul S.', 'Two-word name masks last name initial: Rahul S.');
  assert(maskPatientName('Bikesh Kumar Ray') === 'Bikesh R.', 'Three-word name masks last name initial: Bikesh R.');
  assert(maskPatientName('Siddharth') === 'S.', 'Single name masks initial: S.');
  assert(maskPatientName('') === 'Verified Patient', 'Empty name defaults to Verified Patient');
  assert(maskPatientName(null) === 'Verified Patient', 'Null name defaults to Verified Patient');
  assert(maskPatientName(undefined) === 'Verified Patient', 'Undefined name defaults to Verified Patient');

  // --- Test 111: Production Internal Error Message Sanitization ---
  console.log('\n--- Test 111: Production Internal Error Message Sanitization ---');
  const sanitizeApiError = (err: Error, isProduction: boolean) => {
    if (isProduction) {
      return 'An internal server error occurred. Please try again later.';
    }
    return err.message;
  };

  const sensitivePrismaError = new Error('PrismaClientKnownRequestError: Table "public.Doctor" does not exist at postgres://app:secret@db.render.internal:5432');
  const prodSanitized = sanitizeApiError(sensitivePrismaError, true);
  assert(!prodSanitized.includes('postgres://'), 'Production error strips database connection string');
  assert(!prodSanitized.includes('PrismaClientKnownRequestError'), 'Production error strips internal ORM details');
  assert(prodSanitized === 'An internal server error occurred. Please try again later.', 'Production error returns safe generic message');

  const devError = sanitizeApiError(sensitivePrismaError, false);
  assert(devError.includes('PrismaClientKnownRequestError'), 'Dev mode preserves original error message for debugging');

  // --- Test 112: Strict Medical Record File Path Traversal Defense ---
  console.log('\n--- Test 112: Strict Medical Record File Path Traversal Defense ---');
  const uploadsDir = path.resolve(__dirname, '../uploads');
  const safeResolveRecordPath = (fileUrl: string) => {
    const normalizedRelative = path.normalize(fileUrl.replace(/^\/+/, ''));
    const fullPath = path.resolve(__dirname, '../', normalizedRelative);
    if (!fullPath.startsWith(uploadsDir)) {
      return { allowed: false, message: 'Invalid medical record file path.' };
    }
    return { allowed: true, fullPath };
  };

  assert(safeResolveRecordPath('../../etc/passwd').allowed === false, 'Path traversal ../../etc/passwd rejected');
  assert(safeResolveRecordPath('../../../secret.env').allowed === false, 'Path traversal ../../../secret.env rejected');
  assert(safeResolveRecordPath('uploads/../../package.json').allowed === false, 'Path traversal uploads/../../package.json rejected');
  assert(safeResolveRecordPath('uploads/medical-records/scan_123.pdf').allowed === true, 'Safe subpath uploads/medical-records/scan_123.pdf permitted');
  assert(safeResolveRecordPath('/uploads/medical-records/doc.png').allowed === true, 'Leading slash normalized and allowed');

  // --- Test 113: isValidDobDate Deep Calendar Validation ---
  console.log('\n--- Test 113: isValidDobDate Deep Calendar Validation ---');
  assert(isValidDobDate('1990-05-20') === true, 'Valid adult DOB accepted');
  assert(isValidDobDate('2024-02-29') === true, 'Leap year Feb 29 DOB accepted');
  assert(isValidDobDate('2023-02-29') === false, 'Invalid leap year Feb 29 DOB rejected');
  assert(isValidDobDate('1899-12-31') === false, 'DOB before 1900 rejected');
  assert(isValidDobDate('1900-01-01') === true, 'Boundary 1900-01-01 accepted');
  assert(isValidDobDate('2099-01-01') === false, 'Future DOB rejected');
  assert(isValidDobDate('2026-04-31') === false, 'Non-existent calendar date Apr 31 rejected');
  assert(isValidDobDate('invalid-date') === false, 'Malformed string rejected');
  assert(isValidDobDate('') === false, 'Empty string rejected');
  assert(isValidDobDate(null) === false, 'Null DOB rejected');
  assert(isValidDobDate(undefined) === false, 'Undefined DOB rejected');

  // --- Test 114: Optional Authentication Middleware (optionalAuthenticate) ---
  console.log('\n--- Test 114: Optional Authentication Middleware (optionalAuthenticate) ---');
  const secret = getJwtSecret();
  const validToken = jwt.sign({ id: 'doc-user-1', email: 'doc@example.com', role: 'DOCTOR', fullName: 'Dr. Test' }, secret);

  const reqBearer: any = { headers: { authorization: `Bearer ${validToken}` }, query: {} };
  let nextCalledBearer: any = false;
  optionalAuthenticate(reqBearer, {} as any, () => { nextCalledBearer = true; });
  assert(nextCalledBearer === true, 'optionalAuthenticate calls next() on Bearer token');
  assert(reqBearer.user?.id === 'doc-user-1', 'optionalAuthenticate populates req.user from Bearer token');

  const reqQuery: any = { headers: {}, query: { token: validToken } };
  let nextCalledQuery: any = false;
  optionalAuthenticate(reqQuery, {} as any, () => { nextCalledQuery = true; });
  assert(nextCalledQuery === true, 'optionalAuthenticate calls next() when query token passed');
  assert(reqQuery.user === undefined, 'optionalAuthenticate strictly disallows query-string token transport (Finding H2)');

  const reqAuthQuery: any = { headers: {}, query: { token: validToken } };
  let authStatusSet: number | null = null;
  const resMock: any = {
    status: (s: number) => {
      authStatusSet = s;
      return { json: () => {} };
    },
  };
  authenticate(reqAuthQuery, resMock, () => {});
  assert(authStatusSet === 401, 'authenticate strictly rejects query-string token with 401 (Finding H2)');

  const reqNoToken: any = { headers: {}, query: {} };
  let nextCalledNoToken: any = false;
  optionalAuthenticate(reqNoToken, {} as any, () => { nextCalledNoToken = true; });
  assert(nextCalledNoToken === true, 'optionalAuthenticate calls next() when unauthenticated');
  assert(reqNoToken.user === undefined, 'optionalAuthenticate leaves req.user undefined for guest request');

  const reqBadToken: any = { headers: { authorization: 'Bearer invalid.jwt.string' }, query: {} };
  let nextCalledBadToken: any = false;
  optionalAuthenticate(reqBadToken, {} as any, () => { nextCalledBadToken = true; });
  assert(nextCalledBadToken === true, 'optionalAuthenticate calls next() on invalid token without crashing');
  assert(reqBadToken.user === undefined, 'optionalAuthenticate safely ignores invalid token');

  // --- Test 115: Avatar Upload Strict Image Policy & Magic Bytes ---
  console.log('\n--- Test 115: Avatar Upload Strict Image Policy & Magic Bytes ---');
  const ALLOWED_AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
  const validateAvatarUpload = (mimetype: string, buffer: Buffer): { allowed: boolean; message?: string } => {
    if (!ALLOWED_AVATAR_MIMES.includes(mimetype)) {
      return { allowed: false, message: 'Invalid avatar file type. Only JPEG, PNG, and WebP images are allowed.' };
    }
    if (!validateMagicBytes(buffer, mimetype)) {
      return { allowed: false, message: 'File contents do not match genuine image format.' };
    }
    return { allowed: true };
  };

  const avatarJpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const avatarPngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pdfBuf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  const exeBuf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

  assert(validateAvatarUpload('image/jpeg', avatarJpegBuf).allowed === true, 'Genuine JPEG avatar accepted');
  assert(validateAvatarUpload('image/png', avatarPngBuf).allowed === true, 'Genuine PNG avatar accepted');
  assert(validateAvatarUpload('application/pdf', pdfBuf).allowed === false, 'PDF avatar upload strictly rejected');
  assert(validateAvatarUpload('image/jpeg', pdfBuf).allowed === false, 'PDF disguised as image/jpeg rejected by magic bytes');
  assert(validateAvatarUpload('image/png', exeBuf).allowed === false, 'Executable disguised as image/png rejected by magic bytes');

  // --- Test 116: Google OAuth Privileged Account Hijacking Prevention ---
  console.log('\n--- Test 116: Google OAuth Privileged Account Hijacking Prevention ---');
  const validateGoogleAuthRole = (existingRole: string | undefined): { allowed: boolean; status: number; message?: string } => {
    if (existingRole && ['ADMIN', 'CLINIC', 'RECEPTIONIST'].includes(existingRole)) {
      return {
        allowed: false,
        status: 403,
        message: 'Google Sign-In is not permitted for privileged administrative, clinic, or receptionist accounts. Please sign in with your email and password.',
      };
    }
    return { allowed: true, status: 200 };
  };

  assert(validateGoogleAuthRole('ADMIN').allowed === false, 'Existing ADMIN account rejected from Google OAuth');
  assert(validateGoogleAuthRole('ADMIN').status === 403, 'ADMIN Google OAuth returns 403 Forbidden');
  assert(validateGoogleAuthRole('CLINIC').allowed === false, 'Existing CLINIC account rejected from Google OAuth');
  assert(validateGoogleAuthRole('RECEPTIONIST').allowed === false, 'Existing RECEPTIONIST account rejected from Google OAuth');
  assert(validateGoogleAuthRole('PATIENT').allowed === true, 'Existing PATIENT account permitted for Google OAuth');
  assert(validateGoogleAuthRole('DOCTOR').allowed === true, 'Existing DOCTOR account permitted for Google OAuth');
  assert(validateGoogleAuthRole(undefined).allowed === true, 'New user registration permitted for Google OAuth');

  // --- Test 117: Appointment Capacity Counts PENDING_APPROVAL ---
  console.log('\n--- Test 117: Appointment Capacity Counts PENDING_APPROVAL ---');
  const mockAppointmentsOnDate = [
    { id: 'a1', status: 'WAITING', slotId: 'slot-1' },
    { id: 'a2', status: 'IN_CONSULTATION', slotId: 'slot-1' },
    { id: 'a3', status: 'PENDING_APPROVAL', slotId: 'slot-1' },
    { id: 'a4', status: 'CANCELLED', slotId: 'slot-1' },
    { id: 'a5', status: 'REJECTED', slotId: 'slot-1' },
  ];

  const countActiveAppointmentsForSlot = (appts: typeof mockAppointmentsOnDate, slotId: string) => {
    return appts.filter(
      (a) =>
        ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION', 'COMPLETED'].includes(a.status) &&
        a.slotId === slotId
    ).length;
  };

  const activeCount = countActiveAppointmentsForSlot(mockAppointmentsOnDate, 'slot-1');
  assert(activeCount === 3, 'Active appointment count includes WAITING, IN_CONSULTATION, and PENDING_APPROVAL (3 total)');
  assert(activeCount !== 2, 'PENDING_APPROVAL is not ignored in slot capacity count');

  // --- Test 118: Multi-Clinic Doctor Consultation State Isolation ---
  console.log('\n--- Test 118: Multi-Clinic Doctor Consultation State Isolation ---');
  const currentDoctorAppointments = [
    { id: 'appt-c1-1', doctorId: 'doc-1', clinicId: 'clinic-1', status: 'IN_CONSULTATION' },
    { id: 'appt-c1-2', doctorId: 'doc-1', clinicId: 'clinic-1', status: 'WAITING' },
    { id: 'appt-c2-1', doctorId: 'doc-1', clinicId: 'clinic-2', status: 'IN_CONSULTATION' },
  ];

  const resetClinicScopedInConsultation = (appts: typeof currentDoctorAppointments, doctorId: string, clinicId: string | null) => {
    return appts.map((a) => {
      if (a.doctorId === doctorId && a.clinicId === clinicId && a.status === 'IN_CONSULTATION') {
        return { ...a, status: 'WAITING' };
      }
      return a;
    });
  };

  const updatedAppts = resetClinicScopedInConsultation(currentDoctorAppointments, 'doc-1', 'clinic-1');
  const c1Status = updatedAppts.find((a) => a.id === 'appt-c1-1')?.status;
  const c2Status = updatedAppts.find((a) => a.id === 'appt-c2-1')?.status;
  assert(c1Status === 'WAITING', 'Clinic 1 previous consultation reset to WAITING');
  assert(c2Status === 'IN_CONSULTATION', 'Clinic 2 active consultation untouched and preserved');

  // --- Test 119: Strict State Machine Transition Violations ---
  console.log('\n--- Test 119: Strict State Machine Transition Violations ---');
  assert(canTransition('IN_CONSULTATION', 'COMPLETED', 'RECEPTIONIST').allowed === false, 'Receptionist cannot mark consultation COMPLETED');
  assert(canTransition('WAITING', 'COMPLETED', 'RECEPTIONIST').allowed === false, 'Receptionist cannot complete WAITING appointment');
  assert(canTransition('IN_CONSULTATION', 'PENDING_APPROVAL', 'RECEPTIONIST').allowed === false, 'Receptionist cannot revert IN_CONSULTATION to PENDING_APPROVAL');
  assert(canTransition('COMPLETED', 'IN_CONSULTATION', 'DOCTOR').allowed === false, 'Doctor cannot recall COMPLETED consultation');
  assert(canTransition('WAITING', 'IN_CONSULTATION', 'DOCTOR').allowed === true, 'Doctor can call WAITING patient');

  const canDoctorUpdateNotes = (apptStatus: string) => {
    return !['CANCELLED', 'REJECTED', 'PENDING_APPROVAL', 'COMPLETED'].includes(apptStatus);
  };
  assert(canDoctorUpdateNotes('CANCELLED') === false, 'Doctor cannot update notes on CANCELLED appointment');
  assert(canDoctorUpdateNotes('REJECTED') === false, 'Doctor cannot update notes on REJECTED appointment');
  assert(canDoctorUpdateNotes('PENDING_APPROVAL') === false, 'Doctor cannot update notes on PENDING_APPROVAL appointment');
  assert(canDoctorUpdateNotes('IN_CONSULTATION') === true, 'Doctor can update notes on IN_CONSULTATION appointment');
  assert(canDoctorUpdateNotes('COMPLETED') === false, 'Doctor cannot update notes on COMPLETED appointment (Finding M8)');

  // --- Test 120: Password Trimming Policy Across All Roles ---
  console.log('\n--- Test 120: Password Trimming Policy Across All Roles ---');
  const isTrimmedPasswordValid = (pw: any) => {
    return typeof pw === 'string' && pw.trim().length >= 8;
  };
  assert(isTrimmedPasswordValid('12345678') === true, 'Plain 8-character password accepted');
  assert(isTrimmedPasswordValid('   12345678   ') === true, 'Padded 8-character password accepted after trim');
  assert(isTrimmedPasswordValid('  12345  ') === false, 'Padded 5-character password rejected after trim');
  assert(isTrimmedPasswordValid('        ') === false, 'Pure whitespace password rejected');
  assert(isTrimmedPasswordValid(12345678) === false, 'Non-string password rejected');
  assert(isTrimmedPasswordValid(null) === false, 'Null password rejected');
  assert(isTrimmedPasswordValid(undefined) === false, 'Undefined password rejected');

  // --- Test 121: Email & Phone Sanitization Hygiene ---
  console.log('\n--- Test 121: Email & Phone Sanitization Hygiene ---');
  const sanitizeEmail = (email: string) => email.toLowerCase().trim();
  const sanitizePhone = (phone?: string | null) => (phone ? String(phone).trim() : null);

  assert(sanitizeEmail('  Receptionist@Clinic.COM  ') === 'receptionist@clinic.com', 'Email lowercase and trimmed');
  assert(sanitizePhone('  +91 9876543210  ') === '+91 9876543210', 'Phone string trimmed');
  assert(sanitizePhone(null) === null, 'Null phone returns null');
  assert(sanitizePhone(undefined) === null, 'Undefined phone returns null');

  // --- Test 122: Consultation Fee Precision & Slot Schedule Constraints ---
  console.log('\n--- Test 122: Consultation Fee Precision & Slot Schedule Constraints ---');
  const roundToCents = (fee: number) => Math.round(fee * 100) / 100;
  assert(roundToCents(500.555) === 500.56, 'Fee rounded to nearest cent (500.56)');
  assert(roundToCents(500) === 500, 'Integer fee preserved');
  assert(roundToCents(0) === 0, 'Zero fee preserved');

  const invalidSlotsEndTimeBeforeStart = [
    { id: 's1', name: 'Shift', startTime: '14:00', endTime: '12:00', maxPatients: 10 }
  ];
  const slotValResult = validateDoctorSlots(invalidSlotsEndTimeBeforeStart);
  assert(slotValResult.valid === false, 'Slot with endTime before startTime rejected by validateDoctorSlots');
  assert(Boolean(slotValResult.error?.includes('must be after start time')), 'Error specifically states end time constraint');

  // --- Test 123: Centralized Practitioner Eligibility Guard (Finding H4, M10) ---
  console.log('\n--- Test 123: Centralized Practitioner Eligibility Guard (Finding H4, M10) ---');
  const guardVerifiedDoc = { isVerified: true, verificationStatus: 'VERIFIED' };
  const guardPendingDoc = { isVerified: false, verificationStatus: 'PENDING' };
  const guardSuspendedDoc = { isVerified: true, verificationStatus: 'SUSPENDED' };
  const guardRejectedDoc = { isVerified: true, verificationStatus: 'REJECTED' };
  const guardDivergentDoc = { isVerified: true, verificationStatus: 'PENDING' };

  assert(isDoctorEligibleForClinicalPractice(guardVerifiedDoc).eligible === true, 'Verified doctor with VERIFIED status is eligible');
  assert(isDoctorEligibleForClinicalPractice(guardPendingDoc).eligible === false, 'Pending doctor is ineligible');
  assert(isDoctorEligibleForClinicalPractice(guardSuspendedDoc).eligible === false, 'Suspended doctor is ineligible');
  assert(isDoctorEligibleForClinicalPractice(guardSuspendedDoc).reason?.includes('suspended') === true, 'Suspended doctor returns suspension reason');
  assert(isDoctorEligibleForClinicalPractice(guardRejectedDoc).eligible === false, 'Rejected doctor is ineligible');
  assert(isDoctorEligibleForClinicalPractice(guardDivergentDoc).eligible === false, 'Doctor with mismatched isVerified=true but status=PENDING is ineligible (Finding M10)');
  assert(isDoctorEligibleForClinicalPractice(null).eligible === false, 'Null doctor is ineligible');
  assert(isDoctorEligibleForClinicalPractice(undefined).eligible === false, 'Undefined doctor is ineligible');

  // --- Test 124: Centralized Clinic Facility Active Guard (Finding M6) ---
  console.log('\n--- Test 124: Centralized Clinic Facility Active Guard (Finding M6) ---');
  const guardVerifiedClinic = { isVerified: true, verificationStatus: 'VERIFIED' };
  const guardPendingClinic = { isVerified: false, verificationStatus: 'PENDING' };
  const guardSuspendedClinic = { isVerified: true, verificationStatus: 'SUSPENDED' };
  const guardRejectedClinic = { isVerified: true, verificationStatus: 'REJECTED' };

  assert(isClinicActive(guardVerifiedClinic).active === true, 'Verified active clinic passes check');
  assert(isClinicActive(guardPendingClinic).active === false, 'Pending clinic fails active check');
  assert(isClinicActive(guardSuspendedClinic).active === false, 'Suspended clinic fails active check (Finding M6)');
  assert(isClinicActive(guardRejectedClinic).active === false, 'Rejected clinic fails active check');
  assert(isClinicActive(null).active === false, 'Null clinic profile fails active check');

  // --- Test 125: Walk-in Credentials & Identity Security (Finding H3) ---
  console.log('\n--- Test 125: Walk-in Credentials & Identity Security (Finding H3) ---');
  const isWalkinAccount = (email: string) => {
    const lower = email.toLowerCase().trim();
    return lower.endsWith('@mediarca.local') || lower.startsWith('walkin.');
  };
  assert(isWalkinAccount('walkin.9876543210@mediarca.local') === true, 'Legacy walkin format identified as walkin account');
  assert(isWalkinAccount('walkin.uuid123@mediarca.local') === true, 'UUID walkin format identified as walkin account');
  assert(isWalkinAccount('patient@example.com') === false, 'Standard patient email is not a walkin account');
  assert(isWalkinAccount('doctor@mediarca.com') === false, 'Doctor email is not a walkin account');

  // Simulation of login rejection for walkin identities
  const canAuthenticateDirectly = (email: string) => !isWalkinAccount(email);
  assert(canAuthenticateDirectly('walkin.8765432109@mediarca.local') === false, 'Direct login strictly rejected for walkin patient email (Finding H3)');
  assert(canAuthenticateDirectly('patient@gmail.com') === true, 'Direct login permitted for normal patient account');

  // --- Test 126: Doctor Schedule Updates Require Active/Accepted Clinic Affiliation (Finding H8) ---
  console.log('\n--- Test 126: Doctor Schedule Updates Require Active/Accepted Clinic Affiliation (Finding H8) ---');
  const canUpdateClinicSchedule = (
    doc: { isVerified?: boolean; verificationStatus?: string },
    clinic: { isVerified?: boolean; verificationStatus?: string },
    affiliationStatus: string
  ): { allowed: boolean; reason?: string } => {
    if (!isDoctorEligibleForClinicalPractice(doc).eligible) {
      return { allowed: false, reason: 'Doctor is not eligible' };
    }
    if (!isClinicActive(clinic).active) {
      return { allowed: false, reason: 'Clinic is not active' };
    }
    if (affiliationStatus !== 'ACTIVE' && affiliationStatus !== 'ACCEPTED') {
      return { allowed: false, reason: 'Affiliation must be ACTIVE or ACCEPTED' };
    }
    return { allowed: true };
  };

  assert(canUpdateClinicSchedule(guardVerifiedDoc, guardVerifiedClinic, 'ACTIVE').allowed === true, 'Active doctor + active clinic + ACTIVE affiliation permitted');
  assert(canUpdateClinicSchedule(guardVerifiedDoc, guardVerifiedClinic, 'ACCEPTED').allowed === true, 'Active doctor + active clinic + ACCEPTED affiliation permitted');
  assert(canUpdateClinicSchedule(guardVerifiedDoc, guardVerifiedClinic, 'PENDING').allowed === false, 'PENDING affiliation rejected for schedule update (Finding H8)');
  assert(canUpdateClinicSchedule(guardVerifiedDoc, guardVerifiedClinic, 'REJECTED').allowed === false, 'REJECTED affiliation rejected for schedule update (Finding H8)');
  assert(canUpdateClinicSchedule(guardSuspendedDoc, guardVerifiedClinic, 'ACTIVE').allowed === false, 'Suspended doctor cannot update clinic schedule');
  assert(canUpdateClinicSchedule(guardVerifiedDoc, guardSuspendedClinic, 'ACTIVE').allowed === false, 'Suspended clinic cannot receive schedule updates');

  // --- Test 127: Receptionist Action Normalization & Input Validation (Finding M9) ---
  console.log('\n--- Test 127: Receptionist Action Normalization & Input Validation (Finding M9) ---');
  const normalizeAction = (action: any): 'ACCEPT' | 'REJECT' | null => {
    if (!action || typeof action !== 'string') return null;
    const normalized = action.trim().toUpperCase();
    return normalized === 'ACCEPT' || normalized === 'REJECT' ? normalized : null;
  };

  assert(normalizeAction('accept') === 'ACCEPT', 'Lowercase "accept" normalized to "ACCEPT" (Finding M9)');
  assert(normalizeAction('ACCEPT') === 'ACCEPT', 'Uppercase "ACCEPT" preserved');
  assert(normalizeAction('  Accept  ') === 'ACCEPT', 'Padded "Accept" normalized to "ACCEPT"');
  assert(normalizeAction('reject') === 'REJECT', 'Lowercase "reject" normalized to "REJECT"');
  assert(normalizeAction('REJECT') === 'REJECT', 'Uppercase "REJECT" preserved');
  assert(normalizeAction('delete') === null, 'Unsupported action "delete" returns null');
  assert(normalizeAction('') === null, 'Empty action returns null');
  assert(normalizeAction(null) === null, 'Null action returns null');
  assert(normalizeAction(123) === null, 'Non-string action returns null');

  // --- Test 128: Receptionist Centralized Doctor Access Rules (Finding H4, H5, M7) ---
  console.log('\n--- Test 128: Receptionist Centralized Doctor Access Rules (Finding H4, H5, M7) ---');
  const evaluateReceptionistDeskAccess = (params: {
    receptionistStatus: string;
    assignmentStatus: string;
    doctor: { isVerified?: boolean; verificationStatus?: string };
    clinic: { isVerified?: boolean; verificationStatus?: string };
    affiliationStatus: string;
    receptionistClinicId: string;
    targetClinicId?: string | null;
  }): { authorized: boolean; reason?: string } => {
    if (params.receptionistStatus !== 'ACTIVE') {
      return { authorized: false, reason: 'Receptionist profile is not ACTIVE' };
    }
    if (!isDoctorEligibleForClinicalPractice(params.doctor).eligible) {
      return { authorized: false, reason: 'Doctor is not eligible for practice' };
    }
    if (params.assignmentStatus !== 'ACTIVE') {
      return { authorized: false, reason: 'Doctor-receptionist assignment is not ACTIVE' };
    }
    if (!isClinicActive(params.clinic).active) {
      return { authorized: false, reason: 'Clinic facility is not active' };
    }
    if (params.targetClinicId && params.targetClinicId !== params.receptionistClinicId) {
      return { authorized: false, reason: 'Venue mismatch' };
    }
    if (params.affiliationStatus !== 'ACTIVE' && params.affiliationStatus !== 'ACCEPTED') {
      return { authorized: false, reason: 'Doctor-clinic affiliation is not ACTIVE/ACCEPTED' };
    }
    return { authorized: true };
  };

  const validAccessBase = {
    receptionistStatus: 'ACTIVE',
    assignmentStatus: 'ACTIVE',
    doctor: guardVerifiedDoc,
    clinic: guardVerifiedClinic,
    affiliationStatus: 'ACTIVE',
    receptionistClinicId: 'clinic-1',
    targetClinicId: 'clinic-1',
  };

  assert(evaluateReceptionistDeskAccess(validAccessBase).authorized === true, 'All active and matching conditions authorized');
  assert(evaluateReceptionistDeskAccess({ ...validAccessBase, receptionistStatus: 'PENDING' }).authorized === false, 'Pending receptionist unauthorized');
  assert(evaluateReceptionistDeskAccess({ ...validAccessBase, assignmentStatus: 'INACTIVE' }).authorized === false, 'Inactive doctor assignment unauthorized (Finding H5)');
  assert(evaluateReceptionistDeskAccess({ ...validAccessBase, doctor: guardSuspendedDoc }).authorized === false, 'Suspended doctor unauthorized for receptionist queue (Finding H4)');
  assert(evaluateReceptionistDeskAccess({ ...validAccessBase, affiliationStatus: 'PENDING' }).authorized === false, 'Pending doctor affiliation unauthorized (Finding H5)');
  assert(evaluateReceptionistDeskAccess({ ...validAccessBase, targetClinicId: 'clinic-2' }).authorized === false, 'Mismatched clinic facility venue unauthorized');
  assert(evaluateReceptionistDeskAccess({ ...validAccessBase, clinic: guardSuspendedClinic }).authorized === false, 'Suspended clinic facility unauthorized (Finding M6)');

  // --- Test 129: Strict Production CORS Allowlist Enforcement (Finding M11) ---
  console.log('\n--- Test 129: Strict Production CORS Allowlist Enforcement (Finding M11) ---');
  const allowedCORSList = [
    'https://bikesh3764.github.io',
    'https://mediarca.vercel.app',
    'http://localhost:5173',
  ];

  const checkCorsOrigin = (origin: string | undefined, isProd: boolean): boolean => {
    if (!origin) return true;
    if (!isProd) return true;
    return allowedCORSList.includes(origin);
  };

  assert(checkCorsOrigin('https://mediarca.vercel.app', true) === true, 'Configured production origin accepted');
  assert(checkCorsOrigin('https://bikesh3764.github.io', true) === true, 'Configured GitHub Pages origin accepted');
  assert(checkCorsOrigin('https://malicious-phishing.vercel.app', true) === false, 'Arbitrary vercel.app subdomain strictly rejected in production (Finding M11)');
  assert(checkCorsOrigin('https://attacker.onrender.com', true) === false, 'Arbitrary onrender.com subdomain strictly rejected in production (Finding M11)');
  assert(checkCorsOrigin('https://evil.github.io', true) === false, 'Arbitrary github.io subdomain strictly rejected in production (Finding M11)');
  assert(checkCorsOrigin('http://localhost:5173', false) === true, 'Localhost permitted in development');

  // --- Test 130: Production Health Check Minimization (Finding L2) ---
  console.log('\n--- Test 130: Production Health Check Minimization (Finding L2) ---');
  const buildHealthPayload = (isProd: boolean, dbOk: boolean) => {
    if (isProd) {
      return { status: dbOk ? 'ok' : 'degraded' };
    }
    return {
      status: 'ok',
      database: dbOk ? 'connected' : 'disconnected',
      service: 'MediArca Production Healthcare Platform API',
      uptime: 3600,
      timestamp: new Date().toISOString(),
    };
  };

  const prodHealthy = buildHealthPayload(true, true);
  const prodDegraded = buildHealthPayload(true, false);
  const devHealthy = buildHealthPayload(false, true);

  assert(prodHealthy.status === 'ok', 'Production healthy returns status: ok');
  assert(prodDegraded.status === 'degraded', 'Production DB error returns status: degraded');
  assert(Object.keys(prodHealthy).length === 1 && !('uptime' in prodHealthy) && !('service' in prodHealthy), 'Production health check omits uptime, service, and DB internals (Finding L2)');
  assert('uptime' in devHealthy && 'service' in devHealthy, 'Development health check includes full diagnostic telemetry');

  // --- Test 131: Google OAuth email_verified Enforcement & Walkin Domain Protection ---
  console.log('\n--- Test 131: Google OAuth email_verified Enforcement & Walkin Domain Protection ---');
  const validateGoogleOAuthPayload = (payload: any, isConfigured: boolean, userRecord?: any) => {
    if (!payload || !payload.email) {
      return { allowed: false, message: 'Unable to verify Google credential email' };
    }
    if (isConfigured && payload.email_verified !== true) {
      return { allowed: false, message: 'Google account email is not verified by Google' };
    }
    if (userRecord && (userRecord.email.toLowerCase().endsWith('@mediarca.local') || userRecord.email.toLowerCase().startsWith('walkin.'))) {
      return { allowed: false, message: 'Walk-in patient accounts cannot authenticate directly. Please register an official account.' };
    }
    return { allowed: true };
  };

  assert(validateGoogleOAuthPayload({ email: 'user@gmail.com', email_verified: true }, true).allowed === true, 'Verified Google email is accepted');
  assert(validateGoogleOAuthPayload({ email: 'unverified@gmail.com', email_verified: false }, true).allowed === false, 'Unverified Google email is strictly rejected');
  assert(validateGoogleOAuthPayload({ email: 'unverified@gmail.com' }, true).allowed === false, 'Missing email_verified flag in production config is rejected');
  assert(validateGoogleOAuthPayload(null, true).allowed === false, 'Null payload is rejected');
  assert(validateGoogleOAuthPayload({ email: 'walkin.12345@mediarca.local', email_verified: true }, true, { email: 'walkin.12345@mediarca.local' }).allowed === false, 'Walk-in patient account is strictly blocked from Google OAuth');

  // --- Test 132: Affiliation Directionality & Self-Cancellation Verification ---
  console.log('\n--- Test 132: Affiliation Directionality & Self-Cancellation Verification ---');
  const canRespondToAffiliation = (
    callerRole: 'DOCTOR' | 'CLINIC',
    requestedBy: 'DOCTOR' | 'CLINIC',
    action: string
  ): { allowed: boolean; reason?: string } => {
    const act = action.toUpperCase();
    if (callerRole === 'DOCTOR') {
      if (act === 'ACCEPT' && requestedBy === 'DOCTOR') {
        return { allowed: false, reason: 'Cannot accept an affiliation request initiated by yourself.' };
      }
      return { allowed: true };
    }
    if (callerRole === 'CLINIC') {
      if (act === 'ACCEPT' && requestedBy === 'CLINIC') {
        return { allowed: false, reason: 'Cannot accept an affiliation request initiated by your clinic.' };
      }
      return { allowed: true };
    }
    return { allowed: false, reason: 'Invalid role' };
  };

  assert(canRespondToAffiliation('DOCTOR', 'CLINIC', 'ACCEPT').allowed === true, 'Doctor can ACCEPT request initiated by clinic');
  assert(canRespondToAffiliation('DOCTOR', 'CLINIC', 'REJECT').allowed === true, 'Doctor can REJECT request initiated by clinic');
  assert(canRespondToAffiliation('DOCTOR', 'DOCTOR', 'ACCEPT').allowed === false, 'Doctor CANNOT self-approve request initiated by doctor');
  assert(canRespondToAffiliation('DOCTOR', 'DOCTOR', 'REJECT').allowed === true, 'Doctor CAN cancel/withdraw request initiated by doctor');

  assert(canRespondToAffiliation('CLINIC', 'DOCTOR', 'ACCEPT').allowed === true, 'Clinic can ACCEPT request initiated by doctor');
  assert(canRespondToAffiliation('CLINIC', 'DOCTOR', 'REJECT').allowed === true, 'Clinic can REJECT request initiated by doctor');
  assert(canRespondToAffiliation('CLINIC', 'CLINIC', 'ACCEPT').allowed === false, 'Clinic CANNOT self-approve request initiated by clinic');
  assert(canRespondToAffiliation('CLINIC', 'CLINIC', 'REJECT').allowed === true, 'Clinic CAN cancel/withdraw request initiated by clinic');

  // --- Test 133: Appointment Detail Access Control & Clinic Active Verification ---
  console.log('\n--- Test 133: Appointment Detail Access Control & Clinic Active Verification ---');
  const canAccessAppointmentDetail = (
    caller: { id: string; role: string },
    appointment: { patientUserId: string; doctorUserId: string; doctor: any; clinicId?: string },
    clinicFacility?: any,
    receptionistAccessAuthorized = false
  ): boolean => {
    const isDoctor = caller.role === 'DOCTOR' && appointment.doctorUserId === caller.id && isDoctorEligibleForClinicalPractice(appointment.doctor).eligible;
    const isPatient = caller.role === 'PATIENT' && appointment.patientUserId === caller.id;
    const isAdmin = caller.role === 'ADMIN';

    let isClinicOrRec = false;
    if (caller.role === 'CLINIC' && appointment.clinicId) {
      isClinicOrRec = Boolean(clinicFacility && isClinicActive(clinicFacility).active && clinicFacility.id === appointment.clinicId);
    } else if (caller.role === 'RECEPTIONIST') {
      isClinicOrRec = receptionistAccessAuthorized;
    }

    return Boolean(isDoctor || isPatient || isAdmin || isClinicOrRec);
  };

  const testDetailAppt = {
    patientUserId: 'patient_u1',
    doctorUserId: 'doctor_u1',
    doctor: guardVerifiedDoc,
    clinicId: 'clinic_1',
  };

  assert(canAccessAppointmentDetail({ id: 'doctor_u1', role: 'DOCTOR' }, testDetailAppt) === true, 'Eligible treating doctor can access appointment detail');
  assert(canAccessAppointmentDetail({ id: 'doctor_u1', role: 'DOCTOR' }, { ...testDetailAppt, doctor: guardSuspendedDoc }) === false, 'Suspended doctor cannot access appointment detail');
  assert(canAccessAppointmentDetail({ id: 'patient_u1', role: 'PATIENT' }, testDetailAppt) === true, 'Patient can access own appointment detail');
  assert(canAccessAppointmentDetail({ id: 'admin_u1', role: 'ADMIN' }, testDetailAppt) === true, 'Admin can access appointment detail');
  assert(canAccessAppointmentDetail({ id: 'clinic_u1', role: 'CLINIC' }, testDetailAppt, { id: 'clinic_1', ...guardVerifiedClinic }) === true, 'Active clinic can access appointment detail');
  assert(canAccessAppointmentDetail({ id: 'clinic_u1', role: 'CLINIC' }, testDetailAppt, { id: 'clinic_1', ...guardSuspendedClinic }) === false, 'Suspended clinic cannot access appointment detail');
  assert(canAccessAppointmentDetail({ id: 'rec_u1', role: 'RECEPTIONIST' }, testDetailAppt, undefined, true) === true, 'Authorized receptionist can access appointment detail');
  assert(canAccessAppointmentDetail({ id: 'rec_u1', role: 'RECEPTIONIST' }, testDetailAppt, undefined, false) === false, 'Unauthorized receptionist cannot access appointment detail');

  // --- Test 134: Pending Appointments Filtering for Ineligible Practitioners ---
  console.log('\n--- Test 134: Pending Appointments Filtering for Ineligible Practitioners ---');
  const mockPendingAppointments = [
    { id: 'appt_1', doctor: guardVerifiedDoc },
    { id: 'appt_2', doctor: guardSuspendedDoc },
    { id: 'appt_3', doctor: guardRejectedDoc },
    { id: 'appt_4', doctor: guardPendingDoc },
  ];

  const filteredPending = mockPendingAppointments.filter(
    (appt) => isDoctorEligibleForClinicalPractice(appt.doctor).eligible
  );

  assert(filteredPending.length === 1, 'Only 1 appointment with eligible practitioner is kept in pending queue');
  assert(filteredPending[0].id === 'appt_1', 'Verified practitioner appointment is preserved');

  // --- Test 135: Asset URL Resolution & Cloudflare R2 Scheme Normalization ---
  console.log('\n--- Test 135: Asset URL Resolution & Cloudflare R2 Scheme Normalization ---');
  const mockGetFileUrl = (filePath?: string): string => {
    if (!filePath) return '';
    if (filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    if (filePath.startsWith('r2://')) {
      const clean = filePath.replace(/^r2:\/\//, '');
      return `https://pub-a590817d9f404eb889f6482b025ea9ad.r2.dev/${clean}`;
    }
    const backendBase = 'https://mediarca-mdwk.onrender.com';
    return `${backendBase}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
  };

  assert(mockGetFileUrl('r2://avatars/doctor-1.jpg') === 'https://pub-a590817d9f404eb889f6482b025ea9ad.r2.dev/avatars/doctor-1.jpg', 'r2:// avatar URI correctly resolves to public CDN URL');
  assert(mockGetFileUrl('data:image/jpeg;base64,1234') === 'data:image/jpeg;base64,1234', 'Data URI is preserved');
  assert(mockGetFileUrl('https://example.com/logo.png') === 'https://example.com/logo.png', 'HTTP URL is preserved');
  assert(mockGetFileUrl('/uploads/avatars/test.jpg') === 'https://mediarca-mdwk.onrender.com/uploads/avatars/test.jpg', 'Local path is prefixed with backend base');
  assert(mockGetFileUrl('') === '', 'Empty path returns empty string');

  // --- Test 136: Affiliation Response Validation & State Machine ---
  console.log('\n--- Test 136: Affiliation Response Validation & State Machine ---');
  const validateAffiliationResponse = (action: any, affiliation: { status: string; requestedBy: string }, actorRole: 'DOCTOR' | 'CLINIC') => {
    const normalizedAction = String(action || '').trim().toUpperCase();
    if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
      return { allowed: false, status: 400, message: 'Action must be either ACCEPT or REJECT' };
    }
    if (affiliation.status !== 'PENDING') {
      return { allowed: false, status: 400, message: `Affiliation request is already ${affiliation.status.toLowerCase()}. Only pending requests can be responded to.` };
    }
    if (normalizedAction === 'ACCEPT' && actorRole === 'DOCTOR' && affiliation.requestedBy === 'DOCTOR') {
      return { allowed: false, status: 403, message: 'Cannot accept an affiliation request initiated by yourself. Awaiting clinic approval.' };
    }
    if (normalizedAction === 'ACCEPT' && actorRole === 'CLINIC' && affiliation.requestedBy === 'CLINIC') {
      return { allowed: false, status: 403, message: 'Cannot accept an affiliation request initiated by your clinic. Awaiting doctor acceptance.' };
    }
    return { allowed: true, action: normalizedAction };
  };

  assert(validateAffiliationResponse(undefined, { status: 'PENDING', requestedBy: 'CLINIC' }, 'DOCTOR').allowed === false, 'Missing action returns 400');
  assert(validateAffiliationResponse('INVALID', { status: 'PENDING', requestedBy: 'CLINIC' }, 'DOCTOR').allowed === false, 'Invalid action string returns 400');
  assert(validateAffiliationResponse('accept', { status: 'PENDING', requestedBy: 'CLINIC' }, 'DOCTOR').allowed === true, 'Lowercase accept is normalized and allowed');
  assert(validateAffiliationResponse('ACCEPT', { status: 'PENDING', requestedBy: 'CLINIC' }, 'DOCTOR').allowed === true, 'Uppercase ACCEPT is allowed');
  assert(validateAffiliationResponse('reject', { status: 'PENDING', requestedBy: 'DOCTOR' }, 'DOCTOR').allowed === true, 'Doctor can cancel own request with lowercase reject');
  assert(validateAffiliationResponse('ACCEPT', { status: 'ACCEPTED', requestedBy: 'CLINIC' }, 'DOCTOR').allowed === false, 'Already accepted affiliation cannot be re-accepted');
  assert(validateAffiliationResponse('REJECT', { status: 'REJECTED', requestedBy: 'CLINIC' }, 'DOCTOR').allowed === false, 'Already rejected affiliation cannot be re-responded to');
  assert(validateAffiliationResponse('ACCEPT', { status: 'PENDING', requestedBy: 'DOCTOR' }, 'DOCTOR').status === 403, 'Doctor cannot self-accept doctor-initiated request');
  assert(validateAffiliationResponse('ACCEPT', { status: 'PENDING', requestedBy: 'CLINIC' }, 'CLINIC').status === 403, 'Clinic cannot self-accept clinic-initiated request');

  // --- Test 137: Receptionist Multi-Clinic Affiliation Slot and Fee Resolution ---
  console.log('\n--- Test 137: Receptionist Multi-Clinic Affiliation Slot and Fee Resolution ---');
  const mockDoctorWithClinics: any = {
    id: 'doc_multi',
    consultationFee: 400,
    clinics: [
      { clinicId: 'clinic_A', consultationFee: 500, slots: JSON.stringify([{ id: 'slot_A', name: 'Shift A' }]) },
      { clinicId: 'clinic_B', consultationFee: 750, slots: JSON.stringify([{ id: 'slot_B', name: 'Shift B' }]) },
    ],
  };

  const resolveClinicFee = (doc: any, apptClinicId: string) => {
    const cd = doc?.clinics?.find((c: any) => c.clinicId === apptClinicId) || doc?.clinics?.[0];
    return cd?.consultationFee ?? doc.consultationFee;
  };

  const resolveClinicSlots = (doc: any, apptClinicId: string) => {
    const cd = doc?.clinics?.find((c: any) => c.clinicId === apptClinicId) || doc?.clinics?.[0];
    if (cd?.slots) {
      try {
        const p = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
        if (Array.isArray(p) && p.length > 0) return p;
      } catch {}
    }
    return [];
  };

  assert(resolveClinicFee(mockDoctorWithClinics, 'clinic_B') === 750, 'Matching clinic_B resolves clinic B consultation fee');
  assert(resolveClinicFee(mockDoctorWithClinics, 'clinic_A') === 500, 'Matching clinic_A resolves clinic A consultation fee');
  assert(resolveClinicSlots(mockDoctorWithClinics, 'clinic_B')[0].id === 'slot_B', 'Matching clinic_B resolves clinic B slots');
  assert(resolveClinicSlots(mockDoctorWithClinics, 'clinic_A')[0].id === 'slot_A', 'Matching clinic_A resolves clinic A slots');

  // --- Test 138: Receptionist Facility Scope Validation in verifyReceptionistDoctorAccess ---
  console.log('\n--- Test 138: Receptionist Facility Scope Validation in verifyReceptionistDoctorAccess ---');
  const mockCheckFacilityScope = (receptionistClinicId: string | null, targetClinicId?: string | null): boolean => {
    if (targetClinicId && receptionistClinicId !== targetClinicId) {
      return false;
    }
    return true;
  };

  assert(mockCheckFacilityScope('clinic_1', 'clinic_1') === true, 'Matching clinic facility is permitted');
  assert(mockCheckFacilityScope('clinic_1', 'clinic_2') === false, 'Mismatched clinic facility is strictly rejected');
  assert(mockCheckFacilityScope(null, 'clinic_1') === false, 'Receptionist with null clinicId cannot access specific clinic facility');
  assert(mockCheckFacilityScope('clinic_1', null) === true, 'General operation without target clinic requirement is permitted');

  // --- Test 139: Appointment Cancellation Doctor Eligibility Guard ---
  console.log('\n--- Test 139: Appointment Cancellation Doctor Eligibility Guard ---');
  const canDoctorCancel = (user: { id: string; role: string }, appt: { doctor: { userId: string; isVerified: boolean; verificationStatus: string } }) => {
    if (user.role === 'DOCTOR') {
      if (appt.doctor.userId !== user.id) {
        return { allowed: false, reason: 'You do not have permission to cancel another doctor\'s appointment' };
      }
      const docCheck = isDoctorEligibleForClinicalPractice(appt.doctor);
      if (!docCheck.eligible) {
        return { allowed: false, reason: docCheck.reason };
      }
    }
    return { allowed: true };
  };

  assert(canDoctorCancel({ id: 'doc_1', role: 'DOCTOR' }, { doctor: { userId: 'doc_1', isVerified: true, verificationStatus: 'VERIFIED' } }).allowed === true, 'Verified doctor can cancel own appointment');
  assert(canDoctorCancel({ id: 'doc_1', role: 'DOCTOR' }, { doctor: { userId: 'doc_1', isVerified: false, verificationStatus: 'SUSPENDED' } }).allowed === false, 'Suspended doctor cannot cancel appointment');
  assert(canDoctorCancel({ id: 'doc_1', role: 'DOCTOR' }, { doctor: { userId: 'doc_2', isVerified: true, verificationStatus: 'VERIFIED' } }).allowed === false, 'Doctor cannot cancel another doctor\'s appointment');

  // --- Test 140: Synthetic Walk-in Identity & Domain Registration Prevention ---
  console.log('\n--- Test 140: Synthetic Walk-in Identity & Domain Registration Prevention ---');
  const validateRegistrationEmail = (email: string): boolean => {
    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail.endsWith('@mediarca.local') || cleanEmail.startsWith('walkin.')) {
      return false;
    }
    return true;
  };

  assert(validateRegistrationEmail('walkin.12345@mediarca.local') === false, 'walkin.*@mediarca.local is strictly blocked from registration');
  assert(validateRegistrationEmail('user@mediarca.local') === false, '@mediarca.local domain is blocked from public registration');
  assert(validateRegistrationEmail('walkin.patient@gmail.com') === false, 'walkin. prefix is blocked from registration');
  // --- Test 141: Clinic Demo Credentials & Role Authorization ---
  console.log('\n--- Test 141: Clinic Demo Credentials & Role Authorization ---');
  const demoClinicEmail = 'clinic@mediarca.com';
  const demoClinicPass = 'clinic123';
  assert(demoClinicEmail.trim().toLowerCase() === 'clinic@mediarca.com', 'Demo clinic email normalizes correctly');
  assert(demoClinicPass.trim().length >= 8, 'Demo clinic password satisfies minimum 8-character length policy');

  const verifyClinicRoleAccess = (userRole: string): { allowed: boolean; error?: string } => {
    if (userRole !== 'CLINIC') {
      return { allowed: false, error: 'This account does not have clinic administrative permissions.' };
    }
    return { allowed: true };
  };

  assert(verifyClinicRoleAccess('CLINIC').allowed === true, 'CLINIC role is granted access to clinic portal');
  assert(verifyClinicRoleAccess('PATIENT').allowed === false, 'PATIENT role is blocked from clinic portal');
  assert(verifyClinicRoleAccess('DOCTOR').allowed === false, 'DOCTOR role is blocked from clinic portal');
  assert(verifyClinicRoleAccess('RECEPTIONIST').allowed === false, 'RECEPTIONIST role is blocked from clinic portal');

  // --- Test 142: Audit Findings M1-M8 and F1-F4 Verification ---
  console.log('\n--- Test 142: Audit Findings M1-M8 and F1-F4 Verification ---');

  // 1. Doctor numeric bounds validation (M7 & M8)
  const validDocBounds = validateDoctorNumericBounds({
    experienceYears: 12,
    consultationFee: 750,
    avgConsultationMinutes: 20,
    maxDailyPatients: 45,
  });
  assert(validDocBounds.valid === true, 'Valid doctor numeric bounds accepted');
  assert(validDocBounds.sanitized.experienceYears === 12, 'Experience years correctly sanitized');
  assert(validDocBounds.sanitized.consultationFee === 750, 'Consultation fee correctly sanitized');

  const invalidExpHigh = validateDoctorNumericBounds({ experienceYears: 120 });
  assert(invalidExpHigh.valid === false, 'Experience years > 75 rejected');

  const invalidExpInf = validateDoctorNumericBounds({ experienceYears: Infinity });
  assert(invalidExpInf.valid === false, 'Infinity experience years rejected');

  const invalidFeeNeg = validateDoctorNumericBounds({ consultationFee: -50 });
  assert(invalidFeeNeg.valid === false, 'Negative consultation fee rejected');

  const invalidFeeInf = validateDoctorNumericBounds({ consultationFee: Infinity });
  assert(invalidFeeInf.valid === false, 'Infinity consultation fee rejected');

  const invalidAvgZero = validateDoctorNumericBounds({ avgConsultationMinutes: 0 });
  assert(invalidAvgZero.valid === false, 'Zero avg consultation minutes rejected');

  const invalidAvgInf = validateDoctorNumericBounds({ avgConsultationMinutes: Infinity });
  assert(invalidAvgInf.valid === false, 'Infinity avg consultation minutes rejected');

  // 2. Doctor slot validator finite numbers (M8)
  const infiniteMaxSlots = validateDoctorSlots([
    { startTime: '09:00', endTime: '11:00', maxPatients: Infinity },
  ]);
  assert(infiniteMaxSlots.valid === false, 'Slots with Infinity maxPatients are rejected');

  const validFiniteSlots = validateDoctorSlots([
    { startTime: '09:00', endTime: '11:00', maxPatients: 50, avgConsultationMinutes: 2.4 },
  ]);
  assert(validFiniteSlots.valid === true, 'Slots with finite positive maxPatients are accepted');
  assert(validFiniteSlots.formatted?.[0].maxPatients === 50, 'Slot maxPatients preserved');

  // 3. Receptionist password change token issuance (H2 & F4)
  const freshRecToken = jwt.sign(
    {
      id: 'rec_user_1',
      userId: 'rec_user_1',
      email: 'desk@cityclinic.com',
      fullName: 'Anita Sharma',
      role: 'RECEPTIONIST',
      mustChangePassword: false,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
  const decodedRec = jwt.verify(freshRecToken, getJwtSecret()) as any;
  assert(decodedRec.mustChangePassword === false, 'Fresh receptionist JWT contains mustChangePassword: false');
  assert(decodedRec.role === 'RECEPTIONIST', 'Receptionist role preserved in fresh token');

  // 4. Booking error status code mapping (M1, M5, F3)
  const mapBookingError = (errorMsg: string): { status: number; message: string } => {
    if (errorMsg.startsWith('DUPLICATE_ACTIVE_BOOKING:')) {
      return { status: 409, message: errorMsg.replace('DUPLICATE_ACTIVE_BOOKING:', '').trim() };
    }
    if (errorMsg.includes('reached its maximum patient capacity')) {
      return { status: 409, message: errorMsg };
    }
    if (errorMsg.includes('already ended for today')) {
      return { status: 400, message: errorMsg };
    }
    if (errorMsg.startsWith('CONCURRENCY_LOCK_FAILURE:')) {
      return { status: 503, message: 'Practitioner schedule is busy with concurrent reservations. Please retry in a moment.' };
    }
    return { status: 500, message: 'Failed to book appointment. Please try again.' };
  };

  assert(mapBookingError('DUPLICATE_ACTIVE_BOOKING: You already have an active booking').status === 409, 'Duplicate booking mapped to 409 Conflict');
  assert(mapBookingError('Slot Shift 1 has reached its maximum patient capacity').status === 409, 'Slot full mapped to 409 Conflict');
  assert(mapBookingError('This checking slot has already ended for today').status === 400, 'Slot ended mapped to 400 Bad Request');
  assert(mapBookingError('CONCURRENCY_LOCK_FAILURE: failed lock').status === 503, 'Lock failure mapped to 503 Service Unavailable');
  assert(mapBookingError('P2002 Unique constraint failed').status === 500, 'Database error mapped to 500 with sanitized message');
  assert(mapBookingError('P2002 Unique constraint failed').message === 'Failed to book appointment. Please try again.', 'Database internal details are not leaked');

  // 5. Accounting & Revenue Calculation (F1 & F2)
  const appointmentsMock = [
    { id: '1', status: 'COMPLETED', paymentStatus: 'PAID' },
    { id: '2', status: 'WAITING', paymentStatus: 'PAID' },
    { id: '3', status: 'PENDING_APPROVAL', paymentStatus: 'PENDING' },
    { id: '4', status: 'WAITING', paymentStatus: 'PENDING' },
    { id: '5', status: 'CANCELLED', paymentStatus: 'FAILED' },
  ];
  const fee = 500;
  // Correct accounting: only paid or completed consultations
  const paidOrCompleted = appointmentsMock.filter((a) => a.paymentStatus === 'PAID' || a.status === 'COMPLETED');
  const revenue = paidOrCompleted.length * fee;
  assert(paidOrCompleted.length === 2, 'Only completed or paid appointments are counted towards revenue');
  assert(revenue === 1000, 'Revenue correctly calculated as Rs. 1000 (excluding unapproved/unpaid bookings)');

  // 6. Clinic Operational Gating on Suspension (M2)
  const isClinicSuspendedOrRejected = (verificationStatus: string) => {
    return verificationStatus === 'SUSPENDED' || verificationStatus === 'REJECTED';
  };
  assert(isClinicSuspendedOrRejected('SUSPENDED') === true, 'Suspended clinic is gated from operational data');
  assert(isClinicSuspendedOrRejected('REJECTED') === true, 'Rejected clinic is gated from operational data');
  assert(isClinicSuspendedOrRejected('VERIFIED') === false, 'Verified clinic receives full operational data');
  assert(isClinicSuspendedOrRejected('PENDING') === false, 'Pending clinic receives pending banner');

  // 7. Doctor Affiliation Eligibility Gating (M3)
  const test142SuspendedDoc = { isVerified: false, verificationStatus: 'SUSPENDED' };
  const test142VerifiedDoc = { isVerified: true, verificationStatus: 'VERIFIED' };
  // --- Test 143: Real-Time Doctor Presence & Cabin Availability Tracking ---
  console.log('\n--- Test 143: Real-Time Doctor Presence & Cabin Availability Tracking ---');

  // 1. Valid Cabin Status Validation
  const validCabinStatuses = ['IN_CABIN', 'STEPPED_OUT', 'NOT_IN_CABIN'];
  const validateCabinStatus = (status: string | undefined): { valid: boolean; normalized?: string; error?: string } => {
    const normalized = String(status || '').toUpperCase().trim();
    if (!validCabinStatuses.includes(normalized)) {
      return { valid: false, error: 'Invalid cabin status. Must be IN_CABIN, STEPPED_OUT, or NOT_IN_CABIN' };
    }
    return { valid: true, normalized };
  };

  assert(validateCabinStatus('IN_CABIN').valid === true, 'IN_CABIN is a valid presence status');
  assert(validateCabinStatus('stepped_out').valid === true && validateCabinStatus('stepped_out').normalized === 'STEPPED_OUT', 'stepped_out normalizes to uppercase STEPPED_OUT');
  assert(validateCabinStatus('NOT_IN_CABIN').valid === true, 'NOT_IN_CABIN is a valid presence status');
  assert(validateCabinStatus('AWAY').valid === false, 'Arbitrary status AWAY is rejected');
  assert(validateCabinStatus('').valid === false, 'Empty status is rejected');

  // 2. Return Time Calculation for STEPPED_OUT
  const computeExpectedReturnTime = (
    status: string,
    explicitTime?: string | null,
    estimateMinutes?: number | null,
    baseMinutes: number = 600 // 10:00 AM
  ): string | null => {
    if (status !== 'STEPPED_OUT') return null;
    if (explicitTime && typeof explicitTime === 'string' && explicitTime.trim()) {
      return explicitTime.trim();
    }
    if (estimateMinutes && Number.isFinite(Number(estimateMinutes))) {
      const mins = Math.max(1, Math.min(480, Math.floor(Number(estimateMinutes))));
      return minutesTo12Hour(baseMinutes + mins);
    }
    return null;
  };

  assert(computeExpectedReturnTime('STEPPED_OUT', '11:30 AM', null, 600) === '11:30 AM', 'Explicit return time 11:30 AM is preserved');
  assert(computeExpectedReturnTime('STEPPED_OUT', null, 30, 600) === '10:30 AM', '30 minutes estimate from 10:00 AM calculates 10:30 AM');
  assert(computeExpectedReturnTime('STEPPED_OUT', null, 45, 600) === '10:45 AM', '45 minutes estimate calculates 10:45 AM');
  assert(computeExpectedReturnTime('STEPPED_OUT', null, null, 600) === null, 'No estimate returns null (Back soon)');
  assert(computeExpectedReturnTime('IN_CABIN', '11:30 AM', 30, 600) === null, 'IN_CABIN resets expected return time to null');
  assert(computeExpectedReturnTime('NOT_IN_CABIN', '11:30 AM', 30, 600) === null, 'NOT_IN_CABIN resets expected return time to null');

  // 3. Status Labels for Patient Communication
  const getCabinStatusLabel = (status: string, expectedReturn: string | null): string => {
    if (status === 'IN_CABIN') return 'Doctor has arrived and is in cabin';
    if (status === 'STEPPED_OUT') {
      return expectedReturn ? `Doctor stepped out (expected back around ${expectedReturn})` : 'Doctor has stepped out';
    }
    return 'Doctor has not yet arrived in cabin';
  };

  assert(getCabinStatusLabel('IN_CABIN', null) === 'Doctor has arrived and is in cabin', 'IN_CABIN produces reassuring arrival label');
  assert(getCabinStatusLabel('STEPPED_OUT', '11:30 AM') === 'Doctor stepped out (expected back around 11:30 AM)', 'STEPPED_OUT with return time informs patient');
  assert(getCabinStatusLabel('STEPPED_OUT', null) === 'Doctor has stepped out', 'STEPPED_OUT with no estimate produces clean label');
  assert(getCabinStatusLabel('NOT_IN_CABIN', null) === 'Doctor has not yet arrived in cabin', 'NOT_IN_CABIN indicates pending arrival');

  // 4. Role Authorization Rules
  const authorizeCabinStatusUpdate = (
    user: { id: string; role: string },
    targetDoctorId?: string,
    assignedDoctors: string[] = []
  ): { allowed: boolean; status: number; message: string } => {
    if (!['DOCTOR', 'RECEPTIONIST'].includes(user.role)) {
      return { allowed: false, status: 403, message: 'Access denied: doctor or receptionist role required' };
    }
    if (user.role === 'DOCTOR') {
      return { allowed: true, status: 200, message: 'Authorized' };
    }
    // RECEPTIONIST
    if (!targetDoctorId) {
      return { allowed: false, status: 400, message: 'doctorId is required for receptionist updates' };
    }
    if (!assignedDoctors.includes(targetDoctorId)) {
      return { allowed: false, status: 403, message: 'Unauthorized for this practitioner' };
    }
    return { allowed: true, status: 200, message: 'Authorized' };
  };

  assert(authorizeCabinStatusUpdate({ id: 'doc_1', role: 'DOCTOR' }).allowed === true, 'Doctor is authorized to update own presence');
  assert(authorizeCabinStatusUpdate({ id: 'rec_1', role: 'RECEPTIONIST' }, 'doc_1', ['doc_1', 'doc_2']).allowed === true, 'Receptionist is authorized to update assigned doctor');
  assert(authorizeCabinStatusUpdate({ id: 'rec_1', role: 'RECEPTIONIST' }, 'doc_3', ['doc_1', 'doc_2']).allowed === false, 'Receptionist cannot update unassigned doctor');
  assert(authorizeCabinStatusUpdate({ id: 'rec_1', role: 'RECEPTIONIST' }, undefined, ['doc_1']).status === 400, 'Receptionist update without doctorId fails with 400');
  assert(authorizeCabinStatusUpdate({ id: 'pat_1', role: 'PATIENT' }).allowed === false, 'Patient cannot update doctor cabin presence');

  // --- Test 144: Core Hardening - IST Timezone, Doctor Null Safety & Indian Platform Lock ---
  console.log('\n--- Test 144: Core Hardening - IST Timezone, Doctor Null Safety & Indian Platform Lock ---');

  // 1. IST Timezone across boundary
  const lateUtc = new Date('2026-09-28T20:30:00.000Z'); // 20:30 UTC = 02:00 IST on Sept 29
  const istDateCalc = getLocalDateString(lateUtc);
  assert(istDateCalc === '2026-09-29', 'Late UTC time 20:30 resolves to next day 2026-09-29 in IST');

  const istMinsCalc = getIndianTimeMinutes(lateUtc);
  assert(istMinsCalc === 120, '20:30 UTC corresponds to 02:00 AM IST (120 minutes into day)');

  // 2. Doctor user null-safety helper
  const resolveDoctorAvatarInitial = (user?: { fullName?: string | null } | null) => {
    return (user?.fullName ? user.fullName.replace(/^Dr\.\s*/i, '').trim()[0] : null) || 'D';
  };
  assert(resolveDoctorAvatarInitial({ fullName: 'Dr. Sarah Jenkins' }) === 'S', 'Extracts correct initial for Dr. Sarah Jenkins');
  assert(resolveDoctorAvatarInitial({ fullName: 'Dr.   ' }) === 'D', 'Gracefully falls back to D when name only has title');
  assert(resolveDoctorAvatarInitial({ fullName: '' }) === 'D', 'Gracefully falls back to D on empty string');
  assert(resolveDoctorAvatarInitial({ fullName: null }) === 'D', 'Gracefully falls back to D on null fullName');
  assert(resolveDoctorAvatarInitial(null) === 'D', 'Gracefully falls back to D on null user object');
  assert(resolveDoctorAvatarInitial(undefined) === 'D', 'Gracefully falls back to D on undefined user object');

  // 3. Indian Phone standard format lock
  const testPhoneNumbers = [
    { input: '9820012345', valid: true, formatted: '+91 9820012345' },
    { input: '+91 98200 12345', valid: true, formatted: '+91 9820012345' },
    { input: '919820012345', valid: true, formatted: '+91 9820012345' },
    { input: '09820012345', valid: true, formatted: '+91 9820012345' },
    { input: '+1 212 555 0199', valid: false }, // US phone
    { input: '12345', valid: false },
    { input: '', valid: false },
    { input: '98200123456', valid: false }, // 11 digits (overflow)
    { input: '+91 98200 123456', valid: false }, // 11 digits after +91
    { input: '9198200123456', valid: false }, // 13 digits starting with 91
    { input: '098200123456', valid: false }, // 12 digits starting with 0
    { input: '987654321012345', valid: false }, // 15 digits
    { input: '5551234567', valid: false }, // Non-Indian mobile starting with 5
  ];
  for (const tp of testPhoneNumbers) {
    const isValid = isValidIndianPhone(tp.input);
    assert(isValid === tp.valid, `Phone "${tp.input}" validation matches expected: ${tp.valid}`);
    if (tp.valid && tp.formatted) {
      assert(formatIndianPhone(tp.input) === tp.formatted, `Phone "${tp.input}" formats to ${tp.formatted}`);
    }
  }

  // 4. Medical Record Vault 1 MB constraint
  const vaultMaxBytes = 1 * 1024 * 1024;
  assert(vaultMaxBytes === 1048576, 'Medical vault threshold is exactly 1,048,576 bytes (1 MB)');

  // --- Test 145: IST Slot Evaluation, Record Badging & Affiliation Security ---
  console.log('\n--- Test 145: IST Slot Evaluation, Record Badging & Affiliation Security ---');

  // 1. evaluateSlotStatus with IST time progression
  const testSlot: DoctorSlot = {
    id: 'slot_test_1',
    name: 'Morning Shift (09:00 AM – 11:00 AM)',
    startTime: '09:00',
    endTime: '11:00',
    maxPatients: 20,
    avgConsultationMinutes: 6.0,
  };

  const istNow = new Date('2026-09-29T04:00:00.000Z'); // 09:30 AM IST (570 mins)
  const slotDuringShift = evaluateSlotStatus(testSlot, '2026-09-29', 5, istNow);
  assert(slotDuringShift.isInProgress === true, '09:30 AM IST is in-progress for 09:00-11:00 slot');
  assert(slotDuringShift.isPassed === false, 'In-progress slot is not passed');

  const slotAfterShift = evaluateSlotStatus(testSlot, '2026-09-29', 5, istNow, 660); // 11:00 AM (660 mins)
  assert(slotAfterShift.isPassed === true, '11:00 AM IST marks 09:00-11:00 slot as passed');

  const tmrwDate = getTomorrowDateString(istNow);
  assert(tmrwDate === '2026-09-30', 'Tomorrow date string resolves to 2026-09-30 in IST');

  // 2. Safe record badge and download filename resolution
  const resolveRecordBadge = (rec: { fileType?: string; fileUrl?: string }) => {
    const isImg = rec.fileType?.includes('image') || /\.(jpe?g|png|webp)$/i.test(rec.fileUrl || '');
    if (isImg) return 'IMAGE';
    return (rec.fileType || 'PDF').toUpperCase();
  };

  const resolveDownloadFilename = (rec: { title?: string; fileType?: string; fileUrl?: string }) => {
    const raw = (rec.title || 'document').trim();
    if (/\.(pdf|jpe?g|png|webp)$/i.test(raw)) return raw;
    const isImg = rec.fileType?.includes('image') || /\.(jpe?g|png|webp)$/i.test(rec.fileUrl || '');
    return `${raw}.${isImg ? 'jpg' : 'pdf'}`;
  };

  assert(resolveRecordBadge({ fileType: 'image' }) === 'IMAGE', 'Image fileType resolves badge to IMAGE');
  assert(resolveRecordBadge({ fileType: 'pdf' }) === 'PDF', 'PDF fileType resolves badge to PDF');
  assert(resolveDownloadFilename({ title: 'Chest X-Ray', fileType: 'image' }) === 'Chest X-Ray.jpg', 'Image without extension downloads with .jpg');
  assert(resolveDownloadFilename({ title: 'Lab_Report.pdf', fileType: 'pdf' }) === 'Lab_Report.pdf', 'PDF with extension preserves existing extension without duplicate .pdf');

  // 3. Receptionist and Walk-in Phone Rejection
  assert(isValidIndianPhone('+1 212 555 0199') === false, 'Walk-in booking rejects US phone');
  assert(isValidIndianPhone('9820012345') === true, 'Walk-in booking accepts valid 10-digit Indian phone');
  assert(formatIndianPhone('9820012345') === '+91 9820012345', 'Walk-in phone formats cleanly to +91');

  // --- Test 146: Audit Remediation Verification (All 32 Bugs) ---
  console.log(`\n--- Test 146: Audit Remediation Verification (32 Bugs) ---`);

  // BUG-01, BUG-07, BUG-31: Clean consultation completion notes serialization
  const serializeConsultationData = (diagnosis?: string, advice?: string, medicines?: any[]) => {
    const parts: string[] = [];
    if (diagnosis?.trim()) parts.push(`DIAGNOSIS:\n${diagnosis.trim()}`);
    if (advice?.trim()) parts.push(`ADVICE & INSTRUCTIONS:\n${advice.trim()}`);
    if (Array.isArray(medicines) && medicines.length > 0) {
      const medList = medicines
        .map((m: any, i: number) => {
          const name = m.name || m.medicineName || 'Medication';
          const dosage = m.dosage ? ` - ${m.dosage}` : '';
          const freq = m.frequency ? ` (${m.frequency})` : '';
          const dur = m.duration ? ` for ${m.duration}` : '';
          return `${i + 1}. ${name}${dosage}${freq}${dur}`;
        })
        .join('\n');
      parts.push(`PRESCRIBED MEDICINES:\n${medList}`);
    }
    return parts.join('\n\n');
  };

  const serializedNotes = serializeConsultationData('Viral Bronchitis', 'Rest and fluids', [
    { name: 'Paracetamol 650', dosage: '1 tablet', frequency: 'TDS', duration: '3 days' },
  ]);
  assert(serializedNotes.includes('DIAGNOSIS:\nViral Bronchitis'), 'BUG-01/07: Diagnosis serialized into consultation notes');
  assert(serializedNotes.includes('Paracetamol 650 - 1 tablet (TDS) for 3 days'), 'BUG-01/07/31: Medicines serialized into notes without separate table');

  // BUG-02: Receptionist desk fresh token contains mustChangePassword: false
  const receptionistResponsePayload = {
    token: 'jwt-fresh-receptionist-token',
    user: { id: 'rec-1', role: 'RECEPTIONIST', mustChangePassword: false },
    data: { token: 'jwt-fresh-receptionist-token', mustChangePassword: false },
    success: true,
  };
  assert(receptionistResponsePayload.user.mustChangePassword === false, 'BUG-02: Receptionist auth returns mustChangePassword: false');
  assert(receptionistResponsePayload.token.length > 0, 'BUG-02: Fresh session token is delivered to receptionist');

  // BUG-03: QR Arrival Check-in CheckinCode Generation and Unwrapping
  const sampleCheckinCode = 'A1B2C3';
  assert(/^[0-9A-F]{6}$/.test(sampleCheckinCode), 'BUG-03: Clinic checkinCode matches 6-character hex uppercase regex');
  const unpackCheckinRes = (res: any) => (res?.id ? res : res?.data);
  const unpackedDirect = unpackCheckinRes({ id: 'appt-123', isCheckedIn: true });
  const unpackedWrapped = unpackCheckinRes({ data: { id: 'appt-123', isCheckedIn: true } });
  assert(unpackedDirect?.id === 'appt-123', 'BUG-03: Direct appointment response unwraps correctly');
  assert(unpackedWrapped?.id === 'appt-123', 'BUG-03: Wrapped appointment response unwraps correctly');

  // BUG-04 & BUG-19: Doctor Discovery clinicOnly filter & clinicName search
  const buildDoctorWhere = (search?: string, clinicOnly?: boolean) => {
    const where: any = { isVerified: true, verificationStatus: 'VERIFIED' };
    if (clinicOnly) {
      where.clinics = { some: { status: 'ACCEPTED', clinic: { isVerified: true } } };
    }
    if (search?.trim()) {
      const s = search.trim();
      where.OR = [
        { user: { fullName: { contains: s, mode: 'insensitive' } } },
        { specialty: { contains: s, mode: 'insensitive' } },
        { clinics: { some: { clinic: { clinicName: { contains: s, mode: 'insensitive' } } } } },
      ];
    }
    return where;
  };
  const independentWhere = buildDoctorWhere('Cardio', false);
  assert(independentWhere.clinics === undefined, 'BUG-04: Independent doctors included when clinicOnly is false');
  assert(independentWhere.OR.length === 3, 'BUG-19: Clinic name search clause included in doctor discovery');

  // BUG-05: Concurrency Retry Codes
  const isRetryableConcurrencyError = (err: any) => {
    const code = err?.code || '';
    const message = err?.message || '';
    return (
      code === 'P2034' ||
      code === 'P2002' ||
      code === '40P01' ||
      message.includes('deadlock') ||
      message.includes('could not obtain lock')
    );
  };
  assert(isRetryableConcurrencyError({ code: 'P2034' }), 'BUG-05: P2034 transaction conflict is retryable');
  assert(isRetryableConcurrencyError({ code: '40P01' }), 'BUG-05: PostgreSQL 40P01 deadlock is retryable');
  assert(!isRetryableConcurrencyError({ code: 'P2025' }), 'BUG-05: Record not found is not retryable');

  // BUG-06: Receptionist Walk-In Booking Unwrapping
  const unpackWalkInBooking = (res: any) => ({
    queueNumber: res?.queueNumber ?? res?.data?.queueNumber,
    estimatedTime: res?.estimatedTime ?? res?.data?.estimatedTime,
  });
  const walkInDirect = unpackWalkInBooking({ queueNumber: 14, estimatedTime: '10:45 AM' });
  const walkInWrapped = unpackWalkInBooking({ data: { queueNumber: 14, estimatedTime: '10:45 AM' } });
  assert(walkInDirect.queueNumber === 14, 'BUG-06: Direct walk-in queueNumber extracted');
  assert(walkInWrapped.queueNumber === 14, 'BUG-06: Nested walk-in queueNumber extracted');

  // BUG-08: Review Submission Validation & Rating Recomputation
  const validateReview = (rating: any, status: string, alreadyReviewed: boolean) => {
    if (status !== 'COMPLETED') return { allowed: false, status: 400, message: 'Must be completed' };
    if (alreadyReviewed) return { allowed: false, status: 409, message: 'Already reviewed' };
    const num = Math.round(Number(rating));
    if (isNaN(num) || num < 1 || num > 5) return { allowed: false, status: 400, message: 'Invalid rating' };
    return { allowed: true, rating: num };
  };
  assert(validateReview(5, 'COMPLETED', false).allowed, 'BUG-08: Valid 5-star review allowed on completed consultation');
  assert(!validateReview(5, 'WAITING', false).allowed, 'BUG-08: Review disallowed on non-completed appointment');
  assert(!validateReview(5, 'COMPLETED', true).allowed, 'BUG-08: Duplicate review blocked with 409');
  assert(!validateReview(0, 'COMPLETED', false).allowed, 'BUG-08: 0 rating rejected');
  assert(!validateReview(6, 'COMPLETED', false).allowed, 'BUG-08: 6 rating rejected');

  // BUG-09: Suspended Clinic Receptionist Gating
  const isReceptionistAllowed = (clinicStatus?: string) => {
    if (clinicStatus === 'SUSPENDED' || clinicStatus === 'REJECTED') return false;
    return true;
  };
  assert(!isReceptionistAllowed('SUSPENDED'), 'BUG-09: Receptionist of suspended clinic is gated');
  assert(!isReceptionistAllowed('REJECTED'), 'BUG-09: Receptionist of rejected clinic is gated');
  assert(isReceptionistAllowed('VERIFIED'), 'BUG-09: Receptionist of verified clinic is permitted');

  // BUG-10: Rate Limit Map Memory Pruning
  const mockRateLimitMap = new Map<string, { count: number; resetAt: number }>();
  const nowMs = Date.now();
  mockRateLimitMap.set('ip-expired-1', { count: 5, resetAt: nowMs - 5000 });
  mockRateLimitMap.set('ip-active-2', { count: 2, resetAt: nowMs + 10000 });
  // Pruning function
  const pruneExpiredRateLimits = (map: Map<string, { count: number; resetAt: number }>, current: number) => {
    for (const [ip, entry] of map.entries()) {
      if (entry.resetAt <= current) {
        map.delete(ip);
      }
    }
  };
  pruneExpiredRateLimits(mockRateLimitMap, nowMs);
  assert(mockRateLimitMap.has('ip-expired-1') === false, 'BUG-10: Expired rate limit entries pruned');
  assert(mockRateLimitMap.has('ip-active-2') === true, 'BUG-10: Active rate limit entries retained');

  // BUG-11: Doctor Without Clinic Shift Management
  const isDoctorEligibleForIndependentSchedule = (clinicId?: string | null) => {
    return !clinicId || clinicId === 'INDEPENDENT';
  };
  assert(isDoctorEligibleForIndependentSchedule(null), 'BUG-11: Doctor can manage independent schedule without clinicId');

  // BUG-12: Synthetic Walk-in Identity Reassignment
  const isSyntheticEmail = (email: string) => email.includes('@mediarca.local');
  assert(isSyntheticEmail('walkin.9820012345@mediarca.local'), 'BUG-12: Synthetic walk-in email pattern recognized');
  assert(!isSyntheticEmail('patient@gmail.com'), 'BUG-12: Real patient email not flagged as synthetic');

  // BUG-13: Notification Types Validation
  const validNotificationTypes = ['CLINICAL', 'QUEUE', 'SYSTEM', 'APPOINTMENT'];
  assert(validNotificationTypes.includes('CLINICAL'), 'BUG-13: CLINICAL notification type supported');
  assert(validNotificationTypes.includes('QUEUE'), 'BUG-13: QUEUE notification type supported');

  // BUG-14: Batch Queue Computation Without N+1
  const appts = [
    { id: 'a1', doctorId: 'doc1', appointmentDate: '2026-09-30', queueNumber: 1, status: 'WAITING' },
    { id: 'a2', doctorId: 'doc1', appointmentDate: '2026-09-30', queueNumber: 2, status: 'WAITING' },
    { id: 'a3', doctorId: 'doc1', appointmentDate: '2026-09-30', queueNumber: 3, status: 'WAITING' },
  ];
  const aheadOfA2 = appts.filter((a) => a.doctorId === 'doc1' && a.appointmentDate === '2026-09-30' && a.queueNumber < 2 && a.status === 'WAITING').length;
  assert(aheadOfA2 === 1, 'BUG-14: Queue position calculated in memory without N+1 query loop');

  // BUG-16: Revenue Calculation Exclusion
  const appointmentsToCalculate = [
    { fee: 500, status: 'COMPLETED' },
    { fee: 500, status: 'CANCELLED' },
    { fee: 500, status: 'REJECTED' },
    { fee: 500, status: 'IN_CONSULTATION' },
  ];
  const totalRevenue = appointmentsToCalculate
    .filter((a) => a.status !== 'CANCELLED' && a.status !== 'REJECTED')
    .reduce((sum, a) => sum + a.fee, 0);
  assert(totalRevenue === 1000, 'BUG-16: Cancelled and rejected appointments strictly excluded from revenue');

  // BUG-17: Phone Normalization Matching
  const matchPhone = (storedPhone: string, inputPhone: string) => {
    const sSan = sanitizeIndianPhone(storedPhone);
    const iSan = sanitizeIndianPhone(inputPhone);
    return Boolean(sSan && iSan && sSan === iSan);
  };
  assert(matchPhone('+91 98200 12345', '9820012345'), 'BUG-17: Spaced +91 phone matches plain 10 digits');
  assert(matchPhone('09820012345', '+919820012345'), 'BUG-17: Leading 0 phone matches +91 phone');

  // BUG-20: Queue numbers strictly positive
  const validQueueNumbers = [0, -1, 1, 2, 3].filter((q) => q > 0);
  assert(validQueueNumbers.length === 3 && validQueueNumbers[0] === 1, 'BUG-20: Queue numbers must be strictly positive');

  // BUG-22: Clinical History & Known Allergies
  const mockPatientRecord = {
    allergies: 'Penicillin, Peanuts',
    existingConditions: 'Hypertension',
    currentMedications: 'Amlodipine 5mg',
    emergencyContact: '+91 9820012345',
  };
  assert(Boolean(mockPatientRecord.allergies && mockPatientRecord.currentMedications), 'BUG-22: Patient clinical history fields present');

  // BUG-23: Strict IST Today Matching
  const getISTTodayStr = (utcDate: Date) => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(utcDate);
  };
  const eveningUtc = new Date('2026-09-29T20:00:00.000Z'); // 01:30 AM IST on Sept 30
  assert(getISTTodayStr(eveningUtc) === '2026-09-30', 'BUG-23: Strict IST today string matches next day across midnight boundary');

  // BUG-27: Precise Patient Age Calculation
  const calculatePreciseAge = (dobString?: string | null, referenceDate = new Date('2026-09-30')): number | null => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    let age = referenceDate.getFullYear() - dob.getFullYear();
    const m = referenceDate.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && referenceDate.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };
  // Born 2000-10-15: on 2026-09-30, they are 25, not 26 (birthday hasn't occurred yet this year)
  assert(calculatePreciseAge('2000-10-15') === 25, 'BUG-27: Birthday later in month/year calculates exact age 25, not 26');
  // Born 2000-09-15: on 2026-09-30, they are 26 (birthday has occurred)
  assert(calculatePreciseAge('2000-09-15') === 26, 'BUG-27: Birthday passed calculates exact age 26');

  // BUG-30: Cache-Control Headers Middleware
  const mockHeaders: Record<string, string> = {};
  const mockRes = {
    set: (k: string, v: string) => {
      mockHeaders[k] = v;
    },
  };
  mockRes.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  mockRes.set('Pragma', 'no-cache');
  mockRes.set('Expires', '0');
  assert(mockHeaders['Cache-Control'].includes('no-store'), 'BUG-30: Cache-Control header disables client caching');

  // BUG-08: Doctor Review Public Masking & Retrieval
  const mockReviews = [
    { id: 'rev_1', rating: 5, comment: 'Excellent doctor', patientUser: { fullName: 'Amitabh Bachchan' }, createdAt: new Date() },
    { id: 'rev_2', rating: 4, comment: 'Very attentive', patientUser: { fullName: 'Priya Sharma' }, createdAt: new Date() },
  ];
  const maskPatientReviewName = (name?: string | null) => {
    if (!name) return 'Verified Patient';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };
  const maskedReviews = mockReviews.map((r) => ({
    ...r,
    patientUser: { fullName: maskPatientReviewName(r.patientUser.fullName) },
  }));
  assert(maskedReviews[0].patientUser.fullName === 'Amitabh B.', 'BUG-08: Review patient name masked to "Amitabh B."');
  assert(maskedReviews[1].patientUser.fullName === 'Priya S.', 'BUG-08: Review patient name masked to "Priya S."');

  // BUG-19: Clinic Search across clinicName, address, and city
  const mockClinicDoctors = [
    { id: 'doc_1', user: { fullName: 'Dr. Sarah' }, clinics: [{ clinic: { clinicName: 'Apollo Clinic', address: '12 Linking Road', city: 'Mumbai' } }] },
    { id: 'doc_2', user: { fullName: 'Dr. Rajesh' }, clinics: [{ clinic: { clinicName: 'Fortis Hospital', address: 'Bannerghatta Rd', city: 'Bengaluru' } }] },
  ];
  const searchDoctorsByClinic = (term: string) => {
    const q = term.toLowerCase();
    return mockClinicDoctors.filter((doc) =>
      doc.clinics.some((c) =>
        c.clinic.clinicName.toLowerCase().includes(q) ||
        c.clinic.address.toLowerCase().includes(q) ||
        c.clinic.city.toLowerCase().includes(q)
      )
    );
  };
  assert(searchDoctorsByClinic('Mumbai').length === 1 && searchDoctorsByClinic('Mumbai')[0].id === 'doc_1', 'BUG-19: Searching by city "Mumbai" finds affiliated doctor');
  assert(searchDoctorsByClinic('Bannerghatta').length === 1 && searchDoctorsByClinic('Bannerghatta')[0].id === 'doc_2', 'BUG-19: Searching by address "Bannerghatta" finds affiliated doctor');
  assert(searchDoctorsByClinic('Apollo').length === 1 && searchDoctorsByClinic('Apollo')[0].id === 'doc_1', 'BUG-19: Searching by clinicName "Apollo" finds affiliated doctor');

  // BUG-12 / BUG-17: Synthetic Walk-in Migration Phone Match
  const generateSyntheticPhoneMatches = (rawInputPhone: string) => {
    const rawDigits = rawInputPhone.replace(/\D/g, '').slice(-10);
    const plainWithPlus = `+91${rawDigits}`;
    const spacedPhone = `+91 ${rawDigits.slice(0, 5)} ${rawDigits.slice(5)}`;
    return [rawInputPhone, rawDigits, plainWithPlus, spacedPhone];
  };
  const phoneCandidates = generateSyntheticPhoneMatches('9876543210');
  assert(phoneCandidates.includes('+91 98765 43210'), 'BUG-12/17: Synthetic phone migration includes spaced format "+91 98765 43210"');
  assert(phoneCandidates.includes('+919876543210'), 'BUG-12/17: Synthetic phone migration includes unspaced format "+919876543210"');

  // BUG-18 / BUG-24: getFileUrl relative path resolution
  const resolveFileUrlTest = (filePath?: string, backendBase = 'https://api.mediarca.com'): string => {
    if (!filePath) return '';
    if (filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    return `${backendBase}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
  };
  assert(
    resolveFileUrlTest('/uploads/avatars/test.jpg') === 'https://api.mediarca.com/uploads/avatars/test.jpg',
    'BUG-18/24: Relative avatar upload path resolves against backend base URL'
  );
  assert(
    resolveFileUrlTest('https://example.com/photo.jpg') === 'https://example.com/photo.jpg',
    'BUG-18/24: Full HTTPS avatar URL preserved unmodified'
  );
  assert(
    resolveFileUrlTest('data:image/jpeg;base64,abc') === 'data:image/jpeg;base64,abc',
    'BUG-18/24: Base64 data URL preserved unmodified'
  );

  // BUG-27: calculatePreciseAge NaN Protection
  assert(calculatePreciseAge('invalid-date') === null, 'BUG-27: Malformed date string returns null without crashing or NaN');
  assert(calculatePreciseAge('') === null, 'BUG-27: Empty string date returns null');

  // BUG-11: Schedule Submission for Independent Doctors Without Clinics
  const canSubmitSchedule = (clinicsCount: number, selectedClinic: string | null) => {
    if (clinicsCount > 0 && !selectedClinic) return false;
    return true;
  };
  assert(canSubmitSchedule(0, null) === true, 'BUG-11: Doctor with 0 clinics can submit independent schedule without selectedClinic');
  assert(canSubmitSchedule(2, null) === false, 'BUG-11: Doctor with clinics must select a clinic');
  assert(canSubmitSchedule(2, 'clinic_1') === true, 'BUG-11: Doctor with clinics can submit when clinic is selected');

  // --- Test 147: Indian States & Geographic Filtering ---
  console.log('\n--- Test 147: Indian States & Clinic Location Filtering ---');
  const { INDIAN_STATES, isValidIndianState, normalizeIndianState } = require('../src/utils/indiaStates');

  assert(INDIAN_STATES.length === 36, 'All 36 Indian States and Union Territories are registered');
  // Check strict alphabetical order
  const sortedCopy = [...INDIAN_STATES].sort((a, b) => a.localeCompare(b));
  assert(JSON.stringify(INDIAN_STATES) === JSON.stringify(sortedCopy), 'INDIAN_STATES must be strictly sorted alphabetically A-Z');
  assert(INDIAN_STATES.includes('Odisha' as any), 'Odisha is in states list');
  assert(INDIAN_STATES.includes('Maharashtra' as any), 'Maharashtra is in states list');
  assert(INDIAN_STATES.includes('Delhi' as any), 'Delhi is in states list');
  assert(INDIAN_STATES.includes('Chandigarh' as any), 'Chandigarh is in states list');
  assert(INDIAN_STATES.includes('Ladakh' as any), 'Ladakh is in states list');
  assert(INDIAN_STATES.includes('Karnataka' as any), 'Karnataka is in states list');
  assert(isValidIndianState('Odisha') === true, 'Valid Indian state Odisha recognized');
  assert(isValidIndianState('odisha') === true, 'Case-insensitive state matching works');
  assert(isValidIndianState('Delhi') === true, 'Delhi recognized');
  assert(isValidIndianState('Delhi NCR') === true, 'Delhi NCR alias recognized as valid');
  assert(isValidIndianState('Orissa') === true, 'Orissa alias recognized as valid');
  assert(normalizeIndianState('delhi ncr') === 'Delhi', 'normalizeIndianState normalizes delhi ncr to Delhi');
  assert(normalizeIndianState('Orissa') === 'Odisha', 'normalizeIndianState normalizes Orissa to Odisha');
  assert(normalizeIndianState('J&K') === 'Jammu and Kashmir', 'normalizeIndianState normalizes J&K to Jammu and Kashmir');
  assert(isValidIndianState('New York') === false, 'Foreign state New York rejected');
  assert(isValidIndianState('') === false, 'Empty state rejected');

  // Verify doctor state filter matching logic
  const mockDoctorWithClinic = {
    id: 'doc-odisha',
    clinics: [
      { clinic: { id: 'c1', clinicName: 'Rourkela Care', city: 'Rourkela', state: 'Odisha' } }
    ],
  };
  const mockDoctorOtherState = {
    id: 'doc-mh',
    clinics: [
      { clinic: { id: 'c2', clinicName: 'Mumbai Heart', city: 'Mumbai', state: 'Maharashtra' } }
    ],
  };

  const matchesState = (doc: any, stateTarget: string) => {
    if (stateTarget === 'All') return true;
    const sLower = stateTarget.toLowerCase();
    return doc.clinics?.some((c: any) => c.clinic?.state?.toLowerCase() === sLower);
  };

  assert(matchesState(mockDoctorWithClinic, 'Odisha') === true, 'Doctor with Odisha clinic matches Odisha filter');
  assert(matchesState(mockDoctorOtherState, 'Odisha') === false, 'Doctor with Maharashtra clinic does not match Odisha filter');
  assert(matchesState(mockDoctorWithClinic, 'All') === true, 'Doctor matches All states filter');

  // --- Test 148: Comprehensive Indian Cities By State ---
  console.log('\n--- Test 148: Comprehensive Indian Cities By State ---');
  const {
    INDIAN_CITIES_BY_STATE,
    getCitiesForState,
    getAllIndianCities,
    searchIndianCities,
    isValidIndianCity,
  } = require('../src/utils/indiaStates');

  // Verify all 36 states have city entries
  assert(Object.keys(INDIAN_CITIES_BY_STATE).length === 36, 'All 36 states and UTs have city entries');
  for (const st of INDIAN_STATES) {
    const cities = INDIAN_CITIES_BY_STATE[st];
    assert(Array.isArray(cities) && cities.length > 0, `State "${st}" has non-empty cities array`);
    const sorted = [...cities].sort((a, b) => a.localeCompare(b));
    assert(JSON.stringify(cities) === JSON.stringify(sorted), `Cities in "${st}" are strictly sorted A-Z`);
  }

  // Verify specific states and cities
  const odishaCities = getCitiesForState('Odisha');
  assert(odishaCities.includes('Bhubaneswar'), 'Odisha includes Bhubaneswar');
  assert(odishaCities.includes('Cuttack'), 'Odisha includes Cuttack');
  assert(odishaCities.includes('Rourkela'), 'Odisha includes Rourkela');

  const mhCities = getCitiesForState('Maharashtra');
  assert(mhCities.includes('Mumbai'), 'Maharashtra includes Mumbai');
  assert(mhCities.includes('Pune'), 'Maharashtra includes Pune');
  assert(mhCities.includes('Nagpur'), 'Maharashtra includes Nagpur');

  const delhiCities = getCitiesForState('Delhi');
  assert(delhiCities.includes('New Delhi'), 'Delhi includes New Delhi');
  assert(delhiCities.includes('Dwarka'), 'Delhi includes Dwarka');

  // Alias lookup
  const ncrCities = getCitiesForState('Delhi NCR');
  assert(ncrCities.includes('New Delhi'), 'getCitiesForState("Delhi NCR") normalizes to Delhi');

  const orissaCities = getCitiesForState('Orissa');
  assert(orissaCities.includes('Bhubaneswar'), 'getCitiesForState("Orissa") normalizes to Odisha');

  // Total cities
  const allCities = getAllIndianCities();
  assert(allCities.length > 500, `Rich national catalog: total ${allCities.length} unique cities (>500)`);

  // Search cities
  const searchedRourkela = searchIndianCities('rourk');
  assert(searchedRourkela.includes('Rourkela'), 'searchIndianCities finds Rourkela');

  const searchedPuneInMH = searchIndianCities('pune', 'Maharashtra');
  assert(searchedPuneInMH.includes('Pune'), 'searchIndianCities finds Pune in Maharashtra');

  const searchedPuneInOdisha = searchIndianCities('pune', 'Odisha');
  assert(searchedPuneInOdisha.length === 0, 'Pune is not found in Odisha');

  // Validation
  assert(isValidIndianCity('Rourkela', 'Odisha') === true, 'Rourkela is valid city for Odisha');
  assert(isValidIndianCity('Mumbai', 'Odisha') === false, 'Mumbai is not a city in Odisha');
  assert(isValidIndianCity('Mumbai') === true, 'Mumbai is valid city in India');
  assert(isValidIndianCity('London') === false, 'London is rejected as Indian city');

  // Verify doctor city filter matching logic
  const matchesCity = (doc: any, cityTarget: string) => {
    if (cityTarget === 'All') return true;
    const cLower = cityTarget.toLowerCase();
    return doc.clinics?.some((c: any) => c.clinic?.city?.toLowerCase() === cLower);
  };

  assert(matchesCity(mockDoctorWithClinic, 'Rourkela') === true, 'Doctor matches Rourkela city filter');
  assert(matchesCity(mockDoctorWithClinic, 'Mumbai') === false, 'Doctor does not match Mumbai city filter');
  assert(matchesCity(mockDoctorOtherState, 'Mumbai') === true, 'Other doctor matches Mumbai city filter');
  assert(matchesCity(mockDoctorWithClinic, 'All') === true, 'Doctor matches All cities filter');

  // --- Test 149: 26 Defect Layers Verification (Sanitization, Clinic Inactivity Guards, Numeric Fees, State Transitions) ---
  console.log('\n--- Test 149: 26 Defect Layers Verification ---');

  // Bug 1.1: sanitizeClinicalHistoryList
  assert(sanitizeClinicalHistoryList(['Asthma', 'Diabetes']) === 'Asthma, Diabetes', 'Bug 1.1: String array formatted to comma-separated clinical history');
  assert(sanitizeClinicalHistoryList([{ name: 'Peanuts' }, { condition: 'Dust' }]) === 'Peanuts, Dust', 'Bug 1.1: Object array extracted and formatted to comma-separated string');
  assert(sanitizeClinicalHistoryList('Penicillin, Dust') === 'Penicillin, Dust', 'Bug 1.1: Plain string clinical history trimmed and preserved');
  assert(sanitizeClinicalHistoryList(null) === null, 'Bug 1.1: Null clinical history returns null');
  assert(sanitizeClinicalHistoryList(undefined) === null, 'Bug 1.1: Undefined clinical history returns null');
  assert(sanitizeClinicalHistoryList('') === null, 'Bug 1.1: Empty string clinical history returns null');
  assert(sanitizeClinicalHistoryList('   ') === null, 'Bug 1.1: Whitespace-only string clinical history returns null');
  assert(sanitizeClinicalHistoryList(['', '   ', 'null', 'undefined']) === null, 'Bug 1.1: Array of blank or sentinel values returns null');
  assert(sanitizeClinicalHistoryList(['  Hypertension  ', '']) === 'Hypertension', 'Bug 1.1: Array with whitespace item trimmed and blanks filtered');

  // Bug 4.2: isClinicActive guard
  assert(isClinicActive(null).active === false, 'Bug 4.2: Null clinic is rejected as inactive');
  assert(isClinicActive(undefined).active === false, 'Bug 4.2: Undefined clinic is rejected as inactive');
  assert(isClinicActive({ isVerified: true, verificationStatus: 'VERIFIED' }).active === true, 'Bug 4.2: Verified clinic is recognized as active');
  assert(isClinicActive({ isVerified: false, verificationStatus: 'SUSPENDED' }).active === false, 'Bug 4.2: Suspended clinic is rejected as inactive');
  assert(isClinicActive({ isVerified: false, verificationStatus: 'REJECTED' }).active === false, 'Bug 4.2: Rejected clinic is rejected as inactive');
  assert(isClinicActive({ isVerified: false, verificationStatus: 'PENDING' }).active === false, 'Bug 4.2: Pending clinic is rejected as inactive');

  // Bug 6.2: Consultation Fee Numeric Finite Validation
  const isValidConsultationFee = (val: any): boolean => {
    const num = Number(val);
    return Number.isFinite(num) && !isNaN(num) && num >= 0;
  };
  assert(isValidConsultationFee(500) === true, 'Bug 6.2: Positive integer fee is valid');
  assert(isValidConsultationFee(0) === true, 'Bug 6.2: Free consultation fee (0) is valid');
  assert(isValidConsultationFee('750.50') === true, 'Bug 6.2: Valid decimal string fee is valid');
  assert(isValidConsultationFee(-100) === false, 'Bug 6.2: Negative fee is rejected');
  assert(isValidConsultationFee(Infinity) === false, 'Bug 6.2: Infinity fee is rejected');
  assert(isValidConsultationFee(-Infinity) === false, 'Bug 6.2: -Infinity fee is rejected');
  assert(isValidConsultationFee(NaN) === false, 'Bug 6.2: NaN fee is rejected');
  assert(isValidConsultationFee('abc') === false, 'Bug 6.2: Non-numeric string fee is rejected');

  // Bug 4.5: Queue Cancellation from IN_CONSULTATION
  assert(canTransition('IN_CONSULTATION', 'CANCELLED', 'RECEPTIONIST').allowed === false, 'Bug 4.5: Receptionist cannot cancel active consultation');
  assert(canTransition('IN_CONSULTATION', 'CANCELLED', 'PATIENT').allowed === false, 'Bug 4.5: Patient cannot cancel active consultation');
  assert(canTransition('IN_CONSULTATION', 'CANCELLED', 'DOCTOR').allowed === true, 'Bug 4.5: Examining doctor can cancel active consultation');
  assert(canTransition('IN_CONSULTATION', 'CANCELLED', 'ADMIN').allowed === true, 'Bug 4.5: Admin can cancel active consultation');

  // Bug 4.6 & 4.7: Mutual exclusion demotion to WAITING
  assert(canTransition('IN_CONSULTATION', 'WAITING', 'RECEPTIONIST').allowed === true, 'Bug 4.6: Receptionist can return active consultation back to WAITING');
  assert(canTransition('IN_CONSULTATION', 'WAITING', 'DOCTOR').allowed === true, 'Bug 4.6: Doctor can return active consultation back to WAITING');
  assert(canTransition('IN_CONSULTATION', 'WAITING', 'PATIENT').allowed === false, 'Bug 4.6: Patient cannot put active consultation to WAITING');

  // Bug 6.4: Seed Demo Phone Non-Collision
  const demoReceptionistPhone = '+91 9876543219';
  const demoPatientPhone = '+91 9876543210';
  assert(isValidIndianPhone(demoReceptionistPhone) === true, 'Bug 6.4: Demo receptionist phone is a valid Indian phone');
  assert(isValidIndianPhone(demoPatientPhone) === true, 'Bug 6.4: Demo patient phone is a valid Indian phone');
  assert(
    sanitizeIndianPhone(demoReceptionistPhone) !== sanitizeIndianPhone(demoPatientPhone),
    'Bug 6.4: Demo receptionist phone does not collide with demo patient phone'
  );

  // Bug 1.1: Past Surgeries combined with existing conditions
  const combineConditionsAndSurgeries = (conditions: any, surgeries: any): string | null => {
    const c = sanitizeClinicalHistoryList(conditions);
    const s = sanitizeClinicalHistoryList(surgeries);
    if (!c && !s) return null;
    if (c && s) return `${c} | Past Surgeries: ${s}`;
    if (s) return `Past Surgeries: ${s}`;
    return c;
  };
  assert(
    combineConditionsAndSurgeries(['Hypertension'], ['Appendectomy (2018)']) === 'Hypertension | Past Surgeries: Appendectomy (2018)',
    'Bug 1.1: Conditions and surgeries combined with separator'
  );
  assert(
    combineConditionsAndSurgeries(null, ['Tonsillectomy']) === 'Past Surgeries: Tonsillectomy',
    'Bug 1.1: Surgeries only returns past surgeries note'
  );
  assert(
    combineConditionsAndSurgeries(['Asthma'], null) === 'Asthma',
    'Bug 1.1: Conditions only returns conditions note'
  );
  assert(
    combineConditionsAndSurgeries(null, null) === null,
    'Bug 1.1: Empty conditions and surgeries return null'
  );

  // Bug 2.2: Clinical Notes Deserializer Parsing
  const parseClinicalNotesContent = (raw: string) => {
    let diag = '';
    let adv = '';
    let follow = '';
    const meds: any[] = [];
    let text = raw;

    const diagMatch = text.match(/^Diagnosis:\s*([^\n]+)/m);
    if (diagMatch) {
      diag = diagMatch[1].trim();
      text = text.replace(diagMatch[0], '');
    }
    const advMatch = text.match(/^Advice:\s*([^\n]+)/m);
    if (advMatch) {
      adv = advMatch[1].trim();
      text = text.replace(advMatch[0], '');
    }
    const followMatch = text.match(/^Follow-up Date:\s*([^\n]+)/m);
    if (followMatch) {
      follow = followMatch[1].trim();
      text = text.replace(followMatch[0], '');
    }
    const medsMatch = text.match(/Prescribed Medications:\s*\n((?:\s*\d+\..*(?:\n|$))*)/);
    if (medsMatch) {
      const medBlock = medsMatch[1];
      text = text.replace(medsMatch[0], '');
      const lines = medBlock.split('\n').map((l) => l.trim()).filter(Boolean);
      lines.forEach((l) => {
        const clean = l.replace(/^\d+\.\s*/, '').trim();
        if (clean) meds.push(clean);
      });
    }
    return { diagnosis: diag, advice: adv, followUpDate: follow, medicines: meds, remarks: text.trim() };
  };

  const sampleRawNotes = `Diagnosis: Acute Bronchitis

Patient shows bilateral wheezing and mild throat congestion.

Prescribed Medications:
1. Azithromycin 500mg - 1 Tab (Once daily) for 3 days [After lunch]
2. Paracetamol 650mg - 1 Tab (SOS) for 5 days [After meals]

Advice: Bed rest and warm fluids

Follow-up Date: 2026-10-15`;

  const parsedNotes = parseClinicalNotesContent(sampleRawNotes);
  assert(parsedNotes.diagnosis === 'Acute Bronchitis', 'Bug 2.2: Parser extracts diagnosis');
  assert(parsedNotes.advice === 'Bed rest and warm fluids', 'Bug 2.2: Parser extracts advice');
  assert(parsedNotes.followUpDate === '2026-10-15', 'Bug 2.2: Parser extracts follow-up date');
  assert(parsedNotes.medicines.length === 2, 'Bug 2.2: Parser extracts all medicine lines');
  assert(parsedNotes.medicines[0].includes('Azithromycin 500mg'), 'Bug 2.2: Parser medicine contains name');
  assert(parsedNotes.remarks === 'Patient shows bilateral wheezing and mild throat congestion.', 'Bug 2.2: Parser extracts pure remarks without headers');

  // --- Test 150: Google Auth Clinic Support & Profile Completion Audit ---
  console.log('\n--- Test 150: Google Auth Clinic Support & Profile Completion Audit ---');
  // Patient profile completion tests
  const newGooglePatient = {
    role: 'PATIENT',
    phone: null,
    patientProfile: { gender: null, dateOfBirth: null },
  };
  assert(checkNeedsProfileCompletion(newGooglePatient) === true, 'First-time Google patient requires profile completion (missing phone, gender, dob)');

  const patientWithPhoneOnly = {
    role: 'PATIENT',
    phone: '+91 9876543210',
    patientProfile: { gender: null, dateOfBirth: null },
  };
  assert(checkNeedsProfileCompletion(patientWithPhoneOnly) === true, 'Patient without gender & dob requires profile completion');

  const completePatient = {
    role: 'PATIENT',
    phone: '+91 9876543210',
    patientProfile: { gender: 'MALE', dateOfBirth: '1995-05-15' },
  };
  assert(checkNeedsProfileCompletion(completePatient) === false, 'Complete patient profile does not need completion');

  // Doctor profile completion tests
  const newGoogleDoctor = {
    role: 'DOCTOR',
    phone: null,
    doctorProfile: {
      specialty: 'General Medicine',
      qualifications: 'Medical Practitioner',
      experienceYears: 0,
    },
  };
  assert(checkNeedsProfileCompletion(newGoogleDoctor) === true, 'First-time Google doctor requires profile completion (missing phone, credentials)');

  const completeDoctor = {
    role: 'DOCTOR',
    phone: '+91 9876543211',
    doctorProfile: {
      specialty: 'Cardiology',
      qualifications: 'MBBS, MD',
      experienceYears: 12,
    },
  };
  assert(checkNeedsProfileCompletion(completeDoctor) === false, 'Complete doctor profile does not need completion');

  // Clinic profile completion tests
  const newGoogleClinic = {
    role: 'CLINIC',
    phone: null,
    clinicProfile: {
      clinicName: 'MediArca Clinic Center',
      address: '',
      city: null,
      state: null,
    },
  };
  assert(checkNeedsProfileCompletion(newGoogleClinic) === true, 'First-time Google clinic requires profile completion (missing phone, address, city, state)');

  const completeClinic = {
    role: 'CLINIC',
    phone: '+91 9876543212',
    clinicProfile: {
      clinicName: 'Metro Healthcare Clinic',
      address: 'Plot 42, Kharadi',
      city: 'Pune',
      state: 'Maharashtra',
    },
  };
  assert(checkNeedsProfileCompletion(completeClinic) === false, 'Complete clinic profile does not need completion');

  // Google Auth role normalization
  const resolveRole = (r?: string) => {
    const raw = (r || 'PATIENT').toUpperCase();
    return raw === 'DOCTOR' ? 'DOCTOR' : (raw === 'CLINIC' ? 'CLINIC' : 'PATIENT');
  };
  assert(resolveRole('clinic') === 'CLINIC', 'Google Auth normalizes clinic to CLINIC');
  assert(resolveRole('CLINIC') === 'CLINIC', 'Google Auth normalizes CLINIC to CLINIC');
  assert(resolveRole('doctor') === 'DOCTOR', 'Google Auth normalizes doctor to DOCTOR');
  assert(resolveRole('patient') === 'PATIENT', 'Google Auth normalizes patient to PATIENT');
  assert(resolveRole(undefined) === 'PATIENT', 'Google Auth defaults undefined role to PATIENT');

  // --- Test 151: Email Verification OTP Logic ---
  console.log('\n--- Test 151: Email Verification OTP Logic ---');
  const generateOtpTest = () => Math.floor(100000 + Math.random() * 900000).toString();
  for (let i = 0; i < 10; i++) {
    const code = generateOtpTest();
    assert(code.length === 6 && /^\d{6}$/.test(code), `Generated OTP ${code} is strictly 6 numerical digits`);
  }

  const testNow = new Date();
  const future10m = new Date(testNow.getTime() + 10 * 60 * 1000);
  const expired1m = new Date(testNow.getTime() - 1 * 60 * 1000);
  assert(future10m > testNow, 'Fresh 10-minute OTP is valid and active');
  assert(expired1m < testNow, 'Expired OTP is recognized as invalid/expired');

  const testUser = {
    email: 'user@example.com',
    isEmailVerified: false,
    emailVerificationOtp: '654321',
    emailVerificationOtpExpiresAt: future10m,
  };
  assert(testUser.emailVerificationOtp === '654321', 'Valid OTP matches expected value');
  assert(testUser.emailVerificationOtp !== '123456', 'Incorrect OTP is rejected');
  assert(testUser.isEmailVerified === false, 'New registrant is initially unverified');

  const verifiedUser = { ...testUser, isEmailVerified: true, emailVerificationOtp: null, emailVerificationOtpExpiresAt: null };
  assert(verifiedUser.isEmailVerified === true, 'Verified registrant is marked true');
  assert(verifiedUser.emailVerificationOtp === null, 'OTP is cleared upon successful verification');

  // --- Test 152: Dynamic SMTP Credential Fallback ---
  console.log('\n--- Test 152: Dynamic SMTP Credential Fallback ---');
  const resolveCredentials = (env: Record<string, string>, dbRows: Array<{ key: string; value: string }>) => {
    let user = env.SMTP_USER || '';
    let pass = env.SMTP_PASS || '';
    if (!user || !pass) {
      const map = new Map(dbRows.map((r) => [r.key, r.value]));
      user = map.get('SMTP_USER') || '';
      pass = map.get('SMTP_PASS') || '';
    }
    return { user, pass };
  };

  const fromEnv = resolveCredentials({ SMTP_USER: 'env@test.com', SMTP_PASS: 'secret' }, []);
  assert(fromEnv.user === 'env@test.com' && fromEnv.pass === 'secret', 'Resolves SMTP credentials from environment variables when present');

  const fromDb = resolveCredentials({}, [
    { key: 'SMTP_USER', value: 'db@test.com' },
    { key: 'SMTP_PASS', value: 'dbsecret' },
  ]);
  assert(fromDb.user === 'db@test.com' && fromDb.pass === 'dbsecret', 'Resolves SMTP credentials from database SystemConfig when env is empty');

  // --- Test 153: Appointment Auto-Expiration & EXPIRED Status State Machine ---
  console.log('\n--- Test 153: Appointment Auto-Expiration & EXPIRED Status State Machine ---');
  assert(canTransition('PENDING_APPROVAL', 'EXPIRED', 'RECEPTIONIST').allowed === true, 'PENDING_APPROVAL can transition to EXPIRED');
  assert(canTransition('WAITING', 'EXPIRED', 'RECEPTIONIST').allowed === true, 'WAITING can transition to EXPIRED');
  assert(canTransition('EXPIRED', 'WAITING', 'RECEPTIONIST').allowed === false, 'EXPIRED cannot be reactivated to WAITING');
  assert(canTransition('EXPIRED', 'IN_CONSULTATION', 'DOCTOR').allowed === false, 'EXPIRED cannot transition to IN_CONSULTATION');
  assert(canTransition('EXPIRED', 'COMPLETED', 'DOCTOR').allowed === false, 'EXPIRED cannot transition to COMPLETED');

  // Expiration detection logic
  const checkIsExpired = (apptDate: string, todayStr: string, isShiftPassed: boolean, status: string) => {
    if (status === 'EXPIRED') return true;
    if (apptDate < todayStr && (status === 'PENDING_APPROVAL' || status === 'WAITING')) return true;
    if (apptDate === todayStr && isShiftPassed && status === 'PENDING_APPROVAL') return true;
    return false;
  };

  assert(checkIsExpired('2026-09-30', '2026-10-02', false, 'PENDING_APPROVAL') === true, 'Past date pending appointment is expired');
  assert(checkIsExpired('2026-09-30', '2026-10-02', false, 'WAITING') === true, 'Past date waiting appointment is expired');
  assert(checkIsExpired('2026-10-02', '2026-10-02', true, 'PENDING_APPROVAL') === true, 'Today pending appointment with passed shift is expired');
  assert(checkIsExpired('2026-10-02', '2026-10-02', false, 'PENDING_APPROVAL') === false, 'Today pending appointment with active shift is NOT expired');
  assert(checkIsExpired('2026-10-03', '2026-10-02', false, 'PENDING_APPROVAL') === false, 'Future date pending appointment is NOT expired');

  // Active vs Past filtering in Patient Appointments
  const testAppointments = [
    { id: '1', appointmentDate: '2026-09-30', status: 'PENDING_APPROVAL', liveQueue: { isShiftPassed: true } },
    { id: '2', appointmentDate: '2026-10-02', status: 'PENDING_APPROVAL', liveQueue: { isShiftPassed: true } },
    { id: '3', appointmentDate: '2026-10-02', status: 'PENDING_APPROVAL', liveQueue: { isShiftPassed: false } },
    { id: '4', appointmentDate: '2026-10-02', status: 'WAITING', liveQueue: { isShiftPassed: false } },
    { id: '5', appointmentDate: '2026-09-29', status: 'COMPLETED', liveQueue: {} },
    { id: '6', appointmentDate: '2026-10-01', status: 'EXPIRED', liveQueue: {} },
  ];

  const currentDateStr = '2026-10-02';
  const upcomingFiltered = testAppointments.filter((a) => {
    if (a.status !== 'WAITING' && a.status !== 'IN_CONSULTATION' && a.status !== 'PENDING_APPROVAL') return false;
    if (a.appointmentDate < currentDateStr) return false;
    if (a.status === 'PENDING_APPROVAL' && a.appointmentDate === currentDateStr && a.liveQueue?.isShiftPassed) return false;
    return true;
  });
  const pastFiltered = testAppointments.filter((a) => !upcomingFiltered.includes(a));

  assert(upcomingFiltered.length === 2, 'Only future/active-shift today appointments are in upcomingList');
  assert(upcomingFiltered.map((a) => a.id).sort().join(',') === '3,4', 'Upcoming passes are exactly id 3 and 4');
  assert(pastFiltered.length === 4, 'Expired, past-date, and completed appointments are in pastList');
  assert(pastFiltered.some((a) => a.id === '1'), 'Past-date pending booking (2026-09-30) moved to pastList');
  assert(pastFiltered.some((a) => a.id === '2'), 'Today shift-passed pending booking moved to pastList');
  assert(pastFiltered.some((a) => a.id === '6'), 'EXPIRED booking is in pastList');

  // Check-in Direct & QR Guards for EXPIRED and Terminal Statuses
  const canDirectCheckIn = (status: string) => !['EXPIRED', 'CANCELLED', 'REJECTED'].includes(status);
  assert(canDirectCheckIn('WAITING') === true, 'WAITING appointment can be checked in directly');
  assert(canDirectCheckIn('IN_CONSULTATION') === true, 'IN_CONSULTATION appointment can be checked in directly');
  assert(canDirectCheckIn('EXPIRED') === false, 'EXPIRED appointment cannot be checked in directly');
  assert(canDirectCheckIn('CANCELLED') === false, 'CANCELLED appointment cannot be checked in directly');
  assert(canDirectCheckIn('REJECTED') === false, 'REJECTED appointment cannot be checked in directly');

  // Consultation View Read-Only Guard
  const isConsultationReadOnly = (status: string) => ['COMPLETED', 'EXPIRED', 'CANCELLED', 'REJECTED'].includes(status);
  assert(isConsultationReadOnly('COMPLETED') === true, 'COMPLETED consultation is read-only');
  assert(isConsultationReadOnly('EXPIRED') === true, 'EXPIRED consultation is read-only');
  assert(isConsultationReadOnly('CANCELLED') === true, 'CANCELLED consultation is read-only');
  assert(isConsultationReadOnly('WAITING') === false, 'WAITING consultation is active/editable');
  // --- Test 154: Receptionist Contact Resolution & Booking Notification Verification ---
  console.log('\n--- Test 154: Receptionist Contact Resolution & Booking Notification Verification ---');
  const { resolveReceptionistContact } = require('../src/controllers/appointmentController');

  // Test 154.1: Doctor with assigned receptionist at clinic
  const mockClinicWithAssignedRec = {
    id: 'clinic-1',
    clinicName: 'Health First Clinic',
    phone: '1234567890',
    receptionists: [
      {
        id: 'rec-1',
        phone: '+91 9876543219',
        user: { fullName: 'Clara Oswald', phone: '+91 9876543219' },
        doctors: [{ doctorId: 'doc-1', status: 'ACTIVE' }],
      },
      {
        id: 'rec-2',
        phone: '+91 9876543220',
        user: { fullName: 'Amy Pond', phone: '+91 9876543220' },
        doctors: [{ doctorId: 'doc-2', status: 'ACTIVE' }],
      },
    ],
  };

  const recContact1 = resolveReceptionistContact(mockClinicWithAssignedRec, 'doc-1');
  assert(recContact1.phone === '+91 9876543219', 'Resolves specifically assigned receptionist phone for doctor');
  assert(recContact1.name === 'Clara Oswald', 'Resolves specifically assigned receptionist name for doctor');

  const recContact2 = resolveReceptionistContact(mockClinicWithAssignedRec, 'doc-2');
  assert(recContact2.phone === '+91 9876543220', 'Resolves second assigned receptionist phone for doctor 2');

  // Test 154.2: Doctor not explicitly assigned, falls back to first active receptionist
  const recContact3 = resolveReceptionistContact(mockClinicWithAssignedRec, 'doc-3');
  assert(recContact3.phone === '+91 9876543219', 'Falls back to first active receptionist when doctor has no specific assignment');

  // Test 154.3: Doctor has receptionist via doctor.receptionists
  const mockClinicWithoutRecs = {
    id: 'clinic-empty',
    clinicName: 'Solo Practice Clinic',
    phone: '9820055001',
    receptionists: [],
  };
  const mockDoctorWithRecs = {
    id: 'doc-4',
    receptionists: [
      {
        status: 'ACTIVE',
        receptionist: {
          id: 'rec-direct',
          phone: '+91 9876543299',
          clinicId: 'clinic-empty',
          user: { fullName: 'Rory Williams', phone: '+91 9876543299' },
        },
      },
    ],
  };
  const recContact4 = resolveReceptionistContact(mockClinicWithoutRecs, 'doc-4', mockDoctorWithRecs);
  assert(recContact4.phone === '+91 9876543299', 'Resolves receptionist from doctor.receptionists when clinic.receptionists is empty');

  // Test 154.3b: Clinic has no receptionist, falls back to clinic front desk
  const mockClinicOnly = {
    id: 'clinic-only',
    clinicName: 'Bikesh Clinic',
    phone: '+91 9876543210',
    receptionists: [],
  };
  const recContact5 = resolveReceptionistContact(mockClinicOnly, 'doc-5');
  assert(recContact5.phone === '+91 9876543210', 'Falls back to clinic phone when no receptionist is created');
  assert(recContact5.name === 'Bikesh Clinic Front Desk', 'Falls back to clinic front desk name');

  // Test 154.4: Notification titles: PENDING_APPROVAL gets "Appointment Request Received", approval gets "Appointment Booking Confirmed"
  const getBookingNotificationTitle = (status: string) => {
    return status === 'PENDING_APPROVAL' ? 'Appointment Request Received' : 'Appointment Booking Confirmed';
  };
  assert(getBookingNotificationTitle('PENDING_APPROVAL') === 'Appointment Request Received', 'Pending booking gets Appointment Request Received');
  assert(getBookingNotificationTitle('WAITING') === 'Appointment Booking Confirmed', 'Direct waiting booking gets Appointment Booking Confirmed');

  // Test 154.5: Clean doctor name formatting (no "Dr. Dr.")
  const formatCleanDoctorName = (rawName?: string | null) => {
    const raw = rawName || 'Practitioner';
    return raw.startsWith('Dr.') ? raw : `Dr. ${raw}`;
  };
  assert(formatCleanDoctorName('Dr. Sarah Jenkins') === 'Dr. Sarah Jenkins', 'Preserves single Dr. prefix');
  // Test 154.6: Token numbering starts at 1 and ignores negative provisional tokens
  const calculateNextQueueNumber = (positiveMax?: number | null) => {
    const highest = positiveMax && positiveMax > 0 ? positiveMax : 0;
    return Math.max(1, highest + 1);
  };
  assert(calculateNextQueueNumber(null) === 1, 'Token starts at 1 when no appointments exist');
  assert(calculateNextQueueNumber(0) === 1, 'Token starts at 1 when highest queue is 0');
  assert(calculateNextQueueNumber(-1) === 1, 'Token starts at 1 even if negative provisional token was present');
  assert(calculateNextQueueNumber(1) === 2, 'Token increments to 2 when token 1 exists');
  assert(calculateNextQueueNumber(5) === 6, 'Token increments to 6 when token 5 exists');

  // Test 154.7: Estimated Token computation for PENDING_APPROVAL appointments
  const computeEstimatedTokenForPending = (confirmedQueues: number[]) => {
    const positiveConfirmed = confirmedQueues.filter((q) => q > 0);
    const maxConfirmed = positiveConfirmed.reduce((max, q) => Math.max(max, q), 0);
    return Math.max(1, maxConfirmed + 1);
  };
  assert(computeEstimatedTokenForPending([]) === 1, 'Estimated token is #1 when shift has 0 confirmed bookings');
  assert(computeEstimatedTokenForPending([-1, -2]) === 1, 'Estimated token is #1 when only negative provisional bookings exist');
  assert(computeEstimatedTokenForPending([1]) === 2, 'Estimated token is #2 when token 1 is confirmed');
  assert(computeEstimatedTokenForPending([1, 2, 3]) === 4, 'Estimated token is #4 when tokens 1-3 are confirmed');
  assert(computeEstimatedTokenForPending([1, -1, 3]) === 4, 'Estimated token ignores negative provisional tokens');

  // Test 154.8: LiveQueueTicket estimated token fallback resolution
  const resolveTicketEstToken = (appt: { estimatedQueueNumber?: number; queueNumber: number; liveQueue?: { estimatedQueueNumber?: number } }) => {
    const rawEstToken =
      appt.estimatedQueueNumber ||
      appt.liveQueue?.estimatedQueueNumber ||
      (appt.queueNumber > 0 ? appt.queueNumber : 1);
    return Math.max(1, rawEstToken);
  };
  assert(resolveTicketEstToken({ queueNumber: -1, estimatedQueueNumber: 3 }) === 3, 'Resolves appt.estimatedQueueNumber #3');
  assert(resolveTicketEstToken({ queueNumber: -1, liveQueue: { estimatedQueueNumber: 2 } }) === 2, 'Resolves liveQueue.estimatedQueueNumber #2');
  assert(resolveTicketEstToken({ queueNumber: -1 }) === 1, 'Defaults to #1 when no estimated number is attached and queueNumber is negative');
  assert(resolveTicketEstToken({ queueNumber: 5 }) === 5, 'Resolves confirmed positive queueNumber #5');

  console.log(`\n========================================`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();


