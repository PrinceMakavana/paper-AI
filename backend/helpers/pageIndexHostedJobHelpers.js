import mongoose from 'mongoose';
import PageIndexHostedJob from '../models/pageIndexHostedJobModel.js';
import {
    JOB_STATUS,
    JOB_STEPS,
    HOSTED_INDEX_STATUS,
    defaultCompletedSteps,
    defaultStepRetries,
} from '../utils/pageindexHostedJobConstants.js';

function ensureMongoConnected() {
    if (mongoose.connection.readyState !== 1) {
        const error = new Error('MongoDB is not connected');
        error.statusCode = 503;
        throw error;
    }
}

function mapJobForClient(job) {
    if (!job) return null;

    const doc = job.toObject ? job.toObject() : job;
    return {
        job_id: doc._id?.toString(),
        user_id: doc.user_id,
        job_status: doc.job_status,
        current_step: doc.current_step,
        completed_steps: doc.completed_steps,
        step_retries: doc.step_retries,
        max_retries_per_step: doc.max_retries_per_step,
        next_retry_at: doc.next_retry_at,
        input: doc.input,
        pageindex_email: doc.pageindex_email,
        api_key_name: doc.api_key_name,
        hosted_document_id: doc.hosted_document_id,
        page_count: doc.page_count,
        estimated_time: doc.estimated_time,
        index_status: doc.index_status,
        retrieval_ready: doc.retrieval_ready,
        linked_document_id: doc.linked_document_id,
        last_error: doc.last_error,
        last_error_step: doc.last_error_step,
        has_file: doc.input?.has_file ?? false,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        completed_at: doc.completed_at,
    };
}

async function userHasRunningJob(userId) {
    ensureMongoConnected();
    const existing = await PageIndexHostedJob.findOne({
        user_id: userId,
        job_status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RUNNING, JOB_STATUS.RETRY_SCHEDULED] },
    }).select('_id');
    return Boolean(existing);
}

async function createHostedJob({
    user_id,
    source_email,
    mailtm_password_enc,
    has_file,
    original_filename,
    mime_type,
    file_size,
    file_staging_path,
    page_credits_charged = 0,
}) {
    ensureMongoConnected();

    const hasRunning = await userHasRunningJob(user_id);
    if (hasRunning) {
        const error = new Error('A hosted PageIndex job is already in progress for this user.');
        error.statusCode = 409;
        throw error;
    }

    const job = new PageIndexHostedJob({
        user_id,
        job_status: JOB_STATUS.PENDING,
        current_step: JOB_STEPS.STEP1_ACCOUNT,
        completed_steps: defaultCompletedSteps(),
        step_retries: defaultStepRetries(),
        input: {
            source_email,
            has_file,
            original_filename: original_filename ?? null,
            mime_type: mime_type ?? null,
            file_size: file_size ?? null,
        },
        mailtm_password_enc: mailtm_password_enc ?? null,
        file_staging_path: file_staging_path ?? null,
        index_status: has_file ? HOSTED_INDEX_STATUS.PROCESSING : HOSTED_INDEX_STATUS.SKIPPED,
        page_credits_charged: page_credits_charged ?? 0,
        page_credits_refunded: false,
    });

    await job.save();
    return job;
}

async function getHostedJobByIdForUser({ job_id, user_id }) {
    ensureMongoConnected();
    return PageIndexHostedJob.findOne({ _id: job_id, user_id });
}

async function getHostedJobByLinkedDocument({ user_id, document_id }) {
    ensureMongoConnected();

    const query = {
        user_id,
        $or: [{ linked_document_id: document_id }],
    };

    if (mongoose.Types.ObjectId.isValid(document_id)) {
        query.$or.push({ _id: document_id });
    }

    return PageIndexHostedJob.findOne(query);
}

async function listHostedJobsForUser({ user_id, limit = 20, skip = 0 }) {
    ensureMongoConnected();
    const jobs = await PageIndexHostedJob.find({ user_id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    const total = await PageIndexHostedJob.countDocuments({ user_id });
    return { jobs, total };
}

async function claimHostedJob(jobId) {
    ensureMongoConnected();
    return PageIndexHostedJob.findOneAndUpdate(
        {
            _id: jobId,
            job_status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RETRY_SCHEDULED, JOB_STATUS.RUNNING] },
        },
        {
            $set: {
                job_status: JOB_STATUS.RUNNING,
                last_error: null,
            },
        },
        { new: true },
    );
}

async function updateHostedJob(jobId, update) {
    ensureMongoConnected();
    return PageIndexHostedJob.findByIdAndUpdate(jobId, { $set: update }, { new: true });
}

async function appendAttemptLog(jobId, entry) {
    ensureMongoConnected();
    return PageIndexHostedJob.findByIdAndUpdate(
        jobId,
        { $push: { attempt_log: { $each: [entry], $slice: -50 } } },
        { new: true },
    );
}

async function findJobsReadyForRecovery(limit = 10) {
    ensureMongoConnected();
    const now = new Date();
    return PageIndexHostedJob.find({
        job_status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RUNNING, JOB_STATUS.RETRY_SCHEDULED] },
        $or: [
            { next_retry_at: null },
            { next_retry_at: { $lte: now } },
        ],
    })
        .sort({ next_retry_at: 1, createdAt: 1 })
        .limit(limit);
}

export {
    mapJobForClient,
    createHostedJob,
    getHostedJobByIdForUser,
    getHostedJobByLinkedDocument,
    listHostedJobsForUser,
    claimHostedJob,
    updateHostedJob,
    appendAttemptLog,
    findJobsReadyForRecovery,
    userHasRunningJob,
};
