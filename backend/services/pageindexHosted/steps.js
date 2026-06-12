import axios from 'axios';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PageIndexClient } from '@pageindex/sdk';
import { getToken, pollForMessage } from '../../utils/mailTmClient.js';
import { decryptSecret } from '../../utils/secretEncryption.js';

function noopLogger() {
    return {
        info: () => {},
        success: () => {},
        warn: () => {},
        error: () => {},
    };
}

function getLogger(logger) {
    return logger || noopLogger();
}

function getPageIndexBase() {
    const base = process.env.PAGEINDEX_API_URL;
    if (!base) {
        throw new Error('PAGEINDEX_API_URL is not configured');
    }
    return base;
}

function getPageIndexDashboard() {
    return process.env.PAGEINDEX_API_DASHBOARD_URL || 'https://dash.pageindex.ai';
}

function mergeCookieHeaders(...headers) {
    const jar = new Map();
    for (const header of headers) {
        if (!header) continue;
        header.split(';').forEach((part) => {
            const trimmed = part.trim();
            if (!trimmed) return;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) return;
            jar.set(trimmed.slice(0, eqIdx), trimmed.slice(eqIdx + 1));
        });
    }
    return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

function cookiesFromSetCookie(setCookieHeaders) {
    if (!setCookieHeaders) return '';
    const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    return list.map((c) => c.split(';')[0]).join('; ');
}

function extractOtp(content) {
    if (!content) return null;
    const match = content.match(/verification code is:\s*(\d{6})/i)
        || content.match(/\b(\d{6})\b/);
    return match?.[1] ?? null;
}

function extractResetPasswordLink(content) {
    if (!content) return null;
    const match = content.match(/https?:\/\/[^\s"'<>]+reset-password\?token=[a-f0-9]+/i);
    return match?.[0] ?? null;
}

function extractResetToken(resetPasswordLink) {
    if (!resetPasswordLink) return null;
    try {
        return new URL(resetPasswordLink).searchParams.get('token');
    } catch {
        const match = resetPasswordLink.match(/token=([a-f0-9]+)/i);
        return match?.[1] ?? null;
    }
}

function generateRandomPassword() {
    const uniquePart = crypto.randomBytes(10).toString('base64url');
    return `${uniquePart}@A1x`;
}

function generateRandomApiKeyName() {
    return `api-${crypto.randomBytes(8).toString('hex')}`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveMailTmCredentials(job) {
    const address = job.pageindex_email || job.input?.source_email;
    const password = decryptSecret(job.mailtm_password_enc);
    if (!address || !password) {
        throw new Error('Mail.tm credentials missing on job.');
    }
    return { address, password };
}

async function obtainChatSession(mailTmCredentials, logger) {
    const { address: pageindexEmail } = mailTmCredentials;
    const log = getLogger(logger);
    const pageIndexBase = getPageIndexBase();

    log.info('step1_account', 'Requesting CSRF token from PageIndex chat', {
        baseUrl: pageIndexBase,
    });

    const csrfResponse = await axios.get(`${pageIndexBase}/api/auth/csrf`, {
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    });

    const csrfToken = csrfResponse.data?.csrfToken;
    if (!csrfToken) {
        throw new Error('CSRF token missing from PageIndex response.');
    }

    log.success('step1_account', 'CSRF token received');

    let cookieHeader = cookiesFromSetCookie(csrfResponse.headers['set-cookie']);

    log.info('step1_account', 'Sending email sign-in request', {
        pageindexEmail,
    });

    const signinBody = new URLSearchParams({
        csrfToken,
        email: pageindexEmail,
        callbackUrl: '/',
        json: 'true',
    });

    const signinResponse = await axios.post(
        `${pageIndexBase}/api/auth/signin/email`,
        signinBody.toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
        },
    );

    log.success('step1_account', 'Sign-in email triggered', {
        status: signinResponse.status,
    });

    cookieHeader = mergeCookieHeaders(
        cookieHeader,
        cookiesFromSetCookie(signinResponse.headers['set-cookie']),
    );

    log.info('step1_account', 'Waiting 5s for verification email delivery');
    await sleep(5000);

    const token = await getToken(mailTmCredentials.address, mailTmCredentials.password);
    const message = await pollForMessage(token, {
        from: 'PageIndex',
        subject: '%Verification code%',
    }, getLogger(logger));
    const otp = extractOtp(message.content);
    if (!otp) {
        throw new Error('OTP not found in PageIndex verification email.');
    }

    log.success('step1_account', 'OTP extracted from verification email');

    const verifyBody = new URLSearchParams({
        email: pageindexEmail,
        code: otp,
        redirect: 'false',
        callbackUrl: '/chat',
        csrfToken,
        json: 'true',
    });

    const verifyResponse = await axios.post(
        `${pageIndexBase}/api/auth/callback/otp`,
        verifyBody.toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
        },
    );

    const sessionCookies = mergeCookieHeaders(
        cookieHeader,
        cookiesFromSetCookie(verifyResponse.headers['set-cookie']),
    );

    log.success('step1_account', 'OTP verification completed', {
        status: verifyResponse.status,
    });

    return {
        pageindexEmail,
        sessionCookies,
        verifyData: verifyResponse.data,
    };
}

async function runStep1Account(job, logger) {
    const log = getLogger(logger);
    const mailTmCredentials = resolveMailTmCredentials(job);
    const pageindexEmail = mailTmCredentials.address;

    log.info('step1_account', 'Starting account creation', {
        sourceEmail: job.input.source_email,
        pageindexEmail,
    });

    const { sessionCookies, verifyData } = await obtainChatSession(mailTmCredentials, logger);

    log.success('step1_account', 'Account creation step completed', {
        pageindexEmail,
    });

    return {
        pageindexEmail,
        sessionCookies,
        verifyData,
    };
}

async function runStep2Upload(job, sessionCookies, logger) {
    const log = getLogger(logger);

    if (!job.input.has_file || !job.file_staging_path) {
        log.warn('step2_upload', 'Upload step skipped (no file or staging path missing)', {
            hasFile: job.input?.has_file ?? false,
            fileStagingPath: job.file_staging_path || null,
        });
        return { skipped: true };
    }

    const pageIndexBase = getPageIndexBase();
    const buffer = await fs.readFile(job.file_staging_path);
    const fileName = job.input.original_filename || 'document.pdf';
    const mimeType = job.input.mime_type || 'application/pdf';

    log.info('step2_upload', 'Starting hosted file upload', {
        fileName,
        mimeType,
        fileSize: buffer.length,
        stagingPath: job.file_staging_path,
    });

    const chatHeaders = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(sessionCookies ? { Cookie: sessionCookies } : {}),
    };

    const signedUrlResponse = await axios.post(
        `${pageIndexBase}/api/orpc/file/getSignedUrl`,
        {
            json: {
                file: {
                    fileName,
                    fileType: mimeType,
                },
            },
        },
        { headers: chatHeaders },
    );

    const presignedUrl = signedUrlResponse.data?.json?.url;
    if (!presignedUrl) {
        throw new Error('Presigned upload URL missing from PageIndex response.');
    }

    log.success('step2_upload', 'Presigned upload URL received');
    log.info('step2_upload', 'Uploading PDF bytes to presigned URL');

    await axios.put(presignedUrl, buffer, {
        headers: { 'Content-Type': mimeType },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
    });

    log.success('step2_upload', 'PDF uploaded to presigned URL');

    const registerResponse = await axios.post(
        `${pageIndexBase}/api/orpc/file/upload`,
        {
            json: {
                file_name: fileName,
                mode: 'mcp',
                if_ocr: true,
            },
        },
        { headers: chatHeaders },
    );

    const result = registerResponse.data?.json;
    if (!result?.success) {
        throw new Error(result?.error || 'PageIndex file registration failed.');
    }

    log.success('step2_upload', 'File registered on PageIndex', {
        docId: result.doc_id,
        pageCount: result.page_count,
        estimatedTime: result.estimated_time,
    });

    return {
        docId: result.doc_id,
        pageCount: result.page_count,
        estimatedTime: result.estimated_time,
        fileName,
    };
}

