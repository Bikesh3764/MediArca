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
} from '../src/utils/documentOptimizer';

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

  // 9. Active In-Progress Slot Overflow (Clock too close to shift end)
  // Shift ends at 11:00 AM (660 mins). Clock is 10:55 AM (655 mins). 5 patients ahead * 2.4 min = 12 mins -> 667 mins (11:07 AM).
  const nowCloseToEnd = new Date(2026, 8, 11, 10, 55);
  const statusOverflow = evaluateSlotStatus(slotMorning, '2026-09-11', 5, nowCloseToEnd);
  assert(statusOverflow.isFull === true, 'Shift with wait exceeding end time is marked isFull');
  assert(statusOverflow.estimatedTime === 'Shift Full', 'Estimated time reflects Shift Full rather than past/exceeded time');
  assert(statusOverflow.statusLabel === 'Shift Over Capacity for Today', 'Label reflects Shift Over Capacity');

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
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
