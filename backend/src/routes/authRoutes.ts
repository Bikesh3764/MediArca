import { Router } from 'express';
import { register, login, getMe, updateProfile, googleAuth } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);

export default router;
