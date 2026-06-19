import tap from 'tap';
import supertest from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import CatalogSubject from '../models/catalogSubjectModel.js';
import User from '../models/userModel.js';
import { buildCatalogContentUpdate } from '../controllers/catalogController.js';

const server = supertest(app);
const uniqueSuffix = Date.now();
const password = 'TestPass123';

async function waitForMongo() {
    if (mongoose.connection.readyState === 1) {
        return;
    }
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required for admin catalog subject tests');
    }
    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB_NAME || 'page-index-chatbot',
    });
}

tap.test('admin catalog subjects endpoint requires admin access', async (t) => {
    await waitForMongo();

    const adminEmail = `admin_subjects_${uniqueSuffix}@example.com`;
    const userEmail = `user_subjects_${uniqueSuffix}@example.com`;
    const subjectCode = `ADM${String(uniqueSuffix).slice(-6)}`;

    t.teardown(async () => {
        await User.deleteMany({ email: { $in: [adminEmail, userEmail] } });
        await CatalogSubject.deleteOne({ subject_code: subjectCode });
    });

    await User.create({
        name: 'Admin Subject User',
        email: adminEmail,
        password,
        isAdmin: true,
        isEmailVerified: true,
    });

    await User.create({
        name: 'Normal Subject User',
        email: userEmail,
        password,
        isEmailVerified: true,
    });

    await CatalogSubject.create({
        subject_code: subjectCode,
        subject_name: 'Admin Subject List Test',
        known_as: 'ASLT',
        pageindex_status: 'ready',
        syllabus: [{ title: 'Syllabus', s3_uri: 's3://paperai-test/syllabus.pdf' }],
        old_paper: [{ year: '2024', link: 's3://paperai-test/paper.pdf' }],
        books: [
            {
                book_id: `${subjectCode}-book`,
                title: 'Admin Test Book',
                pageindex_status: 'ready',
                pageindex_s3_uri: 's3://paperai-test/index.json',
            },
        ],
    });

    const adminLogin = await server.post('/users/login').send({
        email: adminEmail,
        password,
    });
    const normalLogin = await server.post('/users/login').send({
        email: userEmail,
        password,
    });

    const missingTokenResponse = await server.get('/admin/catalog/subjects');
    t.equal(missingTokenResponse.status, 401, 'missing token should be rejected');

    const normalResponse = await server
        .get('/admin/catalog/subjects')
        .set('Authorization', `Bearer ${normalLogin.body.token}`);
    t.equal(normalResponse.status, 403, 'normal user should be forbidden');

    const adminResponse = await server
        .get('/admin/catalog/subjects')
        .set('Authorization', `Bearer ${adminLogin.body.token}`);
    t.equal(adminResponse.status, 200, 'admin user should access subject list');
    t.equal(adminResponse.body.status, 200);
    t.type(adminResponse.body.total, 'number');
    t.ok(Array.isArray(adminResponse.body.subjects), 'subjects should be an array');
    t.ok(
        adminResponse.body.subjects.some((subject) => subject.subjectCode === subjectCode),
        'admin subject list should include catalog subject details'
    );

    const missingFileResponse = await server
        .post(`/admin/catalog/subjects/${subjectCode}/content/upload`)
        .set('Authorization', `Bearer ${adminLogin.body.token}`)
        .field('contentType', 'syllabus');
    t.equal(missingFileResponse.status, 400, 'admin upload should require at least one PDF file');

    const normalUploadResponse = await server
        .post(`/admin/catalog/subjects/${subjectCode}/content/upload`)
        .set('Authorization', `Bearer ${normalLogin.body.token}`)
        .field('contentType', 'syllabus');
    t.equal(normalUploadResponse.status, 403, 'normal user should be forbidden from admin upload');
});

tap.test('catalog content update appends subject-level material files', (t) => {
    const update = buildCatalogContentUpdate(
        {
            subject_code: 'ADM101',
            syllabus: 's3://paperai-test/legacy-syllabus.pdf',
        },
        {
            contentType: 'syllabus',
            body: {},
            uploadedFiles: [
                {
                    title: 'Syllabus Part 2',
                    original_name: 'syllabus-2.pdf',
                    storage_path: 'pageindex/catalog/ADM101/syllabus/2/syllabus-2.pdf',
                    s3_uri: 's3://paperai-test/pageindex/catalog/ADM101/syllabus/2/syllabus-2.pdf',
                    uploaded_at: '2026-06-19T00:00:00.000Z',
                },
            ],
        }
    );

    t.equal(update.$set.syllabus.length, 2);
    t.equal(update.$set.syllabus[0].s3_uri, 's3://paperai-test/legacy-syllabus.pdf');
    t.equal(update.$set.syllabus[1].title, 'Syllabus Part 2');
    t.end();
});

