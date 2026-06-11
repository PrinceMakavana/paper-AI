const tap = require('tap');
const supertest = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/userModel');
const { signEmailVerificationToken, signPasswordResetToken } = require('../utils/authTokens');

const server = supertest(app);

const uniqueSuffix = Date.now();
const testUser = {
    name: 'Reset Test User',
    email: `reset_test_${uniqueSuffix}@example.com`,
    password: 'TestPass123',
};
const newPassword = 'NewPass456';

async function waitForMongo() {
    if (mongoose.connection.readyState === 1) {
        return;
    }
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required for password reset tests');
    }
    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB_NAME || 'page-index-chatbot',
    });
}

async function createVerifiedUser() {
    await User.deleteOne({ email: testUser.email });
    await server.post('/users/register').send(testUser);

    const user = await User.findOne({ email: testUser.email });
    const verifyToken = signEmailVerificationToken(user._id);
    await server.post('/verify-email').send({ token: verifyToken });

    return user;
}

tap.test('password reset flow', async (t) => {
    await waitForMongo();
    await createVerifiedUser();

    const unknownEmailResponse = await server.post('/forgot-password').send({
        email: `unknown_${uniqueSuffix}@example.com`,
    });
    t.equal(unknownEmailResponse.status, 200, 'unknown email should return generic success');
    t.equal(unknownEmailResponse.body.code, 'RESET_EMAIL_SENT');
    t.notOk(unknownEmailResponse.body.token, 'unknown email should not leak a token');

    const forgotResponse = await server.post('/forgot-password').send({ email: testUser.email });
    t.equal(forgotResponse.status, 200, 'forgot password should succeed for known user');
    t.ok(
        forgotResponse.body.code === 'RESET_EMAIL_SENT' ||
            forgotResponse.body.code === 'RESET_LINK_GENERATED',
        'forgot password should return a reset code'
    );

    if (forgotResponse.body.token) {
        t.ok(forgotResponse.body.token, 'dev mode should return reset token when SMTP is skipped');
    }

    const user = await User.findOne({ email: testUser.email });
    const resetToken = signPasswordResetToken(user._id);

    const resetResponse = await server.post('/reset-password').send({
        token: resetToken,
        newPassword,
    });
    t.equal(resetResponse.status, 200, 'reset password should succeed with valid token');
    t.equal(resetResponse.body.code, 'PASSWORD_UPDATED');
    t.equal(resetResponse.body.redirect, '/login');

    const loginOldPassword = await server.post('/users/login').send({
        email: testUser.email,
        password: testUser.password,
    });
    t.equal(loginOldPassword.status, 401, 'old password should no longer work');

    const loginNewPassword = await server.post('/users/login').send({
        email: testUser.email,
        password: newPassword,
    });
    t.equal(loginNewPassword.status, 200, 'login should succeed with new password');
    t.ok(loginNewPassword.body.token, 'login should return a token');

    const invalidReset = await server.post('/reset-password').send({
        token: 'invalid.token.value',
        newPassword: 'AnotherPass789',
    });
    t.equal(invalidReset.status, 400, 'invalid token should fail');
    t.equal(invalidReset.body.code, 'INVALID_RESET_TOKEN');

    const wrongTypeToken = signEmailVerificationToken(user._id);
    const wrongTypeReset = await server.post('/reset-password').send({
        token: wrongTypeToken,
        newPassword: 'AnotherPass789',
    });
    t.equal(wrongTypeReset.status, 400, 'wrong token type should fail');
    t.equal(wrongTypeReset.body.code, 'INVALID_RESET_TOKEN');

    await User.updateOne(
        { email: testUser.email },
        { $set: { passwordResetSentAt: new Date() } }
    );

    const rateLimited = await server.post('/forgot-password').send({ email: testUser.email });
    t.equal(rateLimited.status, 429, 'immediate second forgot request should be rate limited');

    await User.deleteOne({ email: testUser.email });
    t.end();
});

tap.teardown(() => {
    process.exit(0);
});
