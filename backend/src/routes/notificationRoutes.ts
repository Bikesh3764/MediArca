import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import {
  getMyNotifications,
  markRead,
  markSeenRead,
  markAllRead,
} from '../controllers/notificationController';

const router = Router();

router.get('/', authenticate, getMyNotifications);
router.patch('/read-all', authenticate, markAllRead);
router.patch('/read', authenticate, markSeenRead);
router.patch('/:id/read', authenticate, markRead);

export default router;
