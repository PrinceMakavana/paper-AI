const { test } = require('tap');
const fs = require('fs');
const path = require('path');
const { createHostedJobLogger, HOSTED_JOB_LOG_DIR } = require('../utils/hostedJobLogger');

test('createHostedJobLogger writes events to log file', (t) => {
    const jobId = `test-${Date.now()}`;
    const logger = createHostedJobLogger({ jobId, userId: 'user-1' });

    logger.info('step1_account', 'Test info event');
    logger.success('step1_account', 'Test success event', { ok: true });
    logger.error('step1_account', 'Test error event', new Error('boom'), { code: 'TEST' });
    logger.finalize('completed', { done: true });

    const files = fs.readdirSync(HOSTED_JOB_LOG_DIR).filter((name) => name.includes(jobId));
    t.ok(files.length >= 1, 'log file should exist');

    const content = JSON.parse(fs.readFileSync(path.join(HOSTED_JOB_LOG_DIR, files[0]), 'utf8'));
    t.equal(content.job_id, jobId);
    t.equal(content.final_status, 'completed');
    t.ok(content.events.length >= 4);

    fs.unlinkSync(path.join(HOSTED_JOB_LOG_DIR, files[0]));
    t.end();
});
