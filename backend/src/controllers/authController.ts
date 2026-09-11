import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';

const JWT_SECRET = process.env.JWT_SECRET || 'mediarca-fallback-jwt-secret';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, phone, role = 'PATIENT', ...profileData } = req.body;

    if (!email || !password || !fullName) {
      res.status(400).json({ success: false, message: 'Email, password, and full name are required' });
      return;
    }

    const normalizedRole = role.toUpperCase();
    if (!['PATIENT', 'DOCTOR', 'CLINIC', 'RECEPTIONIST'].includes(normalizedRole)) {
      res.status(400).json({ success: false, message: 'Invalid role. Must be PATIENT, DOCTOR, CLINIC, or RECEPTIONIST' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      res.status(400).json({ success: false, message: 'An account with this email already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let newUser;
    if (normalizedRole === 'PATIENT') {
      newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName,
          phone,
          role: 'PATIENT',
          patientProfile: {
            create: {
              dateOfBirth: profileData.dateOfBirth || null,
              gender: profileData.gender || null,
              bloodGroup: profileData.bloodGroup || null,
              allergies: profileData.allergies || null,
              existingConditions: profileData.existingConditions || null,
            },
          },
        },
        include: { patientProfile: true },
      });
    } else if (normalizedRole === 'DOCTOR') {
      newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName,
          phone,
          role: 'DOCTOR',
          doctorProfile: {
            create: {
              specialty: profileData.specialty || 'General Physician',
              qualifications: profileData.qualifications || 'MBBS',
              experienceYears: Number(profileData.experienceYears) || 1,
              consultationFee: Number(profileData.consultationFee) || 50.0,
              bio: profileData.bio || 'Dedicated healthcare practitioner.',
              clinicAddress: profileData.clinicAddress || 'MediArca Clinic Center',
              isVerified: false, // Requires admin approval
              checkingStartTime: profileData.checkingStartTime || '09:00',
              checkingEndTime: profileData.checkingEndTime || '13:00',
              avgConsultationMinutes: Number(profileData.avgConsultationMinutes) || 15,
            },
          },
        },
        include: { doctorProfile: true },
      });
    } else if (normalizedRole === 'CLINIC') {
      newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName: profileData.clinicName || fullName,
          phone: phone || profileData.phone || null,
          role: 'CLINIC',
          clinicProfile: {
            create: {
              clinicName: profileData.clinicName || fullName,
              address: profileData.address || profileData.clinicAddress || 'Central Healthcare Clinic',
              city: profileData.city || null,
              phone: phone || profileData.phone || null,
            },
          },
        },
        include: { clinicProfile: true },
      });
    } else {
      // RECEPTIONIST
      newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName,
          phone: phone || null,
          role: 'RECEPTIONIST',
          receptionistProfile: {
            create: {
              phone: phone || null,
            },
          },
        },
        include: { receptionistProfile: true },
      });
    }

    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        fullName: newUser.fullName,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, ...userWithoutPassword } = newUser;
    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during registration', error: error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        patientProfile: true,
        doctorProfile: {
          include: {
            clinics: { include: { clinic: true } },
            receptionists: {
              include: {
                receptionist: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
        },
        clinicProfile: {
          include: {
            doctors: {
              include: {
                doctor: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
        },
        receptionistProfile: {
          include: {
            doctors: {
              include: {
                doctor: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      message: 'Logged in successfully',
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during login', error: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        patientProfile: true,
        doctorProfile: {
          include: {
            clinics: { include: { clinic: true } },
            receptionists: {
              include: {
                receptionist: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
        },
        clinicProfile: {
          include: {
            doctors: {
              include: {
                doctor: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
        },
        receptionistProfile: {
          include: {
            doctors: {
              include: {
                doctor: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({ success: true, data: userWithoutPassword });
  } catch (error: any) {
    console.error('getMe error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving user profile', error: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { fullName, phone, avatarUrl, ...roleSpecificData } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(fullName && { fullName }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl && { avatarUrl }),
      },
    });

    if (req.user.role === 'PATIENT') {
      await prisma.patientProfile.upsert({
        where: { userId: req.user.id },
        update: roleSpecificData,
        create: {
          userId: req.user.id,
          ...roleSpecificData,
        },
      });
    } else if (req.user.role === 'DOCTOR') {
      await prisma.doctorProfile.upsert({
        where: { userId: req.user.id },
        update: roleSpecificData,
        create: {
          userId: req.user.id,
          specialty: roleSpecificData.specialty || 'General Physician',
          qualifications: roleSpecificData.qualifications || 'MBBS',
          ...roleSpecificData,
        },
      });
    }

    const refreshedUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { patientProfile: true, doctorProfile: true },
    });

    const { passwordHash: _, ...result } = refreshedUser!;
    res.json({ success: true, message: 'Profile updated successfully', data: result });
  } catch (error: any) {
    console.error('updateProfile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
};

export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential, role = 'PATIENT' } = req.body;
    if (!credential) {
      res.status(400).json({ success: false, message: 'Google credential token is required' });
      return;
    }

    let payload: any;
    try {
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id') {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } else {
        payload = jwt.decode(credential);
      }
    } catch (e: any) {
      payload = jwt.decode(credential);
    }

    if (!payload || !payload.email) {
      try {
        const parts = credential.split('.');
        if (parts.length >= 2) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
          payload = JSON.parse(jsonStr);
        } else {
          payload = JSON.parse(credential);
        }
      } catch (err) {}
    }

    if (!payload || !payload.email) {
      res.status(400).json({ success: false, message: 'Unable to extract email from Google credential' });
      return;
    }

    const email = payload.email.toLowerCase().trim();
    const fullName = payload.name || email.split('@')[0];
    const avatarUrl = payload.picture || null;
    const normalizedRole = role.toUpperCase() === 'DOCTOR' ? 'DOCTOR' : 'PATIENT';

    let user = await prisma.user.findUnique({
      where: { email },
      include: { patientProfile: true, doctorProfile: true },
    });

    if (!user) {
      const defaultPassword = await bcrypt.hash(Math.random().toString(36).substring(2), 10);
      if (normalizedRole === 'PATIENT') {
        user = await prisma.user.create({
          data: {
            email,
            passwordHash: defaultPassword,
            fullName,
            avatarUrl,
            role: 'PATIENT',
            patientProfile: { create: {} },
          },
          include: { patientProfile: true, doctorProfile: true },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email,
            passwordHash: defaultPassword,
            fullName,
            avatarUrl,
            role: 'DOCTOR',
            doctorProfile: {
              create: {
                specialty: 'General Medicine',
                qualifications: 'Medical Practitioner',
                isVerified: false,
                checkingStartTime: '09:00',
                checkingEndTime: '13:00',
              },
            },
          },
          include: { patientProfile: true, doctorProfile: true },
        });
      }
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(avatarUrl && !user.avatarUrl ? { avatarUrl } : {}),
        },
        include: { patientProfile: true, doctorProfile: true },
      });

      if (user.role === 'PATIENT' && !user.patientProfile) {
        await prisma.patientProfile.create({ data: { userId: user.id } });
      } else if (user.role === 'DOCTOR' && !user.doctorProfile) {
        await prisma.doctorProfile.create({
          data: {
            userId: user.id,
            specialty: 'General Medicine',
            qualifications: 'Medical Practitioner',
            isVerified: false,
            checkingStartTime: '09:00',
            checkingEndTime: '13:00',
          },
        });
      }

      user = (await prisma.user.findUnique({
        where: { id: user.id },
        include: { patientProfile: true, doctorProfile: true },
      })) as any;
    }

    if (!user) {
      res.status(500).json({ success: false, message: 'Failed to establish user account session' });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error: any) {
    console.error('Google auth error:', error);
    res.status(500).json({ success: false, message: 'Google authentication failed', error: error.message });
  }
};

