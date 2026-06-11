const express = require('express');
const { registerRoutes } = require('../utils/registerApiRoutes');

const router = express.Router();

function deprecatedRegister(req, res) {
    return res.status(410).json({
        message: 'This endpoint is deprecated. Use POST /paperai/hosted-jobs with JWT authentication instead.',
        replacement: '/paperai/hosted-jobs',
    });
}

registerRoutes(router, 'post', '/register', deprecatedRegister);

module.exports = router;
