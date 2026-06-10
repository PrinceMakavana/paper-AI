const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

/**
 * Auth Middleware — Verifies JWT from Authorization header.
 * On success, attaches decoded payload to req.user: { userId, email, role }
 * Blocks unverified email addresses on protected routes.
 */
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. Invalid Credentials', status: 401 });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('isEmailVerified email').lean();

        if (!user) {
            return res.status(401).json({ message: 'User not found.', status: 401 });
        }

        if (!user.isEmailVerified) {
            return res.status(403).json({
                error: 'Please verify your email before continuing.',
                code: 'EMAIL_NOT_VERIFIED',
                email: user.email,
            });
        }

        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
        };
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token.', status: 401 });
    }
};

module.exports = authMiddleware;
