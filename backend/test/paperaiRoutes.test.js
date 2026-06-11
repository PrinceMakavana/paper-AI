import tap from 'tap';
import supertest from 'supertest';
import app from '../app.js';
const server = supertest(app);

tap.test('GET / returns paperAI API branding', async (t) => {
    const response = await server.get('/');
    t.equal(response.status, 200);
    t.match(response.body.message, /paperAI API/i);
    t.end();
});

tap.test('GET /paperai/documents without auth returns 401', async (t) => {
    const response = await server.get('/paperai/documents');
    t.equal(response.status, 401);
    t.end();
});

tap.test('GET /pageindex/documents alias returns same 401', async (t) => {
    const response = await server.get('/pageindex/documents');
    t.equal(response.status, 401);
    t.end();
});

tap.test('POST /paperai/register deprecated endpoint returns 410', async (t) => {
    const response = await server.post('/paperai/register');
    t.equal(response.status, 410);
    t.equal(response.body.replacement, '/paperai/hosted-jobs');
    t.end();
});

tap.test('POST /pageindex/register alias returns 410', async (t) => {
    const response = await server.post('/pageindex/register');
    t.equal(response.status, 410);
    t.equal(response.body.replacement, '/paperai/hosted-jobs');
    t.end();
});

tap.teardown(() => {
    process.exit(0);
});
