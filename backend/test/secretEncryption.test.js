const { test } = require('tap');
const crypto = require('crypto');
const { encryptSecret, decryptSecret } = require('../utils/secretEncryption');

test('encryptSecret round-trips values', (t) => {
    const originalKey = process.env.PAGEINDEX_SECRETS_KEY;
    process.env.PAGEINDEX_SECRETS_KEY = crypto.randomBytes(32).toString('base64');

    const plain = 'test-password-123';
    const encrypted = encryptSecret(plain);
    t.not(encrypted, plain);
    t.equal(decryptSecret(encrypted), plain);

    if (originalKey === undefined) {
        delete process.env.PAGEINDEX_SECRETS_KEY;
    } else {
        process.env.PAGEINDEX_SECRETS_KEY = originalKey;
    }
    t.end();
});

test('encryptSecret returns null for empty input', (t) => {
    t.equal(encryptSecret(null), null);
    t.equal(encryptSecret(''), null);
    t.end();
});
