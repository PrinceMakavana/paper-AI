import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
    createOrder,
    createProductOrder,
    webhook,
} from '../controllers/paymentController.js';

const PaymentRouter = express.Router();

PaymentRouter.post('/payment/create-order', authMiddleware, createOrder);
PaymentRouter.post('/payment/create-product-order', authMiddleware, createProductOrder);
PaymentRouter.post('/payment/webhook', webhook);

export default PaymentRouter;
