import { Response } from 'express';
import prisma from '../../config/database';
import { parsePaginationParams, buildPaginationMetadata } from '../../utils/pagination';

/**
 * Public listing of verified clinics
 */
export const getPublicClinics = async (req: any, res: Response): Promise<void> => {
  try {
    const { search, city, state } = req.query || {};
    const whereClause: any = {
      isVerified: true,
      verificationStatus: 'VERIFIED',
    };

    if (city && typeof city === 'string' && city.trim() && city !== 'All') {
      whereClause.city = { contains: city.trim(), mode: 'insensitive' };
    }

    if (state && typeof state === 'string' && state.trim() && state !== 'All') {
      whereClause.state = { contains: state.trim(), mode: 'insensitive' };
    }

    if (search && typeof search === 'string' && search.trim()) {
      whereClause.OR = [
        { clinicName: { contains: search.trim(), mode: 'insensitive' } },
        { address: { contains: search.trim(), mode: 'insensitive' } },
        { city: { contains: search.trim(), mode: 'insensitive' } },
        { state: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const { page, limit, skip } = parsePaginationParams(req.query, 20, 50);

    const [total, clinics] = await prisma.$transaction([
      prisma.clinicProfile.count({ where: whereClause }),
      prisma.clinicProfile.findMany({
        where: whereClause,
        select: {
          id: true,
          clinicName: true,
          address: true,
          city: true,
          state: true,
          phone: true,
          isVerified: true,
          user: {
            select: {
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              doctors: {
                where: {
                  status: { in: ['ACTIVE', 'ACCEPTED'] },
                  doctor: { isVerified: true, verificationStatus: 'VERIFIED' },
                },
              },
            },
          },
          doctors: {
            where: {
              status: { in: ['ACTIVE', 'ACCEPTED'] },
              doctor: { isVerified: true, verificationStatus: 'VERIFIED' },
            },
            select: {
              id: true,
              clinicId: true,
              doctorId: true,
              status: true,
              consultationFee: true,
              slots: true,
              doctor: {
                select: {
                  id: true,
                  specialty: true,
                  qualifications: true,
                  experienceYears: true,
                  consultationFee: true,
                  bio: true,
                  clinicAddress: true,
                  isVerified: true,
                  checkingStartTime: true,
                  checkingEndTime: true,
                  avgConsultationMinutes: true,
                  maxDailyPatients: true,
                  slots: true,
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
          receptionists: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              doctors: { select: { doctorId: true, status: true } },
            },
          },
        },
        orderBy: [{ clinicName: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const formattedClinics = clinics.map((c: any) => {
      // Exclude raw receptionist internal records from public response (FIX-006)
      const { receptionists: _receptionists, user, ...cleanClinic } = c;
      return {
        ...cleanClinic,
        avatarUrl: user?.avatarUrl || null,
        hasReceptionist: (c.receptionists || []).length > 0,
        doctors: (c.doctors || []).map((cd: any) => {
          const { doctor, ...cleanCd } = cd;
          const { user, ...cleanDoctor } = doctor || {};
          return {
            ...cleanCd,
            hasReceptionist: (c.receptionists || []).some((r: any) => {
              const activeDocs = (r.doctors || []).filter((d: any) => d.status === 'ACTIVE' || !d.status);
              if (activeDocs.length === 0) return true;
              return activeDocs.some((d: any) => d.doctorId === cd.doctorId);
            }),
            doctor: {
              ...cleanDoctor,
              user: user
                ? {
                    id: user.id,
                    fullName: user.fullName,
                    avatarUrl: user.avatarUrl,
                  }
                : null,
            },
          };
        }),
      };
    });

    res.json({
      success: true,
      count: formattedClinics.length,
      data: formattedClinics,
      pagination: buildPaginationMetadata(total, page, limit),
    });
  } catch (error: any) {
    console.error('getPublicClinics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve clinics',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Public details of a verified clinic by ID
 */
export const getPublicClinicById = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const clinic = await prisma.clinicProfile.findFirst({
      where: {
        id,
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
      select: {
        id: true,
        clinicName: true,
        address: true,
        city: true,
        state: true,
        phone: true,
        isVerified: true,
        user: {
          select: {
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            doctors: {
              where: {
                status: { in: ['ACTIVE', 'ACCEPTED'] },
                doctor: { isVerified: true, verificationStatus: 'VERIFIED' },
              },
            },
          },
        },
        doctors: {
          where: {
            status: { in: ['ACTIVE', 'ACCEPTED'] },
            doctor: { isVerified: true, verificationStatus: 'VERIFIED' },
          },
          select: {
            id: true,
            clinicId: true,
            doctorId: true,
            status: true,
            consultationFee: true,
            slots: true,
            doctor: {
              select: {
                id: true,
                specialty: true,
                qualifications: true,
                experienceYears: true,
                consultationFee: true,
                bio: true,
                clinicAddress: true,
                isVerified: true,
                checkingStartTime: true,
                checkingEndTime: true,
                avgConsultationMinutes: true,
                maxDailyPatients: true,
                slots: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        receptionists: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            doctors: { select: { doctorId: true, status: true } },
          },
        },
      },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic not found or not verified' });
      return;
    }

    // Exclude raw receptionist internal records from public response (FIX-006)
    const { receptionists: _receptionists, user, ...cleanClinic } = clinic;
    const formattedClinic = {
      ...cleanClinic,
      avatarUrl: user?.avatarUrl || null,
      hasReceptionist: (clinic.receptionists || []).length > 0,
      doctors: (clinic.doctors || []).map((cd: any) => {
        const { doctor, ...cleanCd } = cd;
        const { user, ...cleanDoctor } = doctor || {};
        return {
          ...cleanCd,
          hasReceptionist: (clinic.receptionists || []).some((r: any) => {
            const activeDocs = (r.doctors || []).filter((d: any) => d.status === 'ACTIVE' || !d.status);
            if (activeDocs.length === 0) return true;
            return activeDocs.some((d: any) => d.doctorId === cd.doctorId);
          }),
          doctor: {
            ...cleanDoctor,
            user: user
              ? {
                  id: user.id,
                  fullName: user.fullName,
                  avatarUrl: user.avatarUrl,
                }
              : null,
          },
        };
      }),
    };

    res.json({
      success: true,
      data: formattedClinic,
    });
  } catch (error: any) {
    console.error('getPublicClinicById error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve clinic details',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
