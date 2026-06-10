const { test } = require('tap');

test('jobRunner exports processHostedJob and enqueueHostedJob', (t) => {
    const runner = require('../services/pageindexHosted/jobRunner');
    t.type(runner.processHostedJob, 'function');
    t.type(runner.enqueueHostedJob, 'function');
    t.type(runner.scheduleJobRetry, 'function');
    t.end();
});

test('jobRecovery exports startHostedJobRecovery', (t) => {
    const recovery = require('../services/pageindexHosted/jobRecovery');
    t.type(recovery.startHostedJobRecovery, 'function');
    t.type(recovery.recoverHostedJobs, 'function');
    t.end();
});
