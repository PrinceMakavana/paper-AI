import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import * as catalogController from '../controllers/catalogController.js';

const router = express.Router();

router.get('/catalog/subjects', authMiddleware, catalogController.listCatalogSubjects);
router.get('/catalog/subjects/:subjectCode', authMiddleware, catalogController.getCatalogSubject);
router.get(
    '/catalog/subjects/:subjectCode/books/:bookId/pdf-url',
    authMiddleware,
    catalogController.getCatalogBookPdfUrl
);

export default router;
