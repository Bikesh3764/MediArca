import { Router } from 'express';
import { register, login, getMe, updateProfile, googleAuth, uploadAvatar } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);

// Avatar upload with auto-compression support & 1 MB limit
router.post(
  '/avatar',
  authenticate,
  (req, res, next) => {
    upload.single('avatar')(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            message: 'Avatar file size exceeds 1 MB limit. Client auto-compression reduces photos to < 100 KB.',
          });
          return;
        }
        res.status(400).json({
          success: false,
          message: err.message || 'Error uploading avatar photo',
        });
        return;
      }
      next();
    });
  },
  uploadAvatar
);

export default router;

