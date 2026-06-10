const express = require('express');
const multer = require('multer');
const router = express.Router();
const RagChatController = require('../controllers/RagChatController');
const upload = multer({ storage: multer.memoryStorage() });

// Public routes (no auth required)
router.post('/ragchat/upload', upload.single('file'), RagChatController.uploadDocument);
router.post('/ragchat/chat', RagChatController.chatWithDocument);

module.exports = router;
