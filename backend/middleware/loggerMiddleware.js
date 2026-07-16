const PROBE_PATH =
    /^\/(\.env|\.git|wp-config|config\.(ya?ml|php)|application\.)/i;

export const isProbeRequest = (url) =>
    PROBE_PATH.test(url) || url.includes('/.env');

/** Reject proxy/internal addresses that are not usable client IPs. */
function isUsableIp(value) {
    if (!value || typeof value !== 'string') return false;
    const ip = value.trim();
    if (!ip || ip === 'unknown') return false;
    // Coolify/internal proxy peer — not a real client IP
    if (ip.startsWith('vsock:')) return false;
    return true;
}

function firstHeaderValue(header) {
    if (typeof header === 'string' && header.length > 0) {
        return header.split(',')[0].trim();
    }
    if (Array.isArray(header) && header[0]) {
        return String(header[0]).split(',')[0].trim();
    }
    return null;
}

/**
 * Resolve client IP behind Cloudflare → Coolify/nginx.
 * Prefer Cloudflare headers; skip vsock / loopback from internal hops.
 */
export function getClientIp(req) {
    const candidates = [
        firstHeaderValue(req.headers['cf-connecting-ip']),
        firstHeaderValue(req.headers['true-client-ip']),
        // XFF may be "client, proxy, vsock:2" — take first usable hop
        ...(typeof req.headers['x-forwarded-for'] === 'string'
            ? req.headers['x-forwarded-for'].split(',').map((p) => p.trim())
            : []),
        firstHeaderValue(req.headers['x-real-ip']),
        req.ip,
        req.socket?.remoteAddress,
    ];

    for (const candidate of candidates) {
        if (isUsableIp(candidate)) return candidate.trim();
    }

    return 'unknown';
}

const logger = (req, res, next) => {
    if (isProbeRequest(req.url)) {
        return next();
    }

    const start = Date.now();
    const path = req.originalUrl || req.url;

    res.on('finish', () => {
        const ms = Date.now() - start;
        const ip = getClientIp(req);
        console.log(`[BE] ${ip} ${req.method} ${path} ${res.statusCode} ${ms}ms`);
    });

    next();
};

export default logger;
