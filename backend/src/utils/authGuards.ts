import prisma from '../config/database';

export interface DoctorEligibility {
  eligible: boolean;
  reason?: string;
}

export interface ClinicEligibility {
  active: boolean;
  reason?: string;
}

export interface ReceptionistAccessResult {
  authorized: boolean;
  reason?: string;
  receptionist?: any;
  assignment?: any;
  clinic?: any;
}

/**
 * Validates that a doctor is active, verified by administration, and not suspended or rejected.
 * Enforces canonical practitioner eligibility across booking, consultation, and queue operations (Finding H4, M10).
 */
export const isDoctorEligibleForClinicalPractice = (
  doctor: { isVerified?: boolean; verificationStatus?: string } | null | undefined
): DoctorEligibility => {
  if (!doctor) {
    return { eligible: false, reason: 'Doctor profile not found' };
  }

  if (!doctor.isVerified || doctor.verificationStatus !== 'VERIFIED') {
    if (doctor.verificationStatus === 'SUSPENDED') {
      return {
        eligible: false,
        reason: 'Practitioner account is currently suspended from clinical practice.',
      };
    }
    if (doctor.verificationStatus === 'REJECTED') {
      return {
        eligible: false,
        reason: 'Practitioner registration has been declined by administration.',
      };
    }
    return {
      eligible: false,
      reason: 'Practitioner account is pending administrative verification.',
    };
  }

  return { eligible: true };
};

/**
 * Validates that a clinic is active, verified, and not suspended (Finding M6).
 */
export const isClinicActive = (
  clinic: { isVerified?: boolean; verificationStatus?: string } | null | undefined
): ClinicEligibility => {
  if (!clinic) {
    return { active: false, reason: 'Clinic profile not found' };
  }

  if (!clinic.isVerified || clinic.verificationStatus !== 'VERIFIED') {
    if (clinic.verificationStatus === 'SUSPENDED') {
      return {
        active: false,
        reason: 'Clinic facility is currently suspended by administration.',
      };
    }
    if (clinic.verificationStatus === 'REJECTED') {
      return {
        active: false,
        reason: 'Clinic facility registration has been rejected by administration.',
      };
    }
    return {
      active: false,
      reason: 'Clinic facility is pending administrative verification.',
    };
  }

  return { active: true };
};

/**
 * Centralized authorization helper for receptionist operations (Finding H4, H5, M7).
 * Verifies:
 * 1. Receptionist profile exists and is strictly ACTIVE.
 * 2. Receptionist-doctor assignment exists and is strictly ACTIVE.
 * 3. Doctor is verified and eligible.
 * 4. Clinic facility is verified and active.
 * 5. Clinic-doctor affiliation is ACTIVE or ACCEPTED.
 * 6. Appointment/request clinic matches receptionist facility.
 */
export const verifyReceptionistDoctorAccess = async (
  receptionistUserId: string,
  doctorId: string,
  clinicId?: string | null
): Promise<ReceptionistAccessResult> => {
  // 1. Receptionist profile check
  const receptionist = await prisma.receptionistProfile.findUnique({
    where: { userId: receptionistUserId },
  });

  if (!receptionist) {
    return { authorized: false, reason: 'Receptionist profile not found' };
  }

  if (receptionist.status !== 'ACTIVE') {
    return {
      authorized: false,
      reason:
        receptionist.status === 'REJECTED'
          ? 'Your receptionist application has been declined by clinic administration.'
          : 'Your receptionist application is pending approval by clinic administration.',
    };
  }

  // 2. Doctor eligibility check
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
  });

  const docCheck = isDoctorEligibleForClinicalPractice(doctor);
  if (!docCheck.eligible) {
    return { authorized: false, reason: docCheck.reason };
  }

  // 3. Receptionist-Doctor assignment check
  const assignment = await prisma.doctorReceptionist.findUnique({
    where: {
      doctorId_receptionistId: {
        doctorId,
        receptionistId: receptionist.id,
      },
    },
  });

  if (!assignment) {
    // Fallback: Only if receptionist has NO explicit active doctor assignments (general clinic desk staff)
    // and belongs to the target clinic where this doctor has an active affiliation
    if (receptionist.clinicId) {
      if (clinicId && receptionist.clinicId !== clinicId) {
        return {
          authorized: false,
          reason: 'Access denied: Requested appointment or operation belongs to a different clinic facility.',
        };
      }

      const activeAssignedCount =
        typeof prisma.doctorReceptionist?.count === 'function'
          ? await prisma.doctorReceptionist.count({
              where: {
                receptionistId: receptionist.id,
                status: 'ACTIVE',
              },
            })
          : 0;

      if (activeAssignedCount === 0) {
        const clinicAffiliation = await prisma.clinicDoctor.findUnique({
          where: {
            clinicId_doctorId: {
              clinicId: receptionist.clinicId,
              doctorId,
            },
          },
        });
        if (clinicAffiliation && (clinicAffiliation.status === 'ACTIVE' || clinicAffiliation.status === 'ACCEPTED')) {
          const clinic = await prisma.clinicProfile.findUnique({
            where: { id: receptionist.clinicId },
          });
          const clinicCheck = isClinicActive(clinic);
          if (!clinicCheck.active) {
            return { authorized: false, reason: clinicCheck.reason };
          }
          return {
            authorized: true,
            receptionist,
            assignment: {
              id: 'clinic-affiliation',
              doctorId,
              receptionistId: receptionist.id,
              status: 'ACTIVE',
            } as any,
            clinic,
          };
        }
      }
    }
    return {
      authorized: false,
      reason: 'Access denied: You are not assigned to manage this doctor.',
    };
  }

  if (assignment.status !== 'ACTIVE') {
    return {
      authorized: false,
      reason: 'Access denied: Your assignment to this doctor is inactive or revoked.',
    };
  }

  // 4. Clinic affiliation check
  let clinic = null;
  if (clinicId && receptionist.clinicId !== clinicId) {
    return {
      authorized: false,
      reason: 'Access denied: Requested appointment or operation belongs to a different clinic facility.',
    };
  }

  if (receptionist.clinicId) {
    clinic = await prisma.clinicProfile.findUnique({
      where: { id: receptionist.clinicId },
    });

    const clinicCheck = isClinicActive(clinic);
    if (!clinicCheck.active) {
      return { authorized: false, reason: clinicCheck.reason };
    }

    const affiliation = await prisma.clinicDoctor.findUnique({
      where: {
        clinicId_doctorId: {
          clinicId: receptionist.clinicId,
          doctorId,
        },
      },
    });

    if (!affiliation || (affiliation.status !== 'ACTIVE' && affiliation.status !== 'ACCEPTED')) {
      return {
        authorized: false,
        reason: 'Access denied: Practitioner is not currently actively affiliated with your clinic facility.',
      };
    }
  }

  return {
    authorized: true,
    receptionist,
    assignment,
    clinic,
  };
};
