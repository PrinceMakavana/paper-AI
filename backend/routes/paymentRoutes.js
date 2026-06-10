const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const PaymentRouter = express.Router();
const { createOrder, webhook } = require('../controllers/paymentController');

PaymentRouter.post('/payment/create-order', authMiddleware , createOrder);
PaymentRouter.post('/payment/webhook',  webhook);

module.exports = PaymentRouter ;
