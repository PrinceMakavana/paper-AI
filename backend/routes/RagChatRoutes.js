import express from 'express';
import multer from 'multer';
import * as RagChatController from '../controllers/RagChatController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public routes (no auth required)
router.post('/ragchat/upload', upload.single('file'), RagChatController.uploadDocument);
router.post('/ragchat/chat', RagChatController.chatWithDocument);

export default router;
