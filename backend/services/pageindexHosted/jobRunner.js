import { encryptSecret, decryptSecret, assertSecretsKeyConfigured } from '../../utils/secretEncryption.js';
import { deleteStagedJobFile } from '../../utils/fileStaging.js';
import { createHostedJobLogger } from '../../utils/hostedJobLogger.js';
import { HOSTED_INDEX_STATUS, JOB_STEPS, JOB_STATUS } from '../../utils/pageindexHostedJobConstants.js';
import IndexStatus from '../../utils/enums.js';
import {
    claimHostedJob,
    updateHostedJob,
    appendAttemptLog,
    getHostedJobByIdForUser,
} from '../../helpers/pageIndexHostedJobHelpers.js';
import {
    updateHostedPageIndexDocumentAfterUpload,
    updateHostedPageIndexDocumentStatus,
} from '../../helpers/pageIndexDBHelpers.js';
import { saveHostedTreeJson } from '../../utils/hostedTreeStorage.js';
import {
    getNextStep,
    computeRetryBackoffMs,
    isNonFatalStep,
    buildTerminalStatus,
    hasRetriesRemaining,
} from './jobHelpers.js';
import { refundPageCreditsForJob } from '../../helpers/userPageHelpers.js';
import {
    obtainChatSession,
    resolveMailTmCredentials,
    runStep1Account,
    runStep2Upload,
    runStep3Password,
    runStep4_1Login,
    runStep4_2ApiKey,
    runStep4_3Tree,
    generateRandomApiKeyName,
} from './steps.js';

const activeJobLocks = new Map();
const scheduledRetries = new Map();

async function withJobLock(jobId, fn) {
    if (activeJobLocks.get(jobId)) {
        return null;
    }

    activeJobLocks.set(jobId, true);
    try {
        return await fn();
    } finally {
        activeJobLocks.delete(jobId);
    }
}

async function markStepComplete(jobId, step, extra = {}) {
    const completedKey = `completed_steps.${step}`;
    return updateHostedJob(jobId, {
        [completedKey]: true,
        current_step: step,
        ...extra,
    });
}

async function markStepSkipped(jobId, step, extra = {}) {
    const completedKey = `completed_steps.${step}`;
    return updateHostedJob(jobId, {
        [completedKey]: 'skipped',
        current_step: step,
        ...extra,
    });
}

async function handleStepFailure(job, step, error, logger) {
    const jobId = job._id.toString();
    const message = error?.message || String(error);
    const nextRetryCount = (job.step_retries?.[step] ?? 0) + 1;
    const retryKey = `step_retries.${step}`;
    const maxRetries = job.max_retries_per_step ?? 5;

    logger.error(step, `Step failed: ${message}`, error, {
        attempt: nextRetryCount,
        maxRetries,
        nonFatal: isNonFatalStep(step),
    });

    await appendAttemptLog(jobId, {
        step,
        attempt: nextRetryCount,
        at: new Date(),
        message,
    });

    if (!hasRetriesRemaining({ ...job, step_retries: { ...job.step_retries, [step]: nextRetryCount } }, step)) {
        if (isNonFatalStep(step)) {
            logger.warn(step, 'Step retries exhausted — marking as skipped and continuing job', {
                attempt: nextRetryCount,
            });

            const skipExtra = step === JOB_STEPS.STEP2_UPLOAD
                ? { index_status: HOSTED_INDEX_STATUS.FAILED }
                : {};

            await markStepSkipped(jobId, step, {
                job_status: JOB_STATUS.RUNNING,
                last_error: message,
                last_error_step: step,
                [retryKey]: nextRetryCount,
                ...skipExtra,
            });

            if (step === JOB_STEPS.STEP2_UPLOAD) {
                await refundPageCreditsForJob(job);
            }

            return { action: 'continue', hasWarnings: step === JOB_STEPS.STEP4_3_TREE };
        }

        logger.error(step, 'Step retries exhausted — job failed', error, {
            attempt: nextRetryCount,
        });

        await updateHostedJob(jobId, {
            job_status: JOB_STATUS.FAILED,
            last_error: message,
            last_error_step: step,
            [retryKey]: nextRetryCount,
            completed_at: new Date(),
        });

        await refundPageCreditsForJob(job);
        await cleanupJobFiles(job, logger);
        return { action: 'stop' };
    }

    const backoffMs = computeRetryBackoffMs(nextRetryCount - 1);
    const nextRetryAt = new Date(Date.now() + backoffMs);

    logger.warn(step, 'Scheduling step retry', {
        attempt: nextRetryCount,
        maxRetries,
        backoffMs,
        nextRetryAt: nextRetryAt.toISOString(),
    });

    await updateHostedJob(jobId, {
        job_status: JOB_STATUS.RETRY_SCHEDULED,
        last_error: message,
        last_error_step: step,
        [retryKey]: nextRetryCount,
        next_retry_at: nextRetryAt,
        current_step: step,
    });

    scheduleJobRetry(jobId, backoffMs);
    return { action: 'retry_scheduled' };
}

