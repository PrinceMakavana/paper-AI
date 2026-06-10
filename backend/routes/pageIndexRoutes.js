const express = require('express');
const multer = require('multer');
const router = express.Router();
const pageIndexController = require('../controllers/pageIndexController');
const authMiddleware = require('../middleware/authMiddleware');
const { registerRoutes } = require('../utils/registerApiRoutes');
const upload = multer({ storage: multer.memoryStorage() });

registerRoutes(router, 'get', '/documents', authMiddleware, pageIndexController.getDocuments);
registerRoutes(router, 'get', '/documents/:documentId/status', authMiddleware, pageIndexController.getDocumentIndexStatus);
registerRoutes(router, 'get', '/documents/:documentId/pdf-url', authMiddleware, pageIndexController.getDocumentPdfUrl);
registerRoutes(router, 'delete', '/documents/:documentId', authMiddleware, pageIndexController.deleteDocument);
registerRoutes(router, 'post', '/upload', authMiddleware, upload.single('file'), pageIndexController.uploadDocument);
registerRoutes(router, 'get', '/chat-messages/:documentId', authMiddleware, pageIndexController.getChatMessages);
registerRoutes(router, 'delete', '/chat-messages/:documentId', authMiddleware, pageIndexController.deleteChatMessages);
registerRoutes(router, 'post', '/question-vectorless-rag', authMiddleware, pageIndexController.questionVectorlessRag);
registerRoutes(router, 'post', '/subject-question-rag', authMiddleware, pageIndexController.subjectQuestionVectorlessRag);
registerRoutes(
    router,
    'get',
    '/chat-messages/subject/:subjectCode',
    authMiddleware,
    pageIndexController.getSubjectChatMessages,
);
registerRoutes(
    router,
    'delete',
    '/chat-messages/subject/:subjectCode',
    authMiddleware,
    pageIndexController.deleteSubjectChatMessages,
);

module.exports = router;
