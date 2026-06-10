const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const pageIndexHostedJobController = require('../controllers/pageIndexHostedJobController');
const { registerRoutes } = require('../utils/registerApiRoutes');

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

module.exports = router;
