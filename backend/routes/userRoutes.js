const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes (no auth required)
router.post('/users/register', userController.registerUser);
router.post('/users/login', userController.loginUser);
router.post('/verify-email', userController.verifyEmail);
router.post('/resend-verification', userController.resendVerification);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);

// Protected routes (JWT required)
router.post('/logout', authMiddleware, userController.logoutUser);
router.get('/users/profile', authMiddleware, userController.getProfile);
router.put('/users/profile', authMiddleware, userController.updateProfile);

module.exports = router;
