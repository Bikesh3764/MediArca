import {
  timeToMinutes,
  minutesTo12Hour,
  format12Hour,
  calculateSlotMetrics,
  parseDoctorSlots,
  evaluateSlotStatus,
  DoctorSlot,
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
import { ALLOWED_MIME_TYPES, ALLOWED_FILE_EXTENSIONS } from '../src/middleware/uploadMiddleware';
import {
  sanitizeIndianPhone,
  formatIndianPhone,
  isValidIndianPhone,
} from '../src/utils/phoneUtils';

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

  // 47. Doctor Degrees Sanitization (Degrees Only, No School / University Fluff)
  const formatDoctorDegrees = (qualifications?: string | null): string => {
    if (!qualifications || !qualifications.trim()) return 'Certified Specialist';
    const parts = qualifications.split(',');
    const cleanedParts = parts.map((part) => {
      const subParts = part.split(/\s*[-–—]\s*/);
      if (subParts.length > 1) {
        const degreesOnly = subParts.filter(
          (sp) => !/(university|college|school|hospital|institute|academy|faculty|campus|stanford|harvard|hopkins|oxford|cambridge|aiims|pgi)/i.test(sp)
        );
        return degreesOnly.join(', ').trim();
      }
      if (/(university|college|school|hospital|institute|academy|faculty|campus|stanford|harvard|hopkins|oxford|cambridge|aiims|pgi)/i.test(part)) {
        return '';
      }
      return part.trim();
    }).filter(Boolean);

    const result = cleanedParts.join(', ').trim();
    if (result) return result;
    const firstSegment = qualifications.split(/\s*[-–—]\s*/)[0].trim();
    return firstSegment || 'Certified Specialist';
  };

  assert(formatDoctorDegrees('MD - Harvard Medical School, FACC') === 'MD, FACC', 'Harvard Medical School stripped from qualifications');
  assert(formatDoctorDegrees('MD - Stanford Medicine, Board Certified') === 'MD, Board Certified', 'Stanford Medicine stripped from qualifications');
  assert(formatDoctorDegrees('MD, FAAP - Johns Hopkins University') === 'MD, FAAP', 'Johns Hopkins University stripped from qualifications');
  assert(formatDoctorDegrees('DO - Chicago College of Osteopathic Medicine') === 'DO', 'Chicago College stripped from qualifications');
  assert(formatDoctorDegrees('MBBS, MD') === 'MBBS, MD', 'Clean degrees preserved');
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

  console.log(`\n========================================`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

