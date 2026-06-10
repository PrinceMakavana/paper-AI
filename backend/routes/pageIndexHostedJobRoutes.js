const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const pageIndexHostedJobController = require('../controllers/pageIndexHostedJobController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
    '/pageindex/hosted-jobs',
    authMiddleware,
    upload.single('file'),
    pageIndexHostedJobController.createJob,
);

router.get(
    '/pageindex/hosted-jobs',
    authMiddleware,
    pageIndexHostedJobController.listJobs,
);

router.get(
    '/pageindex/hosted-jobs/:jobId',
    authMiddleware,
    pageIndexHostedJobController.getJob,
);

router.post(
    '/pageindex/hosted-jobs/:jobId/retry',
    authMiddleware,
    pageIndexHostedJobController.retryJob,
);

module.exports = router;
