import crypto from 'node:crypto';
import { createAccount, getToken } from './mailTmClient.js';

function sanitizeLocalPart(value) {
    const cleaned = (value || '')
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
        .slice(0, 32);
    return cleaned || '';
}

function deriveLocalPart(optionalEmail) {
    const suffix = crypto.randomBytes(4).toString('hex');
    if (!optionalEmail || !optionalEmail.includes('@')) {
        return `${suffix}`;
    }
    const localPart = sanitizeLocalPart(optionalEmail.split('@')[0]);
    return `${localPart}${suffix}`;
}

async function provisionMailTmInbox(optionalEmail) {
    const localPart = deriveLocalPart(optionalEmail);
    const { address, password } = await createAccount({ localPart });
    await getToken(address, password);
    return { address, password };
}

export {
    deriveLocalPart,
    provisionMailTmInbox,
    sanitizeLocalPart,
};
