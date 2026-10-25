import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { isValidIndianPhone, formatIndianPhone, sanitizeIndianPhone, findExistingAccountByPhone } from '../../utils/phoneUtils';

/**
 * Provision / Create a Receptionist account for this Clinic
 */
export const addClinicReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const { fullName, email, password, phone, doctorIds = [] } = req.body;

    if (!fullName || !email || !password || typeof fullName !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ success: false, message: 'Receptionist name, email, and password are required and must be valid strings' });
      return;
    }

    if (password.trim().length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        doctors: {
          where: { status: { in: ['ACTIVE', 'ACCEPTED'] } },
        },
      },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    if (!clinic.isVerified || clinic.verificationStatus === 'SUSPENDED') {
      res.status(403).json({
        success: false,
        message: 'Your clinic facility is pending administrative verification or is suspended. Staff provisioning is disabled.',
      });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: {
        email_role: {
          email: cleanEmail,
          role: 'RECEPTIONIST',
        },
      },
    });

    let existingRecProfile: any = (existingUser as any)?.receptionistProfile || null;
    if (existingUser && !existingRecProfile && typeof (prisma.receptionistProfile as any)?.findUnique === 'function') {
      existingRecProfile = await prisma.receptionistProfile.findUnique({
        where: { userId: existingUser.id },
      });
    }

    if (existingUser && existingRecProfile?.status !== 'REJECTED') {
      res.status(409).json({ success: false, message: 'A receptionist account with this email already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let formattedPhone: string | null = null;
    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      const trimmedPhone = String(phone).trim();
      const sanitizedDigits = sanitizeIndianPhone(trimmedPhone);
      if (!isValidIndianPhone(trimmedPhone) && (!sanitizedDigits || sanitizedDigits.length !== 10 || !/^[6-9]/.test(sanitizedDigits))) {
        res.status(400).json({
          success: false,
          message: 'Invalid Indian phone number. Please enter a valid 10-digit mobile number (+91).',
        });
        return;
      }
      formattedPhone = formatIndianPhone(trimmedPhone);

      // Note: Mobile number uniqueness is disabled as per specification (uniqueness strictly on email).
      if (false) {
        const existingPhoneUser = await findExistingAccountByPhone(prisma, formattedPhone, {
          role: 'RECEPTIONIST',
          excludeUserId: existingUser?.id,
        });
        if (existingPhoneUser) {
          res.status(409).json({
            success: false,
            message: 'A receptionist account with this mobile number already exists.',
          });
          return;
        }
      }
    }

    // Validate that provided doctorIds belong to this clinic
    const clinicDoctorIds = new Set(clinic.doctors.map((cd) => cd.doctorId));
    const validDoctorIds = (Array.isArray(doctorIds) ? doctorIds : []).filter((id: string) =>
      clinicDoctorIds.has(id)
    );

    const newReceptionist = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            fullName: fullName.trim(),
            passwordHash,
            phone: formattedPhone,
            isEmailVerified: true,
            mustChangePassword: true,
            receptionistProfile: {
              upsert: {
                update: {
                  clinicId: clinic.id,
                  phone: formattedPhone,
                  status: 'ACTIVE',
                  doctors: {
                    deleteMany: {},
                    create: validDoctorIds.map((docId: string) => ({
                      doctorId: docId,
                      status: 'ACTIVE',
                    })),
                  },
                },
                create: {
                  clinicId: clinic.id,
                  phone: formattedPhone,
                  status: 'ACTIVE',
                  doctors: {
                    create: validDoctorIds.map((docId: string) => ({
                      doctorId: docId,
                      status: 'ACTIVE',
                    })),
                  },
                },
              },
            },
          },
          include: {
            receptionistProfile: {
              include: {
                doctors: {
                  include: {
                    doctor: {
                      include: {
                        user: { select: { fullName: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : await prisma.user.create({
          data: {
            fullName: fullName.trim(),
            email: cleanEmail,
            passwordHash,
            phone: formattedPhone,
            role: 'RECEPTIONIST',
            isEmailVerified: true,
            mustChangePassword: true,
            receptionistProfile: {
              create: {
                clinicId: clinic.id,
                phone: formattedPhone,
                status: 'ACTIVE',
                doctors: {
                  create: validDoctorIds.map((docId: string) => ({
                    doctorId: docId,
                    status: 'ACTIVE',
                  })),
                },
              },
            },
          },
          include: {
            receptionistProfile: {
              include: {
                doctors: {
                  include: {
                    doctor: {
                      include: {
                        user: { select: { fullName: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        });

    const { passwordHash: _, ...safeUser } = newReceptionist;
    res.status(201).json({
      success: true,
      message: `Receptionist credentials for ${fullName} created successfully`,
      data: {
        user: safeUser,
        receptionist: {
          id: newReceptionist.receptionistProfile?.id,
          fullName: newReceptionist.fullName,
          email: newReceptionist.email,
          phone: newReceptionist.phone,
          clinicId: clinic.id,
          doctors: newReceptionist.receptionistProfile?.doctors || [],
        },
      },
    });
  } catch (error: any) {
    console.error('addClinicReceptionist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to provision receptionist',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Get all receptionists provisioned by this clinic
 */
export const getClinicReceptionists = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: { doctors: true },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const activeDoctorIds = new Set(clinic.doctors.map((cd) => cd.doctorId));

    const receptionists = await prisma.receptionistProfile.findMany({
      where: { clinicId: clinic.id },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true } },
        doctors: {
          include: {
            doctor: {
              include: {
                user: { select: { fullName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: receptionists.map((r) => {
        const validDoctors = r.doctors.filter((d) => activeDoctorIds.has(d.doctorId));
        return {
          id: r.id,
          userId: r.userId,
          fullName: r.user.fullName,
          email: r.user.email,
          phone: r.phone || r.user.phone || '',
          doctorIds: validDoctors.map((d) => d.doctorId),
          doctors: validDoctors.map((d) => ({
            id: d.doctor.id,
            fullName: d.doctor.user.fullName,
            specialty: d.doctor.specialty,
          })),
          createdAt: r.createdAt,
        };
      }),
    });
  } catch (error: any) {
    console.error('getClinicReceptionists error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve receptionists',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Update doctor assignments for a receptionist
 */
export const updateClinicReceptionistDoctors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const receptionistId = String(req.params.receptionistId);
    const { doctorIds } = req.body;

    if (!Array.isArray(doctorIds)) {
      res.status(400).json({ success: false, message: 'doctorIds must be an array of doctor IDs' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: { doctors: true },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const receptionist = await prisma.receptionistProfile.findFirst({
      where: { id: receptionistId, clinicId: clinic.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist not found at this clinic' });
      return;
    }

    // Filter doctorIds to only those actively affiliated with this clinic (Finding H5)
    const activeClinicDoctorIds = new Set(
      clinic.doctors
        .filter((cd) => cd.status === 'ACTIVE' || cd.status === 'ACCEPTED')
        .map((cd) => cd.doctorId)
    );
    const validDoctorIds = doctorIds.filter((id) => activeClinicDoctorIds.has(id));

    // Transactionally update doctor assignments
    await prisma.$transaction([
      prisma.doctorReceptionist.deleteMany({
        where: { receptionistId: receptionist.id },
      }),
      ...validDoctorIds.map((doctorId) =>
        prisma.doctorReceptionist.create({
          data: {
            doctorId,
            receptionistId: receptionist.id,
            status: 'ACTIVE',
          },
        })
      ),
    ]);

    res.json({
      success: true,
      message: 'Receptionist doctor assignments updated successfully',
      data: { success: true, message: 'Receptionist doctor assignments updated successfully' },
    });
  } catch (error: any) {
    console.error('updateClinicReceptionistDoctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update assignments',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Remove a receptionist from this clinic
 */
export const removeClinicReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const receptionistId = String(req.params.receptionistId);

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const receptionist = await prisma.receptionistProfile.findFirst({
      where: { id: receptionistId, clinicId: clinic.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist not found at this clinic' });
      return;
    }

    // Deleting the user cascades to ReceptionistProfile and DoctorReceptionist
    await prisma.user.delete({
      where: { id: receptionist.userId },
    });

    res.json({
      success: true,
      message: 'Receptionist removed successfully',
    });
  } catch (error: any) {
    console.error('removeClinicReceptionist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove receptionist',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Clinic Admin responds to incoming receptionist application (ACCEPT or REJECT)
 */
export const respondToReceptionistRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const { receptionistId } = req.params;
    const { action, doctorIds } = req.body;

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const receptionist = await prisma.receptionistProfile.findFirst({
      where: { id: String(receptionistId), clinicId: clinic.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist request not found for your clinic' });
      return;
    }

    if (receptionist.status && receptionist.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: `Receptionist application has already been processed (${receptionist.status.toLowerCase()}).`,
      });
      return;
    }

    const normalizedAction = String(action || '').trim().toUpperCase();

    if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
      res.status(400).json({ success: false, message: 'Action must be either ACCEPT or REJECT' });
      return;
    }

    if (normalizedAction === 'ACCEPT') {
      let validDoctorIds: string[] = [];
      if (Array.isArray(doctorIds) && doctorIds.length > 0) {
        // Validate submitted doctor IDs belong to this clinic
        const clinicDoctors = await prisma.clinicDoctor.findMany({
          where: { clinicId: clinic.id, status: { in: ['ACTIVE', 'ACCEPTED'] } },
          select: { doctorId: true },
        });
        const clinicDoctorIds = new Set(clinicDoctors.map((cd) => cd.doctorId));
        validDoctorIds = doctorIds.filter((docId: string) => clinicDoctorIds.has(docId));
      }

      await prisma.$transaction([
        prisma.receptionistProfile.update({
          where: { id: receptionist.id },
          data: { status: 'ACTIVE' },
        }),
        prisma.user.update({
          where: { id: receptionist.userId },
          data: {
            isEmailVerified: true,
            emailVerificationOtp: null,
            emailVerificationOtpExpiresAt: null,
          },
        }),
        ...(validDoctorIds.length > 0
          ? [
              prisma.doctorReceptionist.deleteMany({
                where: { receptionistId: receptionist.id },
              }),
              prisma.doctorReceptionist.createMany({
                data: validDoctorIds.map((docId: string) => ({
                  doctorId: docId,
                  receptionistId: receptionist.id,
                  status: 'ACTIVE',
                })),
              }),
            ]
          : []),
      ]);

      res.json({
        success: true,
        message: 'Receptionist application approved and desk permissions granted.',
      });
    } else {
      await prisma.$transaction([
        prisma.receptionistProfile.update({
          where: { id: receptionist.id },
          data: { status: 'REJECTED' },
        }),
        prisma.doctorReceptionist.deleteMany({
          where: { receptionistId: receptionist.id },
        }),
      ]);

      res.json({
        success: true,
        message: 'Receptionist application declined and desk assignments revoked.',
      });
    }
  } catch (error: any) {
    console.error('respondToReceptionistRequest error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to receptionist request',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
