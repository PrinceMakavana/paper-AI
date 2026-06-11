const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        available_token_count: {
            type: Number,
            required: true,
            default: 50000,
        },
        available_page_count: {
            type: Number,
            required: true,
            default: 300,
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        emailVerificationSentAt: {
            type: Date,
        },
        passwordResetSentAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

// Hash password before saving (only when modified)
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Instance method to compare passwords on login
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
