const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileEnforced() {
    if (process.env.NODE_ENV === 'test') {
        return false;
    }
    return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export function getClientIp(req) {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) {
        return cfIp.trim();
    }

    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
        return xForwardedFor.split(',')[0].trim();
    }

    return req.ip || req.socket?.remoteAddress || '';
}

export async function verifyTurnstileToken(token, remoteip = '') {
    if (!isTurnstileEnforced()) {
        return true;
    }

    if (!token || typeof token !== 'string') {
        return false;
    }

    const secret = process.env.TURNSTILE_SECRET_KEY.trim();
    const body = new URLSearchParams({
        secret,
        response: token,
    });

    if (remoteip) {
        body.set('remoteip', remoteip);
    }

    const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!response.ok) {
        return false;
    }

    const data = await response.json();
    return data.success === true;
}

export async function verifyTurnstileFromRequest(req) {
    const token = req.body?.turnstileToken;
    const success = await verifyTurnstileToken(token, getClientIp(req));
    return { success };
}
