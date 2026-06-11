import { test } from 'tap';
import { generateDummySourceEmail } from '../utils/generateDummyEmail.js';
import { mapHostedJobToIndexStatus } from '../services/pageindexHosted/jobHelpers.js';
import { JOB_STEPS, JOB_STATUS } from '../utils/pageindexHostedJobConstants.js';
import IndexStatus from '../utils/enums.js';

test('generateDummySourceEmail returns unique local-part emails', (t) => {
    const emailA = generateDummySourceEmail();
    const emailB = generateDummySourceEmail();
    t.match(emailA, /^[a-f0-9]+-[a-f0-9]+@yopmail\.com$/);
    t.not(emailA, emailB);
    t.end();
});

test('mapHostedJobToIndexStatus maps completed tree step to complete', (t) => {
    const status = mapHostedJobToIndexStatus({
        job_status: JOB_STATUS.RUNNING,
        hosted_document_id: 'doc-1',
        completed_steps: {
            [JOB_STEPS.STEP4_3_TREE]: true,
        },
    });
    t.equal(status, IndexStatus.COMPLETE);
    t.end();
});

test('mapHostedJobToIndexStatus maps pending job to queued', (t) => {
    const status = mapHostedJobToIndexStatus({
        job_status: JOB_STATUS.PENDING,
        completed_steps: {},
    });
    t.equal(status, IndexStatus.QUEUED);
    t.end();
});