async function cleanupJobFiles(job, logger) {
    if (job.file_staging_path) {
        logger.info('job', 'Cleaning up staged PDF file', {
            path: job.file_staging_path,
        });
        await deleteStagedJobFile(job.file_staging_path);
        logger.success('job', 'Staged PDF file removed');
    }
}

async function ensureChatSessionForJob(job, runContext, logger) {
    if (runContext.sessionCookies) {
        logger.info('step2_upload', 'Reusing in-memory chat session cookies');
        return runContext.sessionCookies;
    }

    logger.warn('step2_upload', 'Chat session cookies missing — re-authenticating via Mail.tm', {
        pageindexEmail: job.pageindex_email,
    });

    const mailTmCredentials = resolveMailTmCredentials(job);
    const { sessionCookies } = await obtainChatSession(mailTmCredentials, logger);
    runContext.sessionCookies = sessionCookies;
    return sessionCookies;
}

async function executeStep(job, step, runContext, logger) {
    const jobId = job._id.toString();

    logger.info(step, 'Step started', {
        jobStatus: job.job_status,
        stepRetries: job.step_retries?.[step] ?? 0,
    });

    switch (step) {
        case JOB_STEPS.STEP1_ACCOUNT: {
            const result = await runStep1Account(job, logger);
            runContext.sessionCookies = result.sessionCookies;
            const updated = await markStepComplete(jobId, step, {
                pageindex_email: result.pageindexEmail,
            });
            logger.success(step, 'Step marked complete in database', {
                pageindexEmail: result.pageindexEmail,
            });
            return updated;
        }

        case JOB_STEPS.STEP2_UPLOAD: {
            const sessionCookies = await ensureChatSessionForJob(job, runContext, logger);
            const result = await runStep2Upload(job, sessionCookies, logger);
            if (result.skipped) {
                const updated = await markStepSkipped(jobId, step, {
                    index_status: HOSTED_INDEX_STATUS.SKIPPED,
                });
                logger.warn(step, 'Step marked skipped in database');
                return updated;
            }

            const linkedDocumentId = job.linked_document_id || jobId;

            await updateHostedPageIndexDocumentAfterUpload({
                user_id: job.user_id,
                hosted_job_id: jobId,
                hosted_pageindex_doc_id: result.docId,
                document_name: result.fileName,
                file_size: job.input.file_size,
                mime_type: job.input.mime_type,
                page_count: result.pageCount,
                index_status: IndexStatus.RUNNING,
            });

            logger.success(step, 'Hosted document record updated after upload', {
                linkedDocumentId,
                hostedPageindexDocId: result.docId,
            });

            const updated = await markStepComplete(jobId, step, {
                hosted_document_id: result.docId,
                page_count: result.pageCount,
                estimated_time: result.estimatedTime,
                linked_document_id: linkedDocumentId,
                index_status: HOSTED_INDEX_STATUS.PROCESSING,
            });

            await deleteStagedJobFile(job.file_staging_path);
            await updateHostedJob(jobId, { file_staging_path: null });
            logger.success(step, 'Step marked complete; staged file removed');
            return updated;
        }

        case JOB_STEPS.STEP3_PASSWORD: {
            const { password } = await runStep3Password(job, logger);
            runContext.password = password;
            const updated = await markStepComplete(jobId, step, {
                pageindex_password_enc: encryptSecret(password),
            });
            logger.success(step, 'Step marked complete; password encrypted and stored');
            return updated;
        }

        case JOB_STEPS.STEP4_1_LOGIN: {
            const password = runContext.password || decryptSecret(job.pageindex_password_enc);
            if (!password) {
                throw new Error('PageIndex password is not available for dashboard login.');
            }
            const { dashboardSessionCookies } = await runStep4_1Login(job, password, logger);
            runContext.dashboardSessionCookies = dashboardSessionCookies;
            const updated = await markStepComplete(jobId, step, {});
            logger.success(step, 'Step marked complete');
            return updated;
        }

        case JOB_STEPS.STEP4_2_API_KEY: {
            const apiKeyName = job.api_key_name || generateRandomApiKeyName();
            const { apiKey, apiKeyName: name } = await runStep4_2ApiKey(
                job,
                runContext.dashboardSessionCookies,
                apiKeyName,
                logger,
            );
            runContext.apiKey = apiKey;
            const updated = await markStepComplete(jobId, step, {
                api_key_name: name,
                pageindex_api_key_enc: encryptSecret(apiKey),
            });
            logger.success(step, 'Step marked complete; API key encrypted and stored', {
                apiKeyName: name,
            });
            return updated;
        }

        case JOB_STEPS.STEP4_3_TREE: {
            const apiKey = runContext.apiKey || decryptSecret(job.pageindex_api_key_enc);
            if (!apiKey) {
                throw new Error('PageIndex API key is not available for tree fetch.');
            }

            const result = await runStep4_3Tree(job, apiKey, logger);
            if (result.skipped) {
                const updated = await markStepSkipped(jobId, step, {});
                logger.warn(step, 'Step marked skipped in database');
                return updated;
            }

            const linkedDocumentId = job.linked_document_id || jobId;
            let treeStorage = null;

            if (result.tree) {
                treeStorage = await saveHostedTreeJson({
                    user_id: job.user_id,
                    document_id: linkedDocumentId,
                    tree: result.tree,
                });
                logger.success(step, 'Document tree JSON saved to S3', {
                    s3Uri: treeStorage.pageindex_s3_uri,
                    rootNodeCount: Array.isArray(result.tree) ? result.tree.length : 0,
                });
            } else {
                logger.warn(step, 'Tree completed but result payload was empty');
            }

            if (linkedDocumentId) {
                await updateHostedPageIndexDocumentStatus({
                    user_id: job.user_id,
                    document_id: linkedDocumentId,
                    index_status: IndexStatus.COMPLETE,
                    page_count: job.page_count ?? undefined,
                    pageindex_s3_uri: treeStorage?.pageindex_s3_uri,
                });
                logger.success(step, 'Document index status set to complete', {
                    linkedDocumentId,
                });
            }

            const updated = await markStepComplete(jobId, step, {
                index_status: HOSTED_INDEX_STATUS.COMPLETED,
                retrieval_ready: result.retrievalReady,
            });
            logger.success(step, 'Step marked complete');
            return updated;
        }

        default:
            return job;
    }
}

