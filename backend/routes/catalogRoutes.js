const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const catalogController = require('../controllers/catalogController');

const router = express.Router();

router.get('/catalog/subjects', authMiddleware, catalogController.listCatalogSubjects);
router.get('/catalog/subjects/:subjectCode', authMiddleware, catalogController.getCatalogSubject);
router.get(
    '/catalog/subjects/:subjectCode/books/:bookId/pdf-url',
    authMiddleware,
    catalogController.getCatalogBookPdfUrl
);

module.exports = router;
