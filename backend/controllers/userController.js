const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

const mapUserForClient = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    available_token_count: user.available_token_count ?? 0,
    available_page_count: user.available_page_count ?? 0,
});

// Helper — generate a signed JWT for a user document
const generateToken = (user) => {
    return jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

/**
 * POST /users/register
 * Register a new user account.
 * Body: { name, email, password }
 */
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }

        // Check for duplicate email
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        // Create user — password is hashed by the pre-save hook
        const user = await User.create({ name, email, password });

        const token = generateToken(user);

        
        res.status(201).json({
            message: 'User registered successfully.',
            token,
            user: mapUserForClient(user),
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

        // Find user — include password field for comparison (excluded by default)
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = generateToken(user);
        const profile = await User.findById(user._id).select('-password').lean();

        res.status(200).json({
            message: 'Login successful.',
            token,
            user: mapUserForClient(profile),
        });
    } catch (err) {
        res.status(500).json({ error: 'Login failed.', details: err.message });
    }
};

/**
 * POST /logout
 * Logout the authenticated user.
 * Requires: Authorization: Bearer <token>
 *
 * JWTs are stateless in this app, so token removal happens on the client.
 * This endpoint confirms the supplied token is valid and gives the client a
 * consistent API response for the logout flow.
 */
const logoutUser = async (req, res) => {
    res.status(200).json({ message: 'Logout successful.' });
};

/**
 * GET /users/profile
 * Get the authenticated user's profile.
 * Requires: Authorization: Bearer <token>
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
 * Requires: Authorization: Bearer <token>
 * Body: { name?, email? }
 */
const updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;

        // Build update object with only allowed fields
        const updates = {};
        if (name) updates.name = name.trim();
        if (email) {
            // Check new email is not already taken by another user
            const emailTaken = await User.findOne({
                email: email.toLowerCase(),
                _id: { $ne: req.user.userId },
            });
            if (emailTaken) {
                return res.status(409).json({ error: 'Email is already in use by another account.' });
            }
            updates.email = email.toLowerCase().trim();
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Provide at least one field to update (name or email).' });
        }

        const user = await User.findByIdAndUpdate(req.user.userId, updates, {
            new: true,
            runValidators: true,
        }).select('-password').lean();

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json({
            message: 'Profile updated successfully.',
            user: mapUserForClient(user),
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not update profile.', details: err.message });
    }
};

// 1. Request Password Reset
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
        }

        const resetToken = jwt.sign(
            { userId: user._id, type: 'password_reset' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        console.log(`Reset Token for ${email}: ${resetToken}`);

        res.status(200).json({ message: 'Reset link generated successfully.',token: resetToken });
    } catch (err) {
        res.status(500).json({ error: 'Error initiating reset.', details: err.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type !== 'password_reset') {
            return res.status(400).json({ error: 'Invalid reset token type.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        const user = await User.findByIdAndUpdate(decoded.userId, { 
            password: hashedPassword 
        });

        if (!user) {
            return res.status(404).json({ error: 'User no longer exists.' });
        }

        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error("Reset Error:", err.message);
       return res.status(400).json({ 
        error: 'Token validation failed', 
        details: err.message 
    });
    }
};
module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    getProfile,
    updateProfile,
    forgotPassword,
    resetPassword
};
