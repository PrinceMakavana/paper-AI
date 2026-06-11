import {
    JOB_STEPS,
    STEP_ORDER,
    JOB_STATUS,
    NON_FATAL_STEPS,
    DEFAULT_MAX_RETRIES_PER_STEP,
} from '../../utils/pageindexHostedJobConstants.js';
import IndexStatus from '../../utils/enums.js';

function shouldSkipStep(job, step) {
    if (step === JOB_STEPS.STEP2_UPLOAD) {
        return !job.input?.has_file || job.completed_steps?.[JOB_STEPS.STEP2_UPLOAD] === 'skipped';
    }

    if (step === JOB_STEPS.STEP4_3_TREE) {
        return !job.hosted_document_id || job.completed_steps?.[JOB_STEPS.STEP4_3_TREE] === 'skipped';
    }

    return false;
}

function getNextStep(job) {
    return STEP_ORDER.find((step) => {
        if (job.completed_steps?.[step] === true || job.completed_steps?.[step] === 'skipped') {
            return false;
        }
        return !shouldSkipStep(job, step);
    }) || JOB_STEPS.DONE;
}

function computeRetryBackoffMs(attempt) {
    return Math.min(5000 * (2 ** attempt), 60000);
}

function isNonFatalStep(step) {
    return NON_FATAL_STEPS.has(step);
}

function buildTerminalStatus({ hasWarnings }) {
    return hasWarnings ? JOB_STATUS.COMPLETED_WITH_WARNINGS : JOB_STATUS.COMPLETED;
}

function capAttemptLog(log, maxEntries = 50) {
    if (!Array.isArray(log)) return [];
    return log.slice(-maxEntries);
}

function hasRetriesRemaining(job, step) {
    const maxRetries = job.max_retries_per_step ?? DEFAULT_MAX_RETRIES_PER_STEP;
    const used = job.step_retries?.[step] ?? 0;
    return used < maxRetries;
}

function mapHostedJobToIndexStatus(job) {
    if (!job) {
        return IndexStatus.UNKNOWN;
    }

    if (job.completed_steps?.[JOB_STEPS.STEP4_3_TREE] === true) {
        return IndexStatus.COMPLETE;
    }

    switch (job.job_status) {
        case JOB_STATUS.COMPLETED:
        case JOB_STATUS.COMPLETED_WITH_WARNINGS:
            return job.hosted_document_id ? IndexStatus.COMPLETE : IndexStatus.FAILED;
        case JOB_STATUS.FAILED:
            return IndexStatus.FAILED;
        case JOB_STATUS.PENDING:
            return IndexStatus.QUEUED;
        case JOB_STATUS.RUNNING:
        case JOB_STATUS.RETRY_SCHEDULED:
            if (job.completed_steps?.[JOB_STEPS.STEP2_UPLOAD] === true) {
                return IndexStatus.RUNNING;
            }
            return IndexStatus.QUEUED;
        default:
            return IndexStatus.UNKNOWN;
    }
}

export {
    shouldSkipStep,
    getNextStep,
    computeRetryBackoffMs,
    isNonFatalStep,
    buildTerminalStatus,
    capAttemptLog,
    hasRetriesRemaining,
    mapHostedJobToIndexStatus,
    JOB_STEPS,
    JOB_STATUS,
};
