import express from 'express';
import { registerRoutes } from '../utils/registerApiRoutes.js';

const router = express.Router();

function deprecatedRegister(req, res) {
    return res.status(410).json({
        message: 'This endpoint is deprecated. Use POST /paperai/hosted-jobs with JWT authentication instead.',
        replacement: '/paperai/hosted-jobs',
    });
}

registerRoutes(router, 'post', '/register', deprecatedRegister);

export default router;
