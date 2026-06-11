const { findJobsReadyForRecovery } = require('../../helpers/pageIndexHostedJobHelpers');
const { logHostedJobEvent } = require('../../utils/hostedJobLogger');
const { processHostedJob } = require('./jobRunner');

const RECOVERY_CONCURRENCY = 2;
let recoveryStarted = false;

async function recoverHostedJobs() {
    if (recoveryStarted) {
        return;
    }
    recoveryStarted = true;

    try {
        const jobs = await findJobsReadyForRecovery(20);
        if (!jobs.length) {
            logHostedJobEvent('INFO', {
                step: 'recovery',
                message: 'No hosted jobs found for startup recovery',
            });
            return;
        }

        logHostedJobEvent('INFO', {
            step: 'recovery',
            message: `Recovering ${jobs.length} hosted PageIndex job(s)`,
            meta: {
                jobIds: jobs.map((job) => job._id.toString()),
            },
        });

        for (let i = 0; i < jobs.length; i += RECOVERY_CONCURRENCY) {
            const batch = jobs.slice(i, i + RECOVERY_CONCURRENCY);
            await Promise.all(
                batch.map((job) => {
                    const jobId = job._id.toString();
                    logHostedJobEvent('INFO', {
                        jobId,
                        step: 'recovery',
                        message: 'Resuming job after server restart',
                        meta: {
                            jobStatus: job.job_status,
                            currentStep: job.current_step,
                        },
                    });
                    return processHostedJob(jobId).catch((error) => {
                        logHostedJobEvent('ERROR', {
                            jobId,
                            step: 'recovery',
                            message: 'Recovery processing failed',
                            error,
                        });
                    });
                }),
            );
        }

        logHostedJobEvent('SUCCESS', {
            step: 'recovery',
            message: 'Startup recovery batch dispatched',
            meta: { count: jobs.length },
        });
    } catch (error) {
        logHostedJobEvent('ERROR', {
            step: 'recovery',
            message: 'Hosted PageIndex job recovery error',
            error,
        });
    }
}

function startHostedJobRecovery() {
    logHostedJobEvent('INFO', {
        step: 'recovery',
        message: 'Starting hosted job recovery on server boot',
    });

    recoverHostedJobs().catch((error) => {
        logHostedJobEvent('ERROR', {
            step: 'recovery',
            message: 'Hosted PageIndex job recovery startup error',
            error,
        });
    });
}

module.exports = {
    recoverHostedJobs,
    startHostedJobRecovery,
};