async function runJobPipeline(job, logger) {
    const runContext = {};
    let currentJob = job;
    let hasWarnings = false;

    try {
        assertSecretsKeyConfigured();
    } catch (error) {
        logger.error('job', 'Invalid PAGEINDEX_SECRETS_KEY — cannot encrypt credentials', error);
        await updateHostedJob(currentJob._id.toString(), {
            job_status: JOB_STATUS.FAILED,
            last_error: error.message,
            last_error_step: 'config',
            completed_at: new Date(),
        });
        await refundPageCreditsForJob(currentJob);
        logger.finalize(JOB_STATUS.FAILED, { configError: true });
        return;
    }

    logger.info('job', 'Job pipeline started', {
        currentStep: currentJob.current_step,
        jobStatus: currentJob.job_status,
        hasFile: currentJob.input?.has_file ?? false,
        sourceEmail: currentJob.input?.source_email,
        logFile: logger.logFile,
    });

    while (true) {
        const step = getNextStep(currentJob);
        if (step === JOB_STEPS.DONE) {
            logger.info('job', 'All steps complete — pipeline finished');
            break;
        }

        try {
            currentJob = await executeStep(currentJob, step, runContext, logger);
            logger.success(step, 'Step finished successfully');
        } catch (error) {
            const failure = await handleStepFailure(currentJob, step, error, logger);
            if (failure.action === 'continue') {
                if (failure.hasWarnings) {
                    hasWarnings = true;
                    const linkedDocumentId = currentJob.linked_document_id || currentJob._id.toString();
                    if (linkedDocumentId) {
                        await updateHostedPageIndexDocumentStatus({
                            user_id: currentJob.user_id,
                            document_id: linkedDocumentId,
                            index_status: IndexStatus.FAILED,
                            error_message: error.message,
                        });
                        logger.warn(step, 'Document marked failed after non-fatal step exhaustion', {
                            linkedDocumentId,
                        });
                    }
                    await refundPageCreditsForJob(currentJob);
                }
                currentJob = await getHostedJobByIdForUser({
                    job_id: currentJob._id,
                    user_id: currentJob.user_id,
                });
                continue;
            }

            logger.finalize(JOB_STATUS.FAILED, {
                lastErrorStep: step,
                lastError: error.message,
            });
            return;
        }
    }

    const terminalStatus = buildTerminalStatus({ hasWarnings });
    await updateHostedJob(currentJob._id.toString(), {
        job_status: terminalStatus,
        current_step: JOB_STEPS.DONE,
        completed_at: new Date(),
        next_retry_at: null,
        last_error: hasWarnings ? currentJob.last_error : null,
    });

    await cleanupJobFiles(currentJob, logger);

    logger.finalize(terminalStatus, {
        hasWarnings,
        hostedDocumentId: currentJob.hosted_document_id || null,
        linkedDocumentId: currentJob.linked_document_id || null,
        pageindexEmail: currentJob.pageindex_email || null,
    });
}

