import tap from 'tap';
import express from 'express';
import supertest from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import * as userController from '../controllers/userController.js';
import {
    __setGoogleAuthVerifierForTests,
} from '../utils/googleAuth.js';

dotenv.config();
process.env.NODE_ENV = 'test';

const uniqueSuffix = Date.now();
const password = 'TestPass123';
const googleClientId = 'test-google-client-id.apps.googleusercontent.com';

const newGoogleUser = {
    email: `google_new_${uniqueSuffix}@example.com`,
    googleId: `google-sub-new-${uniqueSuffix}`,
    name: 'Google New User',
};

const linkGoogleUser = {
    email: `google_link_${uniqueSuffix}@example.com`,
    googleId: `google-sub-link-${uniqueSuffix}`,
    name: 'Google Link User',
};

const googleOnlyUser = {
    email: `google_only_${uniqueSuffix}@example.com`,
    googleId: `google-sub-only-${uniqueSuffix}`,
    name: 'Google Only User',
};

function buildGooglePayload({ sub, email, name, emailVerified = true }) {
    return {
        sub,
        email,
        name,
        email_verified: emailVerified,
    };
}

async function waitForMongo() {
    if (mongoose.connection.readyState === 1) {
        return;
    }
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required for Google auth tests');
    }
    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB_NAME || 'page-index-chatbot',
    });
}

function createTestServer() {
    process.env.GOOGLE_CLIENT_ID = googleClientId;

    __setGoogleAuthVerifierForTests(async (idToken) => {
        if (idToken === 'token-new-user') {
            return buildGooglePayload({
                sub: newGoogleUser.googleId,
                email: newGoogleUser.email,
                name: newGoogleUser.name,
            });
        }
        if (idToken === 'token-link-user') {
            return buildGooglePayload({
                sub: linkGoogleUser.googleId,
                email: linkGoogleUser.email,
                name: linkGoogleUser.name,
            });
        }
        if (idToken === 'token-google-only') {
            return buildGooglePayload({
                sub: googleOnlyUser.googleId,
                email: googleOnlyUser.email,
                name: googleOnlyUser.name,
            });
        }
        if (idToken === 'token-unverified') {
            return buildGooglePayload({
                sub: `google-sub-unverified-${uniqueSuffix}`,
                email: `google_unverified_${uniqueSuffix}@example.com`,
                name: 'Unverified Google User',
                emailVerified: false,
            });
        }
        throw new Error('Invalid token');
    });

    const app = express();
    app.use(express.json());
    app.post('/users/google', userController.googleLogin);
    app.post('/users/login', userController.loginUser);

    return supertest(app);
}

tap.test('google auth flow', async (t) => {
    await waitForMongo();

    const emails = [
        newGoogleUser.email,
        linkGoogleUser.email,
        googleOnlyUser.email,
        `google_unverified_${uniqueSuffix}@example.com`,
    ];

    t.teardown(async () => {
        await User.deleteMany({ email: { $in: emails } });
        __setGoogleAuthVerifierForTests(null);
        delete process.env.GOOGLE_CLIENT_ID;
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });

    const server = createTestServer();

    const newUserResponse = await server.post('/users/google').send({ idToken: 'token-new-user' });
    t.equal(newUserResponse.status, 200, 'new Google user should sign in');
    t.ok(newUserResponse.body.token, 'new Google user should receive a token');
    t.equal(newUserResponse.body.user.is_google_account, true);
    t.equal(newUserResponse.body.user.isEmailVerified, true);

    const createdUser = await User.findOne({ email: newGoogleUser.email });
    t.ok(createdUser, 'new Google user should be stored');
    t.equal(createdUser.is_google_account, true);
    t.equal(createdUser.isEmailVerified, true);
    t.equal(createdUser.googleId, newGoogleUser.googleId);
    t.notOk(createdUser.password, 'new Google user should not have a password');

    await User.create({
        name: 'Local User',
        email: linkGoogleUser.email,
        password,
        isEmailVerified: false,
    });

    const linkResponse = await server.post('/users/google').send({ idToken: 'token-link-user' });
    t.equal(linkResponse.status, 200, 'existing local user should link Google account');
    t.equal(linkResponse.body.user.is_google_account, true);
    t.equal(linkResponse.body.user.isEmailVerified, true);

    const linkedUser = await User.findOne({ email: linkGoogleUser.email });
    t.equal(linkedUser.googleId, linkGoogleUser.googleId);
    t.equal(linkedUser.is_google_account, true);
    t.ok(linkedUser.password, 'linked user should keep existing password');

    const passwordLoginAfterLink = await server.post('/users/login').send({
        email: linkGoogleUser.email,
        password,
    });
    t.equal(passwordLoginAfterLink.status, 200, 'linked user should still log in with password');

    await User.create({
        name: googleOnlyUser.name,
        email: googleOnlyUser.email,
        googleId: googleOnlyUser.googleId,
        is_google_account: true,
        isEmailVerified: true,
    });

    const googleOnlyLogin = await server.post('/users/login').send({
        email: googleOnlyUser.email,
        password: 'AnyPassword1',
    });
    t.equal(googleOnlyLogin.status, 400, 'Google-only user should be blocked from password login');
    t.equal(googleOnlyLogin.body.code, 'USE_GOOGLE_LOGIN');

    const unverifiedResponse = await server.post('/users/google').send({ idToken: 'token-unverified' });
    t.equal(unverifiedResponse.status, 403, 'unverified Google email should be rejected');
});
