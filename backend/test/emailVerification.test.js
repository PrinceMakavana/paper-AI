import tap from 'tap';
import supertest from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/userModel.js';
import { signEmailVerificationToken } from '../utils/authTokens.js';

const server = supertest(app);

const uniqueSuffix = Date.now();
const testUser = {
    name: 'Verify Test User',
    email: `verify_test_${uniqueSuffix}@example.com`,
    password: 'TestPass123',
};

async function waitForMongo() {
    if (mongoose.connection.readyState === 1) {
        return;
    }
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required for email verification tests');
    }
    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB_NAME || 'page-index-chatbot',
    });
}

tap.test('email verification flow', async (t) => {
    await waitForMongo();
    await User.deleteOne({ email: testUser.email });

    const registerResponse = await server.post('/users/register').send(testUser);
    t.equal(registerResponse.status, 201, 'register should succeed');
    t.notOk(registerResponse.body.token, 'register should not return a token');
    t.equal(registerResponse.body.email, testUser.email);

    const loginBeforeVerify = await server.post('/users/login').send({
        email: testUser.email,
        password: testUser.password,
    });
    t.equal(loginBeforeVerify.status, 403, 'login should be blocked before verification');
    t.equal(loginBeforeVerify.body.code, 'EMAIL_NOT_VERIFIED');
    t.equal(loginBeforeVerify.body.email, testUser.email);

    const user = await User.findOne({ email: testUser.email });
    t.ok(user, 'user should exist in database');
    t.equal(user.isEmailVerified, false);

    const verifyToken = signEmailVerificationToken(user._id);
    const verifyResponse = await server.post('/verify-email').send({ token: verifyToken });
    t.equal(verifyResponse.status, 200, 'verify should succeed');

    const verifyAgain = await server.post('/verify-email').send({ token: verifyToken });
    t.equal(verifyAgain.status, 409, 'verify again should report already verified');
    t.equal(verifyAgain.body.code, 'EMAIL_ALREADY_VERIFIED');
    t.equal(verifyAgain.body.redirect, '/login');

    const loginResponse = await server.post('/users/login').send({
        email: testUser.email,
        password: testUser.password,
    });
    t.equal(loginResponse.status, 200, 'login should succeed after verification');
    t.ok(loginResponse.body.token, 'login should return a token');
    t.equal(loginResponse.body.user.isEmailVerified, true);

    const authToken = loginResponse.body.token;
    const protectedResponse = await server
        .get('/paperai/documents')
        .set('Authorization', `Bearer ${authToken}`);
    t.not(protectedResponse.status, 403, 'verified user should access protected routes');

    const invalidVerify = await server.post('/verify-email').send({ token: 'invalid.token.value' });
    t.equal(invalidVerify.status, 400, 'invalid token should fail');

    const resendOne = await server.post('/resend-verification').send({ email: testUser.email });
    t.equal(resendOne.status, 409, 'resend should fail for verified user');
    t.equal(resendOne.body.code, 'EMAIL_ALREADY_VERIFIED');
    t.equal(resendOne.body.redirect, '/login');

    const resendMissing = await server.post('/resend-verification').send({ email: `missing_${uniqueSuffix}@example.com` });
    t.equal(resendMissing.status, 404, 'resend should fail for unknown email');
    t.equal(resendMissing.body.code, 'EMAIL_NOT_FOUND');
    t.equal(resendMissing.body.redirect, '/register');

    const unverifiedUser = {
        name: 'Resend Test User',
        email: `resend_test_${uniqueSuffix}@example.com`,
        password: 'TestPass123',
    };
    await server.post('/users/register').send(unverifiedUser);
    await User.updateOne(
        { email: unverifiedUser.email },
        { $set: { emailVerificationSentAt: new Date(Date.now() - 2 * 60 * 1000) } }
    );

    const resendFirst = await server.post('/resend-verification').send({ email: unverifiedUser.email });
    t.equal(resendFirst.status, 200, 'first resend should succeed');
    t.equal(resendFirst.body.code, 'EMAIL_SENT');
    t.equal(resendFirst.body.redirect, '/login');

    const resendSecond = await server.post('/resend-verification').send({ email: unverifiedUser.email });
    t.equal(resendSecond.status, 429, 'second immediate resend should be rate limited');

    const newEmail = `updated_${uniqueSuffix}@example.com`;
    const profileUpdate = await server
        .put('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: newEmail });
    t.equal(profileUpdate.status, 200, 'profile email update should succeed');
    t.equal(profileUpdate.body.user.isEmailVerified, false);

    const loginAfterEmailChange = await server.post('/users/login').send({
        email: newEmail,
        password: testUser.password,
    });
    t.equal(loginAfterEmailChange.status, 403, 'login should be blocked after email change');
    t.equal(loginAfterEmailChange.body.code, 'EMAIL_NOT_VERIFIED');

    await User.deleteOne({ email: testUser.email });
    await User.deleteOne({ email: unverifiedUser.email });
    await User.deleteOne({ email: newEmail });
    t.end();
});

tap.teardown(() => {
    process.exit(0);
});
