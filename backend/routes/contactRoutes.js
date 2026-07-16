import express from 'express';
import { submitContact } from '../controllers/contactController.js';
import requireTurnstile from '../middleware/requireTurnstile.js';

const router = express.Router();

router.post('/contact', requireTurnstile, submitContact);

export default router;
