import tap from 'tap';
import supertest from 'supertest';

const originalEnv = {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
    PAGEINDEX_S3_BUCKET: process.env.PAGEINDEX_S3_BUCKET,
    S3_BUCKET: process.env.S3_BUCKET,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    PDF_SIGNED_URL_EXPIRES_SECONDS: process.env.PDF_SIGNED_URL_EXPIRES_SECONDS,
};

function restoreEnvValue(name, value) {
    if (value === undefined) {
        delete process.env[name];
        return;
    }

    process.env[name] = value;
}

process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET_NAME = 'pageindex-json-store';
process.env.PDF_SIGNED_URL_EXPIRES_SECONDS = '600';
delete process.env.PAGEINDEX_S3_BUCKET;
delete process.env.S3_BUCKET;
delete process.env.AWS_S3_BUCKET;

const { default: app } = await import('../app.js');
const server = supertest(app);

tap.test('GET /public/catalog/download-url redirects S3 locations to signed HTTPS URLs', async (t) => {
    const response = await server
        .get('/public/catalog/download-url')
        .query({ url: 's3://pageindex-json-store/old_papers/3336202/summer-2017.pdf' });

    t.equal(response.status, 302);
    t.match(response.headers.location, /^https:\/\/pageindex-json-store\.s3\.amazonaws\.com\/old_papers\/3336202\/summer-2017\.pdf\?/);
    t.match(response.headers.location, /X-Amz-Algorithm=AWS4-HMAC-SHA256/);
    t.match(response.headers.location, /X-Amz-Expires=600/);
});

tap.test('GET /public/catalog/download-url rejects missing URL input', async (t) => {
    const response = await server.get('/public/catalog/download-url');

    t.equal(response.status, 400);
    t.equal(response.body.message, 'Download URL is required.');
});

tap.test('GET /public/catalog/download-url rejects non-S3 URLs', async (t) => {
    const response = await server
        .get('/public/catalog/download-url')
        .query({ url: 'https://example.com/file.pdf' });

    t.equal(response.status, 400);
    t.equal(response.body.message, 'Only S3 download URLs can be signed.');
});

tap.test('GET /public/catalog/download-url rejects unconfigured buckets', async (t) => {
    const response = await server
        .get('/public/catalog/download-url')
        .query({ url: 's3://other-bucket/file.pdf' });

    t.equal(response.status, 403);
    t.equal(response.body.message, 'S3 bucket is not allowed for public downloads.');
});

tap.test('GET /public/catalog/download-url reports missing AWS credentials', async (t) => {
    delete process.env.AWS_SECRET_ACCESS_KEY;
    const originalConsoleError = console.error;
    console.error = () => {};

    let response;
    try {
        response = await server
            .get('/public/catalog/download-url')
            .query({ url: 's3://pageindex-json-store/old_papers/3336202/summer-2017.pdf' });
    } finally {
        console.error = originalConsoleError;
    }

    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';

    t.equal(response.status, 500);
    t.equal(response.body.message, 'AWS credentials are not configured for PDF viewing.');
});

tap.teardown(() => {
    Object.entries(originalEnv).forEach(([name, value]) => {
        restoreEnvValue(name, value);
    });
});
