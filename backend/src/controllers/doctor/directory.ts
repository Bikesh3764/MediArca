import { Request, Response } from 'express';
import prisma from '../../config/database';
import { parseDoctorSlots, parseDoctorWorkingDays, parseDoctorLeaves } from '../../utils/scheduleUtils';
import { parsePaginationParams, buildPaginationMetadata } from '../../utils/pagination';

export const formatDoctorClinics = (doc: any) => {
  return (doc.clinics || []).map((cd: any) => {
    let clinicSlots = parseDoctorSlots(doc);
    if (cd.slots) {
      try {
        const parsed = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
        if (Array.isArray(parsed) && parsed.length > 0) {
          clinicSlots = parsed;
        }
      } catch {}
    }
    const activeReceptionists = (cd.clinic?.receptionists || []).filter((r: any) => {
      if (r.status && r.status !== 'ACTIVE') return false;
      const activeDocs = (r.doctors || []).filter((d: any) => d.status === 'ACTIVE' || !d.status);
      if (activeDocs.length === 0) return true;
      return activeDocs.some((d: any) => d.doctorId === doc.id);
    });

    const receptionists = activeReceptionists.map((r: any) => ({
      id: r.id,
      name: r.user?.fullName || 'Reception Desk',
    }));

    // Exclude raw clinic.receptionists and physical check-in security code from public clinic projection (FIX-006, SEC-001)
    const { receptionists: _clinicRecs, checkinCode: _secretCode, user: _clinicUser, ...cleanClinic } = cd.clinic || {};
    const clinicAvatar = (cd.clinic as any)?.user?.avatarUrl || (cd.clinic as any)?.avatarUrl || null;
    const workingDays = cd.workingDays ? parseDoctorWorkingDays(cd.workingDays) : parseDoctorWorkingDays(doc.workingDays);
    const leaves = [
      ...parseDoctorLeaves(doc.leaves),
      ...(cd.leaves ? parseDoctorLeaves(cd.leaves) : []),
    ];

    return {
      ...cd,
      clinic: {
        ...cleanClinic,
        avatarUrl: clinicAvatar,
      },
      consultationFee: cd.consultationFee ?? doc.consultationFee,
      slots: clinicSlots,
      workingDays,
      leaves,
      receptionists,
      hasReceptionist: receptionists.length > 0,
    };
  });
};

