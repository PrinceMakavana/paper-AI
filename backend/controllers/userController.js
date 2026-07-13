import User from '../models/userModel.js';
import { verifyGoogleIdToken } from '../utils/googleAuth.js';
import {
    TOKEN_TYPES,
    verifyAuthToken,
    signEmailVerificationToken,
    signPasswordResetToken,
    signSessionToken,
} from '../utils/authTokens.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/emailService.js';

const RESEND_COOLDOWN_MS = 60 * 1000;

const mapUserForClient = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified ?? false,
    is_google_account: user.is_google_account ?? false,
    available_token_count: user.available_token_count ?? 0,
    available_page_count: user.available_page_count ?? 0,
});

async function sendVerificationEmailToUser(user, { enforceCooldown = false } = {}) {
    const now = Date.now();
    if (enforceCooldown && user.emailVerificationSentAt) {
        const elapsed = now - new Date(user.emailVerificationSentAt).getTime();
        if (elapsed < RESEND_COOLDOWN_MS) {
            const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
            const error = new Error('RATE_LIMITED');
            error.retryAfterSeconds = retryAfterSeconds;
            throw error;
        }
    }

    const token = signEmailVerificationToken(user._id);
    await sendVerificationEmail(user.email, token);
    user.emailVerificationSentAt = new Date();
    await user.save();
}

async function sendPasswordResetEmailToUser(user, { enforceCooldown = false } = {}) {
    const now = Date.now();
    if (enforceCooldown && user.passwordResetSentAt) {
        const elapsed = now - new Date(user.passwordResetSentAt).getTime();
        if (elapsed < RESEND_COOLDOWN_MS) {
            const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
            const error = new Error('RATE_LIMITED');
            error.retryAfterSeconds = retryAfterSeconds;
            throw error;
        }
    }

    const resetToken = signPasswordResetToken(user._id);
    const result = await sendPasswordResetEmail(user.email, resetToken);
    user.passwordResetSentAt = new Date();
    await user.save();

    return { resetToken, result };
}

/**
 * POST /users/register
 * Register a new user account.
 * Body: { name, email, password }
 */
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(409).json({
                error: 'An account with this email already exists. Log in or resend verification.',
            });
        }

        const user = await User.create({ name, email: normalizedEmail, password });

        try {
            await sendVerificationEmailToUser(user);
        } catch (err) {
            console.error('Failed to send verification email:', err.message);
        }

        res.status(201).json({
            message: 'Account created. Please check your email to verify your account.',
            email: user.email,
        });
    } catch (err) {
        res.status(500).json({ error: 'Registration failed.', details: err.message });
    }
};

/**
 * POST /users/login
 * Authenticate a user and return a JWT.
 * Body: { email, password }
 */
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        if (user.is_google_account && !user.password) {
            return res.status(400).json({
                error: 'This account is linked with Google only. Please sign in with Google.',
                code: 'USE_GOOGLE_LOGIN',
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        if (!user.isEmailVerified) {
            return res.status(403).json({
                error: 'Please verify your email before logging in.',
                code: 'EMAIL_NOT_VERIFIED',
                email: user.email,
            });
        }

        const token = signSessionToken(user);
        const profile = await User.findById(user._id).select('-password').lean();
        const clientUser = mapUserForClient(profile);

        if (profile.isAdmin === true) {
            clientUser.isAdmin = true;
        }

        res.status(200).json({
            message: 'Login successful.',
            token,
            user: clientUser,
        });
    } catch (err) {
        res.status(500).json({ error: 'Login failed.', details: err.message });
    }
};

/**
 * POST /users/google
 * Authenticate or register via Google ID token.
 * Body: { idToken }
 */
const googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: 'Google ID token is required.' });
        }

        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(500).json({ error: 'Google Sign-In is not configured.' });
        }

        let payload;
        try {
            payload = await verifyGoogleIdToken(idToken, process.env.GOOGLE_CLIENT_ID);
        } catch (err) {
            return res.status(401).json({ error: 'Invalid Google token.', details: err.message });
        }

        const { sub: googleId, email, name, email_verified: emailVerified } = payload;

        if (!email || !googleId) {
            return res.status(400).json({ error: 'Google account is missing required profile information.' });
        }

        if (!emailVerified) {
            return res.status(403).json({ error: 'Google email is not verified.' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        let user = await User.findOne({ googleId });
        if (!user) {
            user = await User.findOne({ email: normalizedEmail });
        }

        if (user) {
            user.googleId = googleId;
            user.is_google_account = true;
            user.isEmailVerified = true;
            if (name && !user.name) {
                user.name = name;
            }
            await user.save();
        } else {
            user = await User.create({
                name: name || normalizedEmail.split('@')[0],
                email: normalizedEmail,
                googleId,
                is_google_account: true,
                isEmailVerified: true,
            });
        }

        const token = signSessionToken(user);
        const profile = await User.findById(user._id).select('-password').lean();
        const clientUser = mapUserForClient(profile);

        if (profile.isAdmin === true) {
            clientUser.isAdmin = true;
        }

        res.status(200).json({
            message: 'Login successful.',
            token,
            user: clientUser,
        });
    } catch (err) {
        res.status(500).json({ error: 'Google sign-in failed.', details: err.message });
    }
};

/**
 * POST /logout
 * Logout the authenticated user.
 */
const logoutUser = async (req, res) => {
    res.status(200).json({ message: 'Logout successful.' });
};

/**
 * GET /users/profile
 * Get the authenticated user's profile.
 */
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password').lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json({ user: mapUserForClient(user) });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch profile.', details: err.message });
    }
};

