import express from 'express';
import * as userController from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import requireTurnstile from '../middleware/requireTurnstile.js';

const router = express.Router();

// Public routes (no auth required)
router.post('/users/register', requireTurnstile, userController.registerUser);
router.post('/users/login', requireTurnstile, userController.loginUser);
router.post('/users/google', userController.googleLogin);
router.post('/verify-email', userController.verifyEmail);
router.post('/resend-verification', userController.resendVerification);
router.post('/forgot-password', requireTurnstile, userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);

// Protected routes (JWT required)
router.post('/logout', authMiddleware, userController.logoutUser);
router.get('/users/profile', authMiddleware, userController.getProfile);
router.put('/users/profile', authMiddleware, userController.updateProfile);

export default router;
