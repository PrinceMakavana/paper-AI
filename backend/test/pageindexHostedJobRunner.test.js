import { test } from 'tap';
import * as runner from '../services/pageindexHosted/jobRunner.js';
import * as recovery from '../services/pageindexHosted/jobRecovery.js';

test('jobRunner exports processHostedJob and enqueueHostedJob', (t) => {
    t.type(runner.processHostedJob, 'function');
    t.type(runner.enqueueHostedJob, 'function');
    t.type(runner.scheduleJobRetry, 'function');
    t.end();
});

test('jobRecovery exports startHostedJobRecovery', (t) => {
    t.type(recovery.startHostedJobRecovery, 'function');
    t.type(recovery.recoverHostedJobs, 'function');
    t.end();
});
