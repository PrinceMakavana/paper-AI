import jwt from 'jsonwebtoken';

const TOKEN_TYPES = {
    EMAIL_VERIFICATION: 'email_verification',
    PASSWORD_RESET: 'password_reset',
};

function signAuthToken(payload, expiresIn) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

function verifyAuthToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}

function signEmailVerificationToken(userId) {
    return signAuthToken(
        { userId, type: TOKEN_TYPES.EMAIL_VERIFICATION },
        process.env.EMAIL_VERIFICATION_EXPIRES_IN || '24h'
    );
}

function signPasswordResetToken(userId) {
    return signAuthToken(
        { userId, type: TOKEN_TYPES.PASSWORD_RESET },
        process.env.PASSWORD_RESET_EXPIRES_IN || '15m'
    );
}

function signSessionToken(user) {
    return jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

export {
    TOKEN_TYPES,
    signAuthToken,
    verifyAuthToken,
    signEmailVerificationToken,
    signPasswordResetToken,
    signSessionToken,
};
