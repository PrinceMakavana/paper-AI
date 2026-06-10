const express = require('express');
const multer = require('multer');
const router = express.Router();
const pageIndexController = require('../controllers/pageIndexController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = multer({ storage: multer.memoryStorage() });

// PageIndex routes require JWT auth.
router.get('/pageindex/documents', authMiddleware, pageIndexController.getDocuments);
router.get('/pageindex/documents/:documentId/status', authMiddleware, pageIndexController.getDocumentIndexStatus);
router.get('/pageindex/documents/:documentId/pdf-url', authMiddleware, pageIndexController.getDocumentPdfUrl);
router.delete('/pageindex/documents/:documentId', authMiddleware, pageIndexController.deleteDocument);
router.post('/pageindex/upload', authMiddleware, upload.single('file'), pageIndexController.uploadDocument);
router.get('/pageindex/chat-messages/:documentId', authMiddleware, pageIndexController.getChatMessages);
router.delete('/pageindex/chat-messages/:documentId', authMiddleware, pageIndexController.deleteChatMessages);
router.post('/pageindex/question-vectorless-rag', authMiddleware, pageIndexController.questionVectorlessRag);
router.post('/pageindex/subject-question-rag', authMiddleware, pageIndexController.subjectQuestionVectorlessRag);
router.get(
    '/pageindex/chat-messages/subject/:subjectCode',
    authMiddleware,
    pageIndexController.getSubjectChatMessages
);
router.delete(
    '/pageindex/chat-messages/subject/:subjectCode',
    authMiddleware,
    pageIndexController.deleteSubjectChatMessages
);

module.exports = router;
