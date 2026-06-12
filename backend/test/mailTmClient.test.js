import { test } from 'tap';
import {
    subjectMatches,
    fromMatches,
    messageContent,
} from '../utils/mailTmClient.js';
import { deriveLocalPart, sanitizeLocalPart } from '../utils/provisionMailTmInbox.js';

test('subjectMatches supports wildcard patterns', (t) => {
    t.ok(subjectMatches('Your Verification code is ready', '%Verification code%'));
    t.notOk(subjectMatches('Password Reset', '%Verification code%'));
    t.end();
});

test('fromMatches checks name and address', (t) => {
    t.ok(fromMatches({ name: 'PageIndex', address: 'noreply@pageindex.ai' }, 'PageIndex'));
    t.notOk(fromMatches({ name: 'Other', address: 'other@example.com' }, 'PageIndex'));
    t.end();
});

test('messageContent prefers text over html', (t) => {
    t.equal(messageContent({ text: 'plain', html: ['<p>html</p>'] }), 'plain');
    t.equal(messageContent({ html: ['<p>only html</p>'] }), '<p>only html</p>');
    t.end();
});

test('deriveLocalPart uses optional email local-part with suffix', (t) => {
    const withEmail = deriveLocalPart('John.Doe@example.com');
    t.match(withEmail, /^john\.doe-[a-f0-9]{8}$/);

    const withoutEmail = deriveLocalPart();
    t.match(withoutEmail, /^paperai-[a-f0-9]{8}$/);
    t.end();
});

test('sanitizeLocalPart strips invalid characters', (t) => {
    t.equal(sanitizeLocalPart('User!@# Name'), 'username');
    t.equal(sanitizeLocalPart(''), 'paperai');
    t.end();
});

test('pollForMessage returns matched message content', async (t) => {
    const requests = [];

    const { pollForMessage: poll } = await t.mockImport('../utils/mailTmClient.js', {
        axios: {
            default: {
                get: async (url, config) => {
                    requests.push({ method: 'GET', url, config });
                    if (url.endsWith('/messages')) {
                        return {
                            data: {
                                'hydra:member': [{
                                    id: 'msg-1',
                                    from: { name: 'PageIndex', address: 'noreply@pageindex.ai' },
                                    subject: 'Your Verification code',
                                }],
                            },
                        };
                    }
                    if (url.endsWith('/messages/msg-1')) {
                        return {
                            data: {
                                id: 'msg-1',
                                text: 'Your verification code is: 123456',
                            },
                        };
                    }
                    throw new Error(`Unexpected GET ${url}`);
                },
            },
        },
    });

    const result = await poll('test-token', {
        from: 'PageIndex',
        subject: '%Verification code%',
    });

    t.equal(result.id, 'msg-1');
    t.match(result.content, /123456/);
    t.ok(requests.some((req) => req.url.endsWith('/messages')));
    t.end();
});
