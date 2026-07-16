import { isTurnstileEnforced, verifyTurnstileFromRequest } from '../utils/turnstile.js';

const requireTurnstile = async (req, res, next) => {
    if (!isTurnstileEnforced()) {
        return next();
    }

    const { success } = await verifyTurnstileFromRequest(req);
    if (!success) {
        return res.status(403).json({
            error: 'Human verification failed. Please try again.',
            code: 'TURNSTILE_FAILED',
        });
    }

    return next();
};

export default requireTurnstile;
