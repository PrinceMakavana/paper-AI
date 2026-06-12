import { validatePdfFile } from './pageIndexController.js';
import { assertUserHasTokens } from '../helpers/userTokenHelpers.js';
import {
    assertUserHasPages,
    consumeUserPages,
    refundUserPages,
} from '../helpers/userPageHelpers.js';
import { encryptSecret } from '../utils/secretEncryption.js';
import { provisionMailTmInbox } from '../utils/provisionMailTmInbox.js';
import { JOB_STATUS } from '../utils/pageindexHostedJobConstants.js';
import {
    createHostedJob,
    getHostedJobByIdForUser,
    listHostedJobsForUser,
    mapJobForClient,
} from '../helpers/pageIndexHostedJobHelpers.js';
import { enqueueHostedJob } from '../services/pageindexHosted/jobRunner.js';
import { createHostedUploadJob } from '../services/pageindexHosted/createUploadJob.js';
import { logHostedJobEvent } from '../utils/hostedJobLogger.js';

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

            const { address: sourceEmail, password: mailTmPassword } = await provisionMailTmInbox(email);
            logHostedJobEvent('INFO', {
                step: 'api',
                message: 'POST /paperai/hosted-jobs with file',
                meta: { userId: req.user.userId, sourceEmail, fileName: uploadedFile.originalname, pageCount },
            });

            let job;
            let documentId;
            try {
                ({ job, documentId } = await createHostedUploadJob({
                    user_id: req.user.userId,
                    file: uploadedFile,
                    source_email: sourceEmail,
                    mailtm_password_enc: encryptSecret(mailTmPassword),
                    page_credits_charged: pageCount,
                }));
            } catch (enqueueError) {
                await refundUserPages(req.user.userId, pageCount);
                throw enqueueError;
            }

            return res.status(202).json({
                message: 'Hosted upload job created.',
                job: mapJobForClient(job),
                documentId,
            });
        }

        const { address: sourceEmail, password: mailTmPassword } = await provisionMailTmInbox(email);
        const job = await createHostedJob({
            user_id: req.user.userId,
            source_email: sourceEmail,
            mailtm_password_enc: encryptSecret(mailTmPassword),
            has_file: false,
        });

        logHostedJobEvent('SUCCESS', {
            jobId: job._id.toString(),
            step: 'api',
            message: 'POST /paperai/hosted-jobs without file',
            meta: { userId: req.user.userId, sourceEmail },
        });

        enqueueHostedJob(job._id.toString());

        return res.status(202).json({
            message: 'Hosted upload job created.',
            job: mapJobForClient(job),
        });
    } catch (error) {
        logHostedJobEvent('ERROR', {
            step: 'api',
            message: 'Failed to create hosted upload job',
            error,
            meta: { userId: req.user?.userId },
        });
        const status = error.statusCode || 500;
        return res.status(status).json({
            message: error.message || 'Failed to create hosted upload job.',
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
            message: error.message || 'Failed to fetch hosted upload job.',
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
            message: error.message || 'Failed to list hosted upload jobs.',
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
            message: 'Hosted upload job retry enqueued.',
            job: mapJobForClient(job),
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            message: error.message || 'Failed to retry hosted upload job.',
        });
    }
}

export {
    createJob,
    getJob,
    listJobs,
    retryJob,
};
