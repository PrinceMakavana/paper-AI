import tap from 'tap';
import supertest from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import ProductOrder from '../models/productOrder.js';
import ShopProject from '../models/shopProjectModel.js';
import User from '../models/userModel.js';
import rzpInstance from '../utils/rezorpay.js';
import { ensureDefaultShopProject } from '../utils/seedShopProjects.js';

const server = supertest(app);
const uniqueSuffix = Date.now();
const password = 'TestPass123';

async function waitForMongo() {
    if (mongoose.connection.readyState === 1) {
        return;
    }
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required for shop project tests');
    }
    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB_NAME || 'page-index-chatbot',
    });
}

function projectPayload(slug, overrides = {}) {
    return {
        slug,
        title: `Shop ${slug}`,
        description: 'A project sold from the admin catalog.',
        originalPrice: 1000,
        currentPrice: 499,
        active: true,
        ...overrides,
    };
}

tap.test('shop project admin routes require admin access', async (t) => {
    await waitForMongo();

    const adminEmail = `admin_shop_${uniqueSuffix}@example.com`;
    const userEmail = `user_shop_${uniqueSuffix}@example.com`;
    const slug = `shop-${String(uniqueSuffix).slice(-8)}`;

    t.teardown(async () => {
        await User.deleteMany({ email: { $in: [adminEmail, userEmail] } });
        await ShopProject.deleteOne({ slug });
    });

    await User.create({
        name: 'Admin Shop User',
        email: adminEmail,
        password,
        isAdmin: true,
        isEmailVerified: true,
    });
    await User.create({
        name: 'Normal Shop User',
        email: userEmail,
        password,
        isEmailVerified: true,
    });

    const adminLogin = await server.post('/users/login').send({ email: adminEmail, password });
    const normalLogin = await server.post('/users/login').send({ email: userEmail, password });
    const adminToken = adminLogin.body.token;
    const userToken = normalLogin.body.token;

    const missingToken = await server.get('/admin/shop/projects');
    t.equal(missingToken.status, 401, 'missing token should be rejected');

    const normalResponse = await server
        .get('/admin/shop/projects')
        .set('Authorization', `Bearer ${userToken}`);
    t.equal(normalResponse.status, 403, 'normal user should be forbidden');

    const created = await server
        .post('/admin/shop/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(projectPayload(slug, { active: false, currentPrice: 499 }));
    t.equal(created.status, 201, 'admin should create a project');
    t.equal(created.body.project.slug, slug);
    t.equal(created.body.project.active, false);
    t.equal(created.body.project.currentPrice, 499);

    const publicList = await server.get('/public/shop/projects');
    t.equal(publicList.status, 200);
    t.notOk(
        publicList.body.projects.some((project) => project.slug === slug),
        'public list should hide inactive projects'
    );

    const publicDetail = await server.get(`/public/shop/projects/${slug}`);
    t.equal(publicDetail.status, 404, 'inactive project should be hidden');

    const activated = await server
        .put(`/admin/shop/projects/${slug}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: true });
    t.equal(activated.status, 200);
    t.equal(activated.body.project.active, true);

    const visible = await server.get(`/public/shop/projects/${slug}`);
    t.equal(visible.status, 200);
    t.equal(visible.body.project.currentPrice, 499);
    t.same(visible.body.project.images, []);

    const rejectedImage = await server
        .post(`/admin/shop/projects/${slug}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('images', Buffer.from('not-an-image'), {
            filename: 'note.txt',
            contentType: 'text/plain',
        });
    t.equal(rejectedImage.status, 400, 'non-image uploads should be rejected');

    const normalCreate = await server
        .post('/admin/shop/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send(projectPayload(`${slug}-nope`));
    t.equal(normalCreate.status, 403, 'normal user should not create projects');
});

tap.test('checkout uses the MongoDB project price and blocks inactive projects', async (t) => {
    await waitForMongo();

    const email = `buyer_shop_${uniqueSuffix}@example.com`;
    const activeSlug = `buy-${String(uniqueSuffix).slice(-6)}`;
    const inactiveSlug = `off-${String(uniqueSuffix).slice(-6)}`;
    const originalCreate = rzpInstance.orders.create.bind(rzpInstance.orders);
    let capturedAmount = null;

    rzpInstance.orders.create = async (payload) => {
        capturedAmount = payload.amount;
        return {
            id: `order_shop_${uniqueSuffix}`,
            amount: payload.amount,
            currency: payload.currency,
            receipt: payload.receipt,
            status: 'created',
            notes: payload.notes,
        };
    };

    t.teardown(async () => {
        rzpInstance.orders.create = originalCreate;
        await User.deleteMany({ email });
        await ShopProject.deleteMany({ slug: { $in: [activeSlug, inactiveSlug] } });
        await ProductOrder.deleteMany({ product_slug: { $in: [activeSlug, inactiveSlug] } });
    });

    await User.create({
        name: 'Shop Buyer',
        email,
        password,
        isAdmin: true,
        isEmailVerified: true,
    });
    const login = await server.post('/users/login').send({ email, password });
    const token = login.body.token;

    await server
        .post('/admin/shop/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(projectPayload(activeSlug, { currentPrice: 499, title: 'Priced Project' }));
    await server
        .post('/admin/shop/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(projectPayload(inactiveSlug, { active: false, currentPrice: 250 }));

    const inactiveOrder = await server
        .post('/payment/create-product-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
            product_slug: inactiveSlug,
            name: 'Shop Buyer',
            email,
        });
    t.equal(inactiveOrder.status, 404, 'inactive projects cannot be purchased');
    t.equal(capturedAmount, null, 'inactive checkout should not create a Razorpay order');

    const order = await server
        .post('/payment/create-product-order')
        .set('Authorization', `Bearer ${token}`)
        .send({
            product_slug: activeSlug,
            name: 'Shop Buyer',
            email,
        });
    t.equal(order.status, 200, 'active project checkout should succeed');
    t.equal(order.body.amount, 49900, 'checkout amount should use the Mongo price in paise');
    t.equal(capturedAmount, 49900);
    t.equal(order.body.product_slug, activeSlug);
    t.equal(order.body.product_title, 'Priced Project');

    const blockedRename = await server
        .put(`/admin/shop/projects/${activeSlug}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ slug: `${activeSlug}-renamed` });
    t.equal(blockedRename.status, 409, 'slug cannot change after an order exists');

    const deactivated = await server
        .delete(`/admin/shop/projects/${activeSlug}`)
        .set('Authorization', `Bearer ${token}`);
    t.equal(deactivated.status, 200);
    t.equal(deactivated.body.deactivated, true, 'projects with orders should be deactivated');

    const hidden = await server.get(`/public/shop/projects/${activeSlug}`);
    t.equal(hidden.status, 404, 'deactivated project should leave the store');
});

tap.test('admin can reorder and remove project images without a live upload', async (t) => {
    await waitForMongo();

    const slug = `img-${String(uniqueSuffix).slice(-6)}`;
    t.teardown(async () => {
        await ShopProject.deleteOne({ slug });
    });

    await ShopProject.create({
        slug,
        title: 'Image Project',
        description: 'Gallery order test',
        original_price: 800,
        current_price: 200,
        active: true,
        images: [
            {
                image_id: 'img-a',
                storage_path: 'ignored-a',
                s3_uri: 's3://unrelated-bucket/shop/a.png',
                content_type: 'image/png',
                original_name: 'a.png',
                sort_order: 0,
            },
            {
                image_id: 'img-b',
                storage_path: 'ignored-b',
                s3_uri: 's3://unrelated-bucket/shop/b.png',
                content_type: 'image/png',
                original_name: 'b.png',
                sort_order: 1,
            },
        ],
    });

    const adminEmail = `admin_img_${uniqueSuffix}@example.com`;
    t.teardown(async () => {
        await User.deleteOne({ email: adminEmail });
    });
    await User.create({
        name: 'Image Admin',
        email: adminEmail,
        password,
        isAdmin: true,
        isEmailVerified: true,
    });
    const login = await server.post('/users/login').send({ email: adminEmail, password });

    const reordered = await server
        .put(`/admin/shop/projects/${slug}`)
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({ imageOrder: ['img-b', 'img-a'] });
    t.equal(reordered.status, 200);
    t.same(
        reordered.body.project.images.map((image) => image.id),
        ['img-b', 'img-a']
    );

    const removed = await server
        .delete(`/admin/shop/projects/${slug}/images/img-b`)
        .set('Authorization', `Bearer ${login.body.token}`);
    t.equal(removed.status, 200);
    t.same(
        removed.body.project.images.map((image) => image.id),
        ['img-a']
    );
});

tap.teardown(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
});

tap.test('default shop project seed inserts document-ai once', async (t) => {
    await waitForMongo();

    const before = await ShopProject.findOne({ slug: 'document-ai' }).lean();
    await ensureDefaultShopProject();
    const after = await ShopProject.findOne({ slug: 'document-ai' }).lean();

    t.ok(after, 'document-ai project should exist after seeding');
    t.equal(after.slug, 'document-ai');

    if (!before) {
        t.equal(after.title, 'Project - Namste AI');
        t.equal(after.current_price, 499);
        t.equal(after.original_price, 6969);
        t.equal(after.active, true);
        t.equal(after.images.length, 0);
    } else {
        t.equal(after.title, before.title, 'existing document-ai data should be left in place');
        t.equal(String(after._id), String(before._id));
    }

    await ensureDefaultShopProject();
    const again = await ShopProject.findOne({ slug: 'document-ai' }).lean();
    t.equal(String(again._id), String(after._id), 'seed should not create a duplicate');
});
