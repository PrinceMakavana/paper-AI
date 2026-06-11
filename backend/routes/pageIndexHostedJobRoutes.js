import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/authMiddleware.js';
import * as pageIndexHostedJobController from '../controllers/pageIndexHostedJobController.js';
import { registerRoutes } from '../utils/registerApiRoutes.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

registerRoutes(
    router,
    'post',
    '/hosted-jobs',
    authMiddleware,
    upload.single('file'),
    pageIndexHostedJobController.createJob,
);
registerRoutes(router, 'get', '/hosted-jobs', authMiddleware, pageIndexHostedJobController.listJobs);
registerRoutes(router, 'get', '/hosted-jobs/:jobId', authMiddleware, pageIndexHostedJobController.getJob);
registerRoutes(router, 'post', '/hosted-jobs/:jobId/retry', authMiddleware, pageIndexHostedJobController.retryJob);

export default router;
