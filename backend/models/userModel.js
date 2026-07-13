import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
            required: function () {
                return !this.is_google_account;
            },
            minlength: [6, 'Password must be at least 6 characters'],
        },
        googleId: {
            type: String,
            sparse: true,
            unique: true,
        },
        is_google_account: {
            type: Boolean,
            default: false,
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        isAdmin: {
            type: Boolean,
            default: false,
        },
        available_token_count: {
            type: Number,
            required: true,
            default: 5000,
        },
        available_page_count: {
            type: Number,
            required: true,
            default: 30,
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
    if (!this.isModified('password') || !this.password) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Instance method to compare passwords on login
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