export const getDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, specialty, minExp, maxFee, sortBy, clinicOnly, clinicId, state, city } = req.query;

    const whereClause: any = {
      isVerified: true,
      verificationStatus: 'VERIFIED',
    };

    if (clinicOnly === 'true' || clinicId) {
      whereClause.clinics = {
        some: {
          ...(clinicId ? { clinicId: String(clinicId) } : {}),
          status: { in: ['ACTIVE', 'ACCEPTED'] },
          clinic: { isVerified: true, verificationStatus: 'VERIFIED' },
        },
      };
    }

    if (state && typeof state === 'string' && state.trim() && state !== 'All') {
      const stateTrimmed = state.trim();
      whereClause.clinics = {
        some: {
          ...(whereClause.clinics?.some || {}),
          status: { in: ['ACTIVE', 'ACCEPTED'] },
          clinic: {
            ...(whereClause.clinics?.some?.clinic || {}),
            isVerified: true,
            verificationStatus: 'VERIFIED',
            state: { equals: stateTrimmed, mode: 'insensitive' },
          },
        },
      };
    }

    if (city && typeof city === 'string' && city.trim() && city !== 'All') {
      const cityTrimmed = city.trim();
      whereClause.clinics = {
        some: {
          ...(whereClause.clinics?.some || {}),
          status: { in: ['ACTIVE', 'ACCEPTED'] },
          clinic: {
            ...(whereClause.clinics?.some?.clinic || {}),
            isVerified: true,
            verificationStatus: 'VERIFIED',
            city: { equals: cityTrimmed, mode: 'insensitive' },
          },
        },
      };
    }

    if (specialty && typeof specialty === 'string' && specialty !== 'All') {
      whereClause.specialty = { equals: specialty, mode: 'insensitive' };
    }

    if (minExp) {
      whereClause.experienceYears = { gte: Number(minExp) };
    }

    if (maxFee) {
      whereClause.consultationFee = { lte: Number(maxFee) };
    }

    if (search && typeof search === 'string') {
      whereClause.OR = [
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { specialty: { contains: search, mode: 'insensitive' } },
        { clinicAddress: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } },
        {
          clinics: {
            some: {
              clinic: {
                OR: [
                  { clinicName: { contains: search, mode: 'insensitive' } },
                  { address: { contains: search, mode: 'insensitive' } },
                  { city: { contains: search, mode: 'insensitive' } },
                  { state: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    let orderBy: any[] = [{ experienceYears: 'desc' }, { id: 'asc' }];
    if (sortBy === 'fee_low') orderBy = [{ consultationFee: 'asc' }, { id: 'asc' }];
    if (sortBy === 'fee_high') orderBy = [{ consultationFee: 'desc' }, { id: 'asc' }];
    if (sortBy === 'experience') orderBy = [{ experienceYears: 'desc' }, { id: 'asc' }];

    const { page, limit, skip } = parsePaginationParams(req.query, 20, 50);

    const [total, doctors] = await prisma.$transaction([
      prisma.doctorProfile.count({ where: whereClause }),
      prisma.doctorProfile.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          clinics: {
            where: { clinic: { isVerified: true, verificationStatus: 'VERIFIED' }, status: { in: ['ACTIVE', 'ACCEPTED'] } },
            include: {
              clinic: {
                include: {
                  user: {
                    select: {
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const enrichedDoctors = doctors.map((doc) => ({
      ...doc,
      slots: parseDoctorSlots(doc),
      clinics: formatDoctorClinics(doc),
    }));

    res.json({
      success: true,
      count: enrichedDoctors.length,
      data: enrichedDoctors,
      pagination: buildPaginationMetadata(total, page, limit),
    });
  } catch (error: any) {
    console.error('getDoctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctors',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const getDoctorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const doctorInclude = {
      user: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      clinics: {
        where: { clinic: { isVerified: true, verificationStatus: 'VERIFIED' }, status: { in: ['ACTIVE', 'ACCEPTED'] } },
        include: {
          clinic: {
            include: {
              user: {
                select: {
                  avatarUrl: true,
                },
              },
              receptionists: {
                where: { status: 'ACTIVE' },
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                    },
                  },
                  doctors: {
                    select: {
                      doctorId: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      receptionists: {
        where: { status: 'ACTIVE' },
        include: {
          receptionist: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              clinic: {
                select: {
                  id: true,
                  clinicName: true,
                  phone: true,
                },
              },
            },
          },
        },
      },
    };

    let doctor = await prisma.doctorProfile.findUnique({
      where: { id },
      include: doctorInclude,
    });

    if (!doctor) {
      doctor = await prisma.doctorProfile.findUnique({
        where: { userId: id },
        include: doctorInclude,
      });
    }

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    const isOwner = (req as any).user?.role === 'DOCTOR' && doctor.userId === (req as any).user?.id;
    const isAdmin = (req as any).user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      if (!doctor.isVerified || doctor.verificationStatus !== 'VERIFIED') {
        res.status(404).json({
          success: false,
          message: 'Doctor profile is not publicly available or pending verification',
        });
        return;
      }
    }

    // Exclude personal phone numbers from public receptionist staff projection (FIX-006)
    const doctorReceptionists = (doctor.receptionists || [])
      .filter((dr: any) => dr.status === 'ACTIVE' || !dr.status)
      .map((dr: any) => ({
        id: dr.receptionist?.id,
        name: dr.receptionist?.user?.fullName || 'Reception Desk',
        clinicId: dr.receptionist?.clinicId,
        clinicName: dr.receptionist?.clinic?.clinicName,
      }));

    // Exclude raw relational receptionists from root spread to prevent data leakage (FIX-006)
    const { receptionists: _rawDocRecs, ...doctorClean } = doctor;

    res.json({
      success: true,
      data: {
        ...doctorClean,
        slots: parseDoctorSlots(doctor),
        clinics: formatDoctorClinics(doctor),
        receptionists: doctorReceptionists,
      },
    });
  } catch (error: any) {
    console.error('getDoctorById error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor details',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
