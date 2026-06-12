import express from 'express';
import multer from 'multer';
import * as pageIndexController from '../controllers/pageIndexController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { registerRoutes } from '../utils/registerApiRoutes.js';

const router = express.Router();
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
registerRoutes(router, 'post', '/catalog-find', authMiddleware, pageIndexController.catalogFindQuestion);
registerRoutes(
    router,
    'get',
    '/chat-messages/catalog/global',
    authMiddleware,
    pageIndexController.getCatalogChatMessages,
);
registerRoutes(
    router,
    'delete',
    '/chat-messages/catalog/global',
    authMiddleware,
    pageIndexController.deleteCatalogChatMessages,
);
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

export default router;
