const jwt = require('jsonwebtoken');

/**
 * Auth Middleware — Verifies JWT from Authorization header.
 * On success, attaches decoded payload to req.user: { userId, email, role }
 */
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. Invalid Credentials', status: 401 });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
