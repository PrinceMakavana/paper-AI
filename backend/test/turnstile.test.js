import tap from 'tap';
import {
    getClientIp,
    isTurnstileEnforced,
    verifyTurnstileToken,
} from '../utils/turnstile.js';

const originalFetch = global.fetch;
const originalNodeEnv = process.env.NODE_ENV;
const originalSecret = process.env.TURNSTILE_SECRET_KEY;

tap.beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
});

tap.afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.TURNSTILE_SECRET_KEY = originalSecret;
});

tap.test('isTurnstileEnforced is disabled in test env', async (t) => {
    process.env.NODE_ENV = 'test';
    t.equal(isTurnstileEnforced(), false);
});

tap.test('getClientIp prefers Cloudflare header', async (t) => {
    const ip = getClientIp({
        headers: {
            'cf-connecting-ip': '203.0.113.10',
            'x-forwarded-for': '198.51.100.1',
        },
        ip: '127.0.0.1',
    });

    t.equal(ip, '203.0.113.10');
});

tap.test('verifyTurnstileToken rejects missing token when enforced', async (t) => {
    const result = await verifyTurnstileToken('');
    t.equal(result, false);
});

tap.test('verifyTurnstileToken validates token with Cloudflare', async (t) => {
    global.fetch = async () => ({
        ok: true,
        json: async () => ({ success: true }),
    });

    const result = await verifyTurnstileToken('valid-token', '203.0.113.10');
    t.equal(result, true);
});

tap.test('verifyTurnstileToken returns false when Cloudflare rejects token', async (t) => {
    global.fetch = async () => ({
        ok: true,
        json: async () => ({ success: false }),
    });

    const result = await verifyTurnstileToken('invalid-token', '203.0.113.10');
    t.equal(result, false);
});
