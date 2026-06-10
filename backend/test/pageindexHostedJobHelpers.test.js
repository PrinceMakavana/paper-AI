const { test } = require('tap');
const {
    getNextStep,
    shouldSkipStep,
    hasRetriesRemaining,
    computeRetryBackoffMs,
    isNonFatalStep,
    buildTerminalStatus,
} = require('../services/pageindexHosted/jobHelpers');
const { JOB_STEPS, JOB_STATUS } = require('../utils/pageindexHostedJobConstants');

function buildJob(overrides = {}) {
    return {
        input: { has_file: false },
        hosted_document_id: null,
        completed_steps: {
            [JOB_STEPS.STEP1_ACCOUNT]: false,
            [JOB_STEPS.STEP2_UPLOAD]: false,
            [JOB_STEPS.STEP3_PASSWORD]: false,
            [JOB_STEPS.STEP4_1_LOGIN]: false,
            [JOB_STEPS.STEP4_2_API_KEY]: false,
            [JOB_STEPS.STEP4_3_TREE]: false,
        },
        step_retries: {
            [JOB_STEPS.STEP1_ACCOUNT]: 0,
            [JOB_STEPS.STEP2_UPLOAD]: 0,
            [JOB_STEPS.STEP3_PASSWORD]: 0,
            [JOB_STEPS.STEP4_1_LOGIN]: 0,
            [JOB_STEPS.STEP4_2_API_KEY]: 0,
            [JOB_STEPS.STEP4_3_TREE]: 0,
        },
        max_retries_per_step: 5,
        ...overrides,
    };
}

test('getNextStep returns first incomplete step', (t) => {
    const job = buildJob();
    t.equal(getNextStep(job), JOB_STEPS.STEP1_ACCOUNT);
    t.end();
});

test('getNextStep resumes from checkpoint after step1', (t) => {
    const job = buildJob({
        completed_steps: {
            ...buildJob().completed_steps,
            [JOB_STEPS.STEP1_ACCOUNT]: true,
        },
    });
    t.equal(getNextStep(job), JOB_STEPS.STEP3_PASSWORD);
    t.end();
});

test('getNextStep skips upload when no file is provided', (t) => {
    const job = buildJob({
        completed_steps: {
            ...buildJob().completed_steps,
            [JOB_STEPS.STEP1_ACCOUNT]: true,
        },
        input: { has_file: false },
    });
    t.equal(getNextStep(job), JOB_STEPS.STEP3_PASSWORD);
    t.end();
});

test('getNextStep includes upload when file is provided', (t) => {
    const job = buildJob({
        completed_steps: {
            ...buildJob().completed_steps,
            [JOB_STEPS.STEP1_ACCOUNT]: true,
        },
        input: { has_file: true },
    });
    t.equal(getNextStep(job), JOB_STEPS.STEP2_UPLOAD);
    t.end();
});

test('getNextStep skips tree when hosted_document_id is missing', (t) => {
    const job = buildJob({
        completed_steps: {
            [JOB_STEPS.STEP1_ACCOUNT]: true,
            [JOB_STEPS.STEP2_UPLOAD]: 'skipped',
            [JOB_STEPS.STEP3_PASSWORD]: true,
            [JOB_STEPS.STEP4_1_LOGIN]: true,
            [JOB_STEPS.STEP4_2_API_KEY]: true,
            [JOB_STEPS.STEP4_3_TREE]: false,
        },
        hosted_document_id: null,
    });
    t.equal(getNextStep(job), JOB_STEPS.DONE);
    t.end();
});

test('shouldSkipStep treats upload skip flag as skipped', (t) => {
    const job = buildJob({
        input: { has_file: true },
        completed_steps: {
            ...buildJob().completed_steps,
            [JOB_STEPS.STEP2_UPLOAD]: 'skipped',
        },
    });
    t.equal(shouldSkipStep(job, JOB_STEPS.STEP2_UPLOAD), true);
    t.end();
});

test('hasRetriesRemaining respects per-step max retries', (t) => {
    const job = buildJob({
        step_retries: {
            ...buildJob().step_retries,
            [JOB_STEPS.STEP1_ACCOUNT]: 4,
        },
    });
    t.equal(hasRetriesRemaining(job, JOB_STEPS.STEP1_ACCOUNT), true);

    job.step_retries[JOB_STEPS.STEP1_ACCOUNT] = 5;
    t.equal(hasRetriesRemaining(job, JOB_STEPS.STEP1_ACCOUNT), false);
    t.end();
});

test('computeRetryBackoffMs caps at 60 seconds', (t) => {
    t.equal(computeRetryBackoffMs(0), 5000);
    t.equal(computeRetryBackoffMs(10), 60000);
    t.end();
});

test('isNonFatalStep marks upload and tree as non-fatal', (t) => {
    t.equal(isNonFatalStep(JOB_STEPS.STEP2_UPLOAD), true);
    t.equal(isNonFatalStep(JOB_STEPS.STEP4_3_TREE), true);
    t.equal(isNonFatalStep(JOB_STEPS.STEP3_PASSWORD), false);
    t.end();
});

test('buildTerminalStatus returns warnings status when needed', (t) => {
    t.equal(buildTerminalStatus({ hasWarnings: false }), JOB_STATUS.COMPLETED);
    t.equal(buildTerminalStatus({ hasWarnings: true }), JOB_STATUS.COMPLETED_WITH_WARNINGS);
    t.end();
});
