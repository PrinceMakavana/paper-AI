const PROBE_PATH =
    /^\/(\.env|\.git|wp-config|config\.(ya?ml|php)|application\.)/i;

export const isProbeRequest = (url) =>
    PROBE_PATH.test(url) || url.includes('/.env');

/**
 * Resolve client IP behind reverse proxies (Coolify/nginx).
 * Relies on app.set('trust proxy', ...) so req.ip is the leftmost X-Forwarded-For hop.
 */
export function getClientIp(req) {
    if (req.ip) return req.ip;

    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
        return String(forwarded[0]).split(',')[0].trim();
    }

    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.length > 0) {
        return realIp.trim();
    }

    return req.socket?.remoteAddress || 'unknown';
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
