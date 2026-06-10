const express = require('express');
const router = express.Router();

router.post('/pageindex/register', (req, res) => {
    return res.status(410).json({
        message: 'This endpoint is deprecated. Use POST /pageindex/hosted-jobs with JWT authentication instead.',
        replacement: '/pageindex/hosted-jobs',
    });
});

module.exports = router;
