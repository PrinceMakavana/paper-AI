import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const SECRETS_KEY_HINT = 'Generate one with: npm run generate:secrets-key';

function getEncryptionKey() {
    const raw = process.env.PAGEINDEX_SECRETS_KEY?.trim();
    if (!raw) {
        const error = new Error(`PAGEINDEX_SECRETS_KEY is not configured. ${SECRETS_KEY_HINT}`);
        error.code = 'MISSING_SECRETS_KEY';
        throw error;
    }

    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
        const error = new Error(
            `PAGEINDEX_SECRETS_KEY must be a base64-encoded 32-byte key (decoded length is ${key.length}, expected 32). ${SECRETS_KEY_HINT}`,
        );
        error.code = 'INVALID_SECRETS_KEY';
        throw error;
    }

    return key;
}

function assertSecretsKeyConfigured() {
    getEncryptionKey();
}

function encryptSecret(plainText) {
    if (plainText == null || plainText === '') {
        return null;
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(String(plainText), 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptSecret(cipherText) {
    if (cipherText == null || cipherText === '') {
        return null;
    }

    const key = getEncryptionKey();
    const data = Buffer.from(cipherText, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]);

    return decrypted.toString('utf8');
}

export {
    encryptSecret,
    decryptSecret,
    getEncryptionKey,
    assertSecretsKeyConfigured,
};
