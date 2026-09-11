import { Router } from 'express';
import { uploadRecord, getPatientRecords, deleteRecord } from '../controllers/recordController';
import { authenticate } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = Router();

router.use(authenticate);

router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: 'File size exceeds 1 MB limit. Please upload a document under 1 MB.',
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: err.message || 'Error uploading file',
      });
      return;
    }
    next();
  });
}, uploadRecord);
router.get('/', getPatientRecords);
router.delete('/:id', deleteRecord);

export default router;
