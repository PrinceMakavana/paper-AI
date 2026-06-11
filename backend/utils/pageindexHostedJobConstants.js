const JOB_STEPS = {
    STEP1_ACCOUNT: 'step1_account',
    STEP2_UPLOAD: 'step2_upload',
    STEP3_PASSWORD: 'step3_password',
    STEP4_1_LOGIN: 'step4_1_login',
    STEP4_2_API_KEY: 'step4_2_api_key',
    STEP4_3_TREE: 'step4_3_tree',
    DONE: 'done',
};

const STEP_ORDER = [
    JOB_STEPS.STEP1_ACCOUNT,
    JOB_STEPS.STEP2_UPLOAD,
    JOB_STEPS.STEP3_PASSWORD,
    JOB_STEPS.STEP4_1_LOGIN,
    JOB_STEPS.STEP4_2_API_KEY,
    JOB_STEPS.STEP4_3_TREE,
];

const JOB_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    RETRY_SCHEDULED: 'retry_scheduled',
    COMPLETED: 'completed',
    COMPLETED_WITH_WARNINGS: 'completed_with_warnings',
    FAILED: 'failed',
};

const HOSTED_INDEX_STATUS = {
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
};

const NON_FATAL_STEPS = new Set([
    JOB_STEPS.STEP2_UPLOAD,
    JOB_STEPS.STEP4_3_TREE,
]);

const DEFAULT_MAX_RETRIES_PER_STEP = 5;

function defaultCompletedSteps() {
    return STEP_ORDER.reduce((acc, step) => {
        acc[step] = false;
        return acc;
    }, {});
}

function defaultStepRetries() {
    return STEP_ORDER.reduce((acc, step) => {
        acc[step] = 0;
        return acc;
    }, {});
}

export {
    JOB_STEPS,
    STEP_ORDER,
    JOB_STATUS,
    HOSTED_INDEX_STATUS,
    NON_FATAL_STEPS,
    DEFAULT_MAX_RETRIES_PER_STEP,
    defaultCompletedSteps,
    defaultStepRetries,
};