/**
 * PUT /users/profile
 * Update the authenticated user's name and/or email.
 */
const updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        const currentUser = await User.findById(req.user.userId);

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const updates = {};
        let emailChanged = false;

        if (name) {
            updates.name = name.trim();
        }

        if (email) {
            const normalizedEmail = email.toLowerCase().trim();
            const emailTaken = await User.findOne({
                email: normalizedEmail,
                _id: { $ne: req.user.userId },
            });
            if (emailTaken) {
                return res.status(409).json({ error: 'Email is already in use by another account.' });
            }
            if (normalizedEmail !== currentUser.email) {
                updates.email = normalizedEmail;
                updates.isEmailVerified = false;
                emailChanged = true;
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Provide at least one field to update (name or email).' });
        }

        Object.assign(currentUser, updates);
        await currentUser.save();

        if (emailChanged) {
            try {
                await sendVerificationEmailToUser(currentUser);
            } catch (err) {
                console.error('Failed to send verification email after profile update:', err.message);
            }
        }

        const user = await User.findById(currentUser._id).select('-password').lean();

        res.status(200).json({
            message: emailChanged
                ? 'Profile updated. Please verify your new email address before logging in again.'
                : 'Profile updated successfully.',
            user: mapUserForClient(user),
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not update profile.', details: err.message });
    }
};

/**
 * POST /verify-email
 * Body: { token }
 */
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Verification token is required.' });
        }

        let decoded;
        try {
            decoded = verifyAuthToken(token);
        } catch (err) {
            return res.status(400).json({ error: 'Invalid or expired verification link.', details: err.message });
        }

        if (decoded.type !== TOKEN_TYPES.EMAIL_VERIFICATION) {
            return res.status(400).json({ error: 'Invalid verification token type.' });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                error: 'No account found for this verification link.',
                code: 'EMAIL_NOT_FOUND',
                redirect: '/register',
            });
        }

        if (user.isEmailVerified) {
            return res.status(409).json({
                error: 'Email is already verified. Please log in.',
                code: 'EMAIL_ALREADY_VERIFIED',
                redirect: '/login',
            });
        }

        user.isEmailVerified = true;
        await user.save();

        res.status(200).json({
            message: 'Email verified successfully. You can log in now.',
            code: 'EMAIL_VERIFIED',
            redirect: '/login',
        });
    } catch (err) {
        res.status(500).json({ error: 'Email verification failed.', details: err.message });
    }
};

/**
 * POST /resend-verification
 * Body: { email }
 */
const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({
                error: 'No account found with this email. Please register first.',
                code: 'EMAIL_NOT_FOUND',
                redirect: '/register',
            });
        }

        if (user.isEmailVerified) {
            return res.status(409).json({
                error: 'Email is already verified. Please log in.',
                code: 'EMAIL_ALREADY_VERIFIED',
                redirect: '/login',
            });
        }

        try {
            await sendVerificationEmailToUser(user, { enforceCooldown: true });
        } catch (err) {
            if (err.message === 'RATE_LIMITED') {
                return res.status(429).json({
                    error: 'Please wait before requesting another verification email.',
                    retryAfterSeconds: err.retryAfterSeconds,
                });
            }
            console.error('Failed to resend verification email:', err.message);
            return res.status(500).json({ error: 'Could not send verification email.' });
        }

        res.status(200).json({
            message: 'Verification email sent. Please check your inbox.',
            code: 'EMAIL_SENT',
            redirect: '/login',
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not resend verification email.', details: err.message });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(200).json({
                message: 'If an account exists, a reset link has been sent.',
                code: 'RESET_EMAIL_SENT',
            });
        }

        try {
            const { resetToken, result } = await sendPasswordResetEmailToUser(user, { enforceCooldown: true });

            if (result?.skipped) {
                console.log(`Reset Token for ${normalizedEmail}: ${resetToken}`);
                return res.status(200).json({
                    message: 'Reset link generated successfully.',
                    code: 'RESET_LINK_GENERATED',
                    token: resetToken,
                });
            }

            return res.status(200).json({
                message: 'If an account exists, a reset link has been sent.',
                code: 'RESET_EMAIL_SENT',
            });
        } catch (err) {
            if (err.message === 'RATE_LIMITED') {
                return res.status(429).json({
                    error: 'Please wait before requesting another reset email.',
                    retryAfterSeconds: err.retryAfterSeconds,
                });
            }
            console.error('Failed to send password reset email:', err.message);
            return res.status(500).json({ error: 'Could not send reset email.' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Error initiating reset.', details: err.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        let decoded;
        try {
            decoded = verifyAuthToken(token);
        } catch (err) {
            const code = err.name === 'TokenExpiredError' ? 'RESET_TOKEN_EXPIRED' : 'INVALID_RESET_TOKEN';
            return res.status(400).json({
                error: 'Invalid or expired reset link.',
                code,
                details: err.message,
            });
        }

        if (decoded.type !== TOKEN_TYPES.PASSWORD_RESET) {
            return res.status(400).json({
                error: 'Invalid reset token type.',
                code: 'INVALID_RESET_TOKEN',
            });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ error: 'User no longer exists.' });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            message: 'Password updated successfully.',
            code: 'PASSWORD_UPDATED',
            redirect: '/login',
        });
    } catch (err) {
        console.error('Reset Error:', err.message);
        return res.status(400).json({
            error: 'Password reset failed.',
            code: 'INVALID_RESET_TOKEN',
            details: err.message,
        });
    }
};

export {
    registerUser,
    loginUser,
    googleLogin,
    logoutUser,
    getProfile,
    updateProfile,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
};
