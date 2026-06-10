const { validatePdfFile } = require('./pageIndexController');
const { assertUserHasTokens } = require('../helpers/userTokenHelpers');
const {
    assertUserHasPages,
    consumeUserPages,
    refundUserPages,
} = require('../helpers/userPageHelpers');
const { generateDummySourceEmail } = require('../utils/generateDummyEmail');
const { JOB_STATUS } = require('../utils/pageindexHostedJobConstants');
const {
    createHostedJob,
    getHostedJobByIdForUser,
    listHostedJobsForUser,
    mapJobForClient,
} = require('../helpers/pageIndexHostedJobHelpers');
const { enqueueHostedJob } = require('../services/pageindexHosted/jobRunner');
const { createHostedUploadJob } = require('../services/pageindexHosted/createUploadJob');
const { logHostedJobEvent } = require('../utils/hostedJobLogger');

async function createJob(req, res) {
    try {
        const { email } = req.body;
        const uploadedFile = req.file ?? null;

        if (!email && !uploadedFile) {
            return res.status(400).json({ message: 'Email is required when no file is uploaded.' });
        }

        if (uploadedFile) {
            const validation = await validatePdfFile(uploadedFile);
            if (!validation.success) {
                return res.status(400).json({ message: validation.message });
            }

            const pageCount = validation.pageCount;
            await assertUserHasTokens(req.user.userId);
            await assertUserHasPages(req.user.userId, pageCount);
            await consumeUserPages(req.user.userId, pageCount);

            const sourceEmail = email || generateDummySourceEmail();
            logHostedJobEvent('INFO', {
                step: 'api',
                message: 'POST /pageindex/hosted-jobs with file',
                meta: { userId: req.user.userId, sourceEmail, fileName: uploadedFile.originalname, pageCount },
            });

            let job;
            let documentId;
            try {
                ({ job, documentId } = await createHostedUploadJob({
                    user_id: req.user.userId,
                    file: uploadedFile,
                    source_email: sourceEmail,
                    page_credits_charged: pageCount,
                }));
            } catch (enqueueError) {
                await refundUserPages(req.user.userId, pageCount);
                throw enqueueError;
            }

            return res.status(202).json({
                message: 'Hosted PageIndex job created.',
                job: mapJobForClient(job),
                documentId,
            });
        }

        const sourceEmail = email || generateDummySourceEmail();
        const job = await createHostedJob({
            user_id: req.user.userId,
            source_email: sourceEmail,
            has_file: false,
        });

        logHostedJobEvent('SUCCESS', {
            jobId: job._id.toString(),
            step: 'api',
            message: 'POST /pageindex/hosted-jobs without file',
            meta: { userId: req.user.userId, sourceEmail },
        });

        enqueueHostedJob(job._id.toString());

        return res.status(202).json({
            message: 'Hosted PageIndex job created.',
            job: mapJobForClient(job),
        });
    } catch (error) {
        logHostedJobEvent('ERROR', {
            step: 'api',
            message: 'Failed to create hosted PageIndex job',
            error,
            meta: { userId: req.user?.userId },
        });
        const status = error.statusCode || 500;
        return res.status(status).json({
            message: error.message || 'Failed to create hosted PageIndex job.',
        });
    }
}

async function getJob(req, res) {
    try {
        const job = await getHostedJobByIdForUser({
            job_id: req.params.jobId,
            user_id: req.user.userId,
        });

        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        return res.status(200).json({ job: mapJobForClient(job) });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            message: error.message || 'Failed to fetch hosted PageIndex job.',
        });
    }
}

async function listJobs(req, res) {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
        const skip = parseInt(req.query.skip, 10) || 0;
        const { jobs, total } = await listHostedJobsForUser({
            user_id: req.user.userId,
            limit,
            skip,
        });

        return res.status(200).json({
            jobs: jobs.map(mapJobForClient),
            total,
            limit,
            skip,
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            message: error.message || 'Failed to list hosted PageIndex jobs.',
        });
    }
}

async function retryJob(req, res) {
    try {
        const job = await getHostedJobByIdForUser({
            job_id: req.params.jobId,
            user_id: req.user.userId,
        });

        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        if (![JOB_STATUS.FAILED, JOB_STATUS.RETRY_SCHEDULED].includes(job.job_status)) {
            return res.status(400).json({
                message: 'Only failed or retry-scheduled jobs can be manually retried.',
            });
        }

        job.job_status = JOB_STATUS.PENDING;
        job.next_retry_at = null;
        await job.save();

        logHostedJobEvent('INFO', {
            jobId: job._id.toString(),
            step: 'api',
            message: 'Manual job retry requested',
            meta: { userId: req.user.userId },
        });

        enqueueHostedJob(job._id.toString());

        return res.status(202).json({
            message: 'Hosted PageIndex job retry enqueued.',
            job: mapJobForClient(job),
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            message: error.message || 'Failed to retry hosted PageIndex job.',
        });
    }
}

module.exports = {
    createJob,
    getJob,
    listJobs,
    retryJob,
};
