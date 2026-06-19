import tap from 'tap';
import supertest from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/userModel.js';

const server = supertest(app);
const uniqueSuffix = Date.now();
const password = 'TestPass123';

async function waitForMongo() {
    if (mongoose.connection.readyState === 1) {
        return;
    }
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required for admin login tests');
    }
    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB_NAME || 'page-index-chatbot',
    });
}

tap.test('login includes isAdmin only for admin users', async (t) => {
    await waitForMongo();

    const adminEmail = `admin_login_${uniqueSuffix}@example.com`;
    const userEmail = `user_login_${uniqueSuffix}@example.com`;

    t.teardown(async () => {
        await User.deleteMany({ email: { $in: [adminEmail, userEmail] } });
    });

    await User.create({
        name: 'Admin Login User',
        email: adminEmail,
        password,
        isAdmin: true,
        isEmailVerified: true,
    });

    await User.create({
        name: 'Normal Login User',
        email: userEmail,
        password,
        isEmailVerified: true,
    });

    const adminLogin = await server.post('/users/login').send({
        email: adminEmail,
        password,
    });

    t.equal(adminLogin.status, 200, 'admin login should succeed');
    t.ok(adminLogin.body.token, 'admin login should return a token');
    t.equal(adminLogin.body.user.isAdmin, true, 'admin login should include isAdmin true');

    const normalLogin = await server.post('/users/login').send({
        email: userEmail,
        password,
    });

    t.equal(normalLogin.status, 200, 'normal user login should succeed');
    t.ok(normalLogin.body.token, 'normal user login should return a token');
    t.notOk(
        Object.prototype.hasOwnProperty.call(normalLogin.body.user, 'isAdmin'),
        'normal user login should not include isAdmin'
    );
});

tap.teardown(() => {
    process.exit(0);
});