async function runStep3Password(job, logger) {
    const log = getLogger(logger);
    const pageIndexDashboard = getPageIndexDashboard();
    const pageindexEmail = job.pageindex_email;

    log.info('step3_password', 'Requesting password reset email', {
        dashboardUrl: pageIndexDashboard,
        pageindexEmail,
    });

    await axios.post(
        `${pageIndexDashboard}/api/rpc/user/sendResetPassword`,
        { json: { email: pageindexEmail } },
        {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        },
    );

    log.success('step3_password', 'Password reset email requested');
    log.info('step3_password', 'Waiting 5s for reset email delivery');
    await sleep(5000);

    const mailTmCredentials = resolveMailTmCredentials(job);
    const token = await getToken(mailTmCredentials.address, mailTmCredentials.password);
    const message = await pollForMessage(token, {
        from: 'PageIndex',
        subject: '%Password Reset%',
    }, getLogger(logger));
    const resetPasswordLink = extractResetPasswordLink(message.content);
    if (!resetPasswordLink) {
        throw new Error('Reset password link not found in PageIndex email.');
    }

    const resetToken = extractResetToken(resetPasswordLink);
    if (!resetToken) {
        throw new Error('Reset password token not found in email link.');
    }

    log.success('step3_password', 'Reset token extracted from email');

    const password = generateRandomPassword();

    await axios.post(
        `${pageIndexDashboard}/api/rpc/user/resetPassword`,
        {
            json: {
                password,
                confirmPassword: password,
                token: resetToken,
            },
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        },
    );

    log.success('step3_password', 'Password reset completed');

    return { password };
}