tap.test('catalog content update replaces matching old paper year', (t) => {
    const update = buildCatalogContentUpdate(
        {
            subject_code: 'ADM101',
            old_paper: [{ year: 'Summer 2024', link: 's3://paperai-test/old.pdf' }],
        },
        {
            contentType: 'old_paper',
            body: { year: 'Summer 2024' },
            uploadedFiles: [
                {
                    s3_uri: 's3://paperai-test/new.pdf',
                },
            ],
        }
    );

    t.same(update.$set.old_paper, [{ year: 'Summer 2024', link: 's3://paperai-test/new.pdf' }]);
    t.end();
});

tap.test('catalog content update stores linked subject-level material files', (t) => {
    const update = buildCatalogContentUpdate(
        {
            subject_code: 'ADM101',
            assignments: [],
        },
        {
            contentType: 'assignments',
            body: {},
            uploadedFiles: [
                {
                    title: 'Assignment Link',
                    original_name: 'assignment.pdf',
                    storage_path: 'https://cdn.example.com/assignment.pdf',
                    s3_uri: '',
                    uploaded_at: '2026-06-19T00:00:00.000Z',
                },
            ],
        }
    );

    t.equal(update.$set.assignments.length, 1);
    t.equal(update.$set.assignments[0].storage_path, 'https://cdn.example.com/assignment.pdf');
    t.equal(update.$set.assignments[0].s3_uri, '');
    t.end();
});

tap.test('catalog content update stores linked old paper URL', (t) => {
    const update = buildCatalogContentUpdate(
        {
            subject_code: 'ADM101',
            old_paper: [],
        },
        {
            contentType: 'old_paper',
            body: { year: 'Winter 2025' },
            uploadedFiles: [
                {
                    storage_path: 'https://cdn.example.com/winter-2025.pdf',
                    s3_uri: '',
                },
            ],
        }
    );

    t.same(update.$set.old_paper, [
        { year: 'Winter 2025', link: 'https://cdn.example.com/winter-2025.pdf' },
    ]);
    t.end();
});

tap.test('catalog content update upserts book PDF metadata as pending', (t) => {
    const update = buildCatalogContentUpdate(
        {
            subject_code: 'ADM101',
            books: [
                {
                    book_id: 'ADM101-main',
                    title: 'Main Book',
                    pageindex_status: 'ready',
                    pageindex_s3_uri: 's3://paperai-test/index.json',
                },
            ],
        },
        {
            contentType: 'book',
            body: { subjectCode: 'ADM101', bookId: 'ADM101-extra', title: 'Extra Book' },
            uploadedFiles: [
                {
                    storage_path: 'pageindex/catalog/ADM101/book/extra/source.pdf',
                    s3_uri: 's3://paperai-test/pageindex/catalog/ADM101/book/extra/source.pdf',
                },
            ],
        }
    );

    t.equal(update.$set.books.length, 2);
    t.equal(update.$set.books[1].book_id, 'ADM101-extra');
    t.equal(update.$set.books[1].pageindex_status, 'pending');
    t.equal(update.$set.indexed_book_count, 1);
    t.equal(update.$set.pageindex_status, 'partial');
    t.end();
});

tap.test('catalog content update uses linked book URL as download link', (t) => {
    const update = buildCatalogContentUpdate(
        {
            subject_code: 'ADM101',
            books: [],
        },
        {
            contentType: 'book',
            body: { subjectCode: 'ADM101', bookId: 'ADM101-linked', title: 'Linked Book' },
            uploadedFiles: [
                {
                    storage_path: 'https://cdn.example.com/book.pdf',
                    s3_uri: '',
                    upload_source: 'link',
                },
            ],
        }
    );

    t.equal(update.$set.books[0].book_id, 'ADM101-linked');
    t.equal(update.$set.books[0].download_link, 'https://cdn.example.com/book.pdf');
    t.equal(update.$set.books[0].pdf_storage_path, 'https://cdn.example.com/book.pdf');
    t.equal(update.$set.books[0].pdf_s3_uri, '');
    t.end();
});

tap.teardown(() => {
    process.exit(0);
});
