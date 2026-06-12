import axios from 'axios';
import crypto from 'node:crypto';

const DEFAULT_BASE_URL = 'https://api.mail.tm';

let requestQueue = Promise.resolve();

function getBaseUrl() {
    return (process.env.MAILTM_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function withRequestLock(fn) {
    const run = requestQueue.then(fn, fn);
    requestQueue = run.then(() => {}, () => {});
    return run;
}

function authHeaders(token) {
    return {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}

function handleApiError(error, context) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail
        || error.response?.data?.message
        || error.message;

    if (status === 429) {
        throw new Error(`Mail.tm rate limit exceeded during ${context}: ${detail}`);
    }
    if (status === 401) {
        throw new Error(`Mail.tm authentication failed during ${context}: ${detail}`);
    }
    if (status === 422) {
        throw new Error(`Mail.tm validation error during ${context}: ${detail}`);
    }

    throw new Error(`Mail.tm ${context} failed: ${detail}`);
}

async function getAvailableDomain() {
    try {
        const response = await axios.get(`${getBaseUrl()}/domains`, {
            headers: { Accept: 'application/json' },
        });
        console.log(response.data);
        const domains = response.data || [];
        const active = domains.find((item) => item.isActive);
        console.log("active domain", active);
        if (!active?.domain) {
            throw new Error('No active Mail.tm domain available.');
        }
        return active.domain;
    } catch (error) {
        if (error.message?.startsWith('Mail.tm') || error.message?.includes('No active')) {
            throw error;
        }
        handleApiError(error, 'domain lookup');
    }
}

function generateAccountPassword() {
    return `${crypto.randomBytes(16).toString('base64url')}Aa1!`;
}

async function createAccount({ localPart, domain }) {
    const resolvedDomain = domain || await getAvailableDomain();
    const address = `${localPart}@${resolvedDomain}`;
    const password = generateAccountPassword();

    try {
        await axios.post(
            `${getBaseUrl()}/accounts`,
            { address, password },
            { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } },
        );
    } catch (error) {
        handleApiError(error, 'account creation');
    }

    return { address, password };
}

async function getToken(address, password) {
    try {
        const response = await axios.post(
            `${getBaseUrl()}/token`,
            { address, password },
            { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } },
        );
        const token = response.data?.token;
        if (!token) {
            throw new Error('Mail.tm token missing from response.');
        }
        return token;
    } catch (error) {
        if (error.message?.includes('token missing')) {
            throw error;
        }
        handleApiError(error, 'token request');
    }
}

async function listMessages(token) {
    return withRequestLock(async () => {
        try {
            const response = await axios.get(`${getBaseUrl()}/messages`, {
                headers: authHeaders(token),
            });
            return response.data || [];
        } catch (error) {
            handleApiError(error, 'message list');
        }
    });
}

async function getMessage(token, messageId) {
    return withRequestLock(async () => {
        try {
            const response = await axios.get(`${getBaseUrl()}/messages/${messageId}`, {
                headers: authHeaders(token),
            });
            return response.data;
        } catch (error) {
            handleApiError(error, 'message fetch');
        }
    });
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function subjectMatches(subject, pattern) {
    if (!pattern) return true;
    if (pattern.includes('%')) {
        const regex = new RegExp(
            `^${pattern.split('%').map(escapeRegex).join('.*')}$`,
            'i',
        );
        return regex.test(subject || '');
    }
    return (subject || '').toLowerCase() === pattern.toLowerCase();
}

function fromMatches(messageFrom, expectedFrom) {
    if (!expectedFrom) return true;
    const name = messageFrom?.name || '';
    const address = messageFrom?.address || '';
    const haystack = `${name} ${address}`.toLowerCase();
    return haystack.includes(expectedFrom.toLowerCase());
}

function messageContent(message) {
    if (message?.text) {
        return message.text;
    }
    if (Array.isArray(message?.html)) {
        return message.html.join('');
    }
    return message?.intro || '';
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForMessage(token, { from, subject }, logger, attempt = 0) {
    console.log("pollForMessage  => ", token, from, subject);
    const log = logger || { info: () => {}, success: () => {} };
    const messages = await listMessages(token);
    console.log("messages => ", messages);
    const matched = messages.find((item) => (
        fromMatches(item.from, from) && subjectMatches(item.subject, subject)
    ));

    if (matched) {
        const fullMessage = await getMessage(token, matched.id);
        log.success('mailtm', 'Verification email found in Mail.tm inbox', {
            subject,
            attempt: attempt + 1,
            emailId: matched.id,
        });
        return {
            id: matched.id,
            content: messageContent(fullMessage),
        };
    }

    if (attempt >= 5) {
        throw new Error(`PageIndex email not found in Mail.tm inbox (subject: ${subject}).`);
    }

    log.info('mailtm', 'Email not found yet, retrying Mail.tm poll', {
        subject,
        attempt: attempt + 1,
        nextRetryInSec: 5,
    });

    await sleep(5000);
    return pollForMessage(token, { from, subject }, logger, attempt + 1);
}

export {
    getAvailableDomain,
    createAccount,
    getToken,
    listMessages,
    getMessage,
    pollForMessage,
    subjectMatches,
    fromMatches,
    messageContent,
};