async function processHostedJob(jobId) {
    return withJobLock(jobId, async () => {
        const claimed = await claimHostedJob(jobId);
        if (!claimed) {
            console.log(`[PageIndexHostedJob] | INFO | job=${jobId} | Job already running or not claimable — skipping`);
            return null;
        }

        const logger = createHostedJobLogger({
            jobId,
            userId: claimed.user_id,
        });

        logger.info('job', 'Job claimed and processing started', {
            jobStatus: claimed.job_status,
            currentStep: claimed.current_step,
            completedSteps: claimed.completed_steps,
        });

        try {
            await runJobPipeline(claimed, logger);
        } catch (error) {
            logger.error('job', 'Unexpected pipeline failure', error);
            const failedJob = await getHostedJobByIdForUser({ job_id: jobId, user_id: claimed.user_id });
            await updateHostedJob(jobId, {
                job_status: JOB_STATUS.FAILED,
                last_error: error.message,
                completed_at: new Date(),
            });
            await refundPageCreditsForJob(failedJob || claimed);
            logger.finalize(JOB_STATUS.FAILED, { unexpected: true });
        }

        return getHostedJobByIdForUser({ job_id: jobId, user_id: claimed.user_id });
    });
}

function scheduleJobRetry(jobId, delayMs) {
    const existing = scheduledRetries.get(jobId);
    if (existing) {
        clearTimeout(existing);
    }

    console.log(`[PageIndexHostedJob] | INFO | job=${jobId} | Scheduled retry in ${delayMs}ms`);

    const timeout = setTimeout(() => {
        scheduledRetries.delete(jobId);
        processHostedJob(jobId).catch((error) => {
            console.error(`[PageIndexHostedJob] | ERROR | job=${jobId} | Scheduled retry failed | ${error.message}`);
        });
    }, delayMs);

    scheduledRetries.set(jobId, timeout);
}

function enqueueHostedJob(jobId) {
    console.log(`[PageIndexHostedJob] | INFO | job=${jobId} | Job enqueued for background processing`);
    setImmediate(() => {
        processHostedJob(jobId).catch((error) => {
            console.error(`[PageIndexHostedJob] | ERROR | job=${jobId} | Background processing failed | ${error.message}`);
        });
    });
}

export {
    processHostedJob,
    enqueueHostedJob,
    scheduleJobRetry,
    activeJobLocks,
};
