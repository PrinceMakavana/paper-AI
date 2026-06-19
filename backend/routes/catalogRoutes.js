import express from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import authMiddleware from '../middleware/authMiddleware.js';
import requireAdmin from '../middleware/adminMiddleware.js';
import * as catalogController from '../controllers/catalogController.js';

const router = express.Router();
const PUBLIC_SUBJECT_CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const adminCatalogUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: Number(process.env.ADMIN_CATALOG_UPLOAD_MAX_FILES || 10),
        fileSize: Number(process.env.ADMIN_CATALOG_UPLOAD_MAX_FILE_SIZE_MB || 10) * 1024 * 1024,
    },
});

function createPublicCatalogRateLimit({ max, windowMs, message }) {
    const hits = new Map();

    return (req, res, next) => {
        const now = Date.now();
        const key = req.ip || req.socket?.remoteAddress || 'unknown';
        let record = hits.get(key);

        if (!record || record.resetAt <= now) {
            record = { count: 0, resetAt: now + windowMs };
            hits.set(key, record);
        }

        if (hits.size > 10000) {
            for (const [entryKey, entry] of hits.entries()) {
                if (entry.resetAt <= now) {
                    hits.delete(entryKey);
                }
            }
        }

        const remaining = Math.max(max - record.count - 1, 0);
        res.set('RateLimit-Limit', String(max));
        res.set('RateLimit-Remaining', String(remaining));
        res.set('RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

        if (record.count >= max) {
            const retryAfterSeconds = Math.max(Math.ceil((record.resetAt - now) / 1000), 1);
            res.set('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({
                status: 429,
                message,
            });
        }

        record.count += 1;
        return next();
    };
}

function validatePublicSubjectCode(req, res, next) {
    const subjectCode = String(req.params.subjectCode || '').trim();

    if (!PUBLIC_SUBJECT_CODE_PATTERN.test(subjectCode)) {
        return res.status(400).json({
            status: 400,
            message: 'Invalid subject code.',
        });
    }

    return next();
}

function isSecretMatch(receivedSecret, expectedSecret) {
    const received = Buffer.from(String(receivedSecret || ''));
    const expected = Buffer.from(String(expectedSecret || ''));

    if (received.length !== expected.length) {
        return false;
    }

    return crypto.timingSafeEqual(received, expected);
}

function requirePublicCatalogSecret(req, res, next) {
    const expectedSecret = process.env.PUBLIC_CATALOG_API_SECRET;

    if (!expectedSecret) {
        return res.status(503).json({
            status: 503,
            message: 'Public catalog API is not configured.',
        });
    }

    const receivedSecret = req.get('x-paperai-catalog-secret');

    if (!isSecretMatch(receivedSecret, expectedSecret)) {
        return res.status(403).json({
            status: 403,
            message: 'Forbidden.',
        });
    }

    return next();
}

const publicSubjectListRateLimit = createPublicCatalogRateLimit({
    max: 120,
    windowMs: 60 * 1000,
    message: 'Too many subject list requests. Please try again in a minute.',
});

const publicSubjectDetailRateLimit = createPublicCatalogRateLimit({
    max: 120,
    windowMs: 60 * 1000,
    message: 'Too many subject detail requests. Please try again in a minute.',
});

const publicDownloadRateLimit = createPublicCatalogRateLimit({
    max: 100,
    windowMs: 60 * 1000,
    message: 'Too many download requests. Please try again in a minute.',
});

router.get(
    '/public/catalog/download-url',
    publicDownloadRateLimit,
    catalogController.getPublicCatalogDownloadUrl
);
router.get(
    '/public/catalog/subjects',
    requirePublicCatalogSecret,
    publicSubjectListRateLimit,
    catalogController.listPublicCatalogSubjects
);
router.get(
    '/public/catalog/subjects/:subjectCode',
    requirePublicCatalogSecret,
    publicSubjectDetailRateLimit,
    validatePublicSubjectCode,
    catalogController.getPublicCatalogSubject
);

router.get(
    '/admin/catalog/subjects',
    authMiddleware,
    requireAdmin,
    catalogController.listAdminCatalogSubjects
);
router.post(
    '/admin/catalog/subjects/:subjectCode/content/upload',
    authMiddleware,
    requireAdmin,
    adminCatalogUpload.array('files', Number(process.env.ADMIN_CATALOG_UPLOAD_MAX_FILES || 10)),
    catalogController.uploadAdminCatalogContent
);

router.get('/catalog/subjects', authMiddleware, catalogController.listCatalogSubjects);
router.get('/catalog/subjects/:subjectCode', authMiddleware, catalogController.getCatalogSubject);
router.get(
    '/catalog/subjects/:subjectCode/books/:bookId/pdf-url',
    authMiddleware,
    catalogController.getCatalogBookPdfUrl
);

export default router;
