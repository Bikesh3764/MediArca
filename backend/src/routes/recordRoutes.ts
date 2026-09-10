import { Router } from 'express';
import { uploadRecord, getPatientRecords, deleteRecord } from '../controllers/recordController';
import { authenticate } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('file'), uploadRecord);
router.get('/', getPatientRecords);
router.delete('/:id', deleteRecord);

export default router;
