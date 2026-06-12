import { test } from 'tap';
import { mapHostedJobToIndexStatus } from '../services/pageindexHosted/jobHelpers.js';
import { JOB_STEPS, JOB_STATUS } from '../utils/pageindexHostedJobConstants.js';
import IndexStatus from '../utils/enums.js';
import { deriveLocalPart } from '../utils/provisionMailTmInbox.js';

test('deriveLocalPart returns unique local parts', (t) => {
    const localPartA = deriveLocalPart();
    const localPartB = deriveLocalPart();
    t.match(localPartA, /^paperai-[a-f0-9]{8}$/);
    t.not(localPartA, localPartB);
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