async function loginPageIndexDashboard(pageIndexDashboard, email, password, logger) {
    const log = getLogger(logger);

    log.info('step4_1_login', 'Requesting dashboard CSRF token', {
        dashboardUrl: pageIndexDashboard,
    });

    const csrfResponse = await axios.get(`${pageIndexDashboard}/api/auth/csrf`, {
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    });

    const csrfToken = csrfResponse.data?.csrfToken;
    if (!csrfToken) {
        throw new Error('CSRF token missing from PageIndex dashboard response.');
    }

    const cookieHeader = cookiesFromSetCookie(csrfResponse.headers['set-cookie']);

    const loginBody = new URLSearchParams({
        email,
        password,
        redirect: 'false',
        callbackUrl: '/',
        csrfToken,
        json: 'true',
    });

    log.info('step4_1_login', 'Logging into PageIndex dashboard', { email });

    const loginResponse = await axios.post(
        `${pageIndexDashboard}/api/auth/callback/password`,
        loginBody.toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
        },
    );

    log.success('step4_1_login', 'Dashboard login successful', {
        status: loginResponse.status,
    });

    return {
        loginData: loginResponse.data,
        dashboardSessionCookies: mergeCookieHeaders(
            cookieHeader,
            cookiesFromSetCookie(loginResponse.headers['set-cookie']),
        ),
    };
}

async function runStep4_1Login(job, password, logger) {
    const pageIndexDashboard = getPageIndexDashboard();
    return loginPageIndexDashboard(pageIndexDashboard, job.pageindex_email, password, logger);
}

async function runStep4_2ApiKey(job, dashboardSessionCookies, apiKeyName, logger) {
    const log = getLogger(logger);
    const pageIndexDashboard = getPageIndexDashboard();
    const name = apiKeyName || generateRandomApiKeyName();

    log.info('step4_2_api_key', 'Creating PageIndex API key', { apiKeyName: name });

    const apiKeyResponse = await axios.post(
        `${pageIndexDashboard}/api/rpc/apiKey/create`,
        { json: { name } },
        {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(dashboardSessionCookies ? { Cookie: dashboardSessionCookies } : {}),
            },
        },
    );

    const apiKey = apiKeyResponse.data?.json?.apiKey ?? null;
    if (!apiKey) {
        throw new Error('API key missing from PageIndex dashboard response.');
    }

    log.success('step4_2_api_key', 'API key created', {
        apiKeyName: name,
        apiKeyPrefix: `${apiKey.slice(0, 8)}…`,
    });

    return {
        apiKeyName: name,
        apiKey,
        apiKeyData: apiKeyResponse.data,
    };
}

async function runStep4_3Tree(job, apiKey, logger) {
    const log = getLogger(logger);

    if (!job.hosted_document_id || !apiKey) {
        log.warn('step4_3_tree', 'Tree fetch skipped (missing doc id or API key)', {
            hostedDocumentId: job.hosted_document_id || null,
            hasApiKey: Boolean(apiKey),
        });
        return { skipped: true };
    }

    const pollIntervalMs = 3000;
    const estimatedTime = job.estimated_time || 30;
    const maxAttempts = Math.max(
        Math.ceil((estimatedTime * 1000) / pollIntervalMs) + 2,
        5,
    );

    const client = new PageIndexClient({ apiKey });
    const docId = job.hosted_document_id;

    log.info('step4_3_tree', 'Polling document tree from PageIndex SDK', {
        docId,
        maxAttempts,
        pollIntervalMs,
        estimatedTime,
    });

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const treeData = await client.api.getTree(docId);

        log.info('step4_3_tree', 'Tree poll response received', {
            attempt: attempt + 1,
            status: treeData?.status || 'unknown',
            retrievalReady: treeData?.retrieval_ready ?? null,
        });

        if (treeData?.status === 'completed') {
            const nodeCount = Array.isArray(treeData.result) ? treeData.result.length : 0;
            log.success('step4_3_tree', 'Document tree indexing completed', {
                docId: treeData.doc_id || docId,
                rootNodeCount: nodeCount,
                retrievalReady: treeData.retrieval_ready ?? null,
            });

            return {
                success: true,
                status: treeData.status,
                docId: treeData.doc_id || docId,
                tree: treeData.result ?? null,
                retrievalReady: treeData.retrieval_ready ?? null,
            };
        }

        if (attempt < maxAttempts - 1) {
            await sleep(pollIntervalMs);
        } else {
            throw new Error(
                treeData?.status
                    ? `Document tree indexing did not complete (status: ${treeData.status}).`
                    : 'Document tree indexing did not complete within timeout.',
            );
        }
    }

    throw new Error('Document tree fetch failed.');
}

export {
    resolveMailTmCredentials,
    obtainChatSession,
    runStep1Account,
    runStep2Upload,
    runStep3Password,
    runStep4_1Login,
    runStep4_2ApiKey,
    runStep4_3Tree,
    generateRandomApiKeyName,
};
