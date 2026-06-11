import rzpInstance from '../utils/rezorpay.js';
import PaymentModel from '../models/payment.js';
import User from '../models/userModel.js';
import dotenv from 'dotenv';
import { pagesForTokenPurchase } from '../utils/billingConstants.js';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils.js';
dotenv.config();
const MIN_TOKEN_PURCHASE = 5000;
const PAISE_PER_TOKEN = 2; // 1000 tokens = INR 20 = 2000 paise
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

async function createOrder(req, res) {
    try {
        const tokenCount = Number(req.body?.token_count);
        
        if (!Number.isInteger(tokenCount) || tokenCount < MIN_TOKEN_PURCHASE) {
            return res.status(400).json({
                message: `Minimum ${MIN_TOKEN_PURCHASE} tokens required`,
            });
        }

        const amount = tokenCount * PAISE_PER_TOKEN;
        const pageCount = pagesForTokenPurchase(tokenCount);
        const receipt = `tokens_${tokenCount}`;

        const order = await rzpInstance.orders.create({
            "amount": amount,
            "currency": "INR",
            "receipt": receipt,
            "partial_payment": false,
            "notes": {
                "token_count": tokenCount,
                "page_count": pageCount,
                "user_id": req.user.userId
            }
        })

        const payment = new PaymentModel({
            user_id: req.user.userId,
            order_id: order.id,
            amount: order.amount,
            token_count: tokenCount,
            page_count: pageCount,
            currency: order.currency,
            receipt: order.receipt,
            status: order.status,
            notes: order.notes,
        });

        const savedPayment = await payment.save();

        // Return order details to the frontend.
        res.status(200).json({...savedPayment.toJSON(), key_id: process.env.RAZORPAY_KEY_ID})
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

async function webhook(req, res) {
    try {
        const webhookSignature = req.get("X-Razorpay-Signature");
        
        const isWebhookValid = validateWebhookSignature(
            JSON.stringify(req.body), 
            webhookSignature, 
            razorpayWebhookSecret
        );

        if (!isWebhookValid) {
            return res.status(400).json({ message: 'Webhook signature is invalid' });   
        }

        const paymentDetails = req.body.payload.payment.entity;
        // Update the payment status in the database
        const payment = await PaymentModel.findOne({ order_id: paymentDetails.order_id });
        if (!payment) {
            return res.status(400).json({ message: 'Payment not found' });
        }
        payment.status = paymentDetails.status;
        await payment.save();

        // Update the user's token balance
        const user = await User.findOne({ _id: payment.user_id });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        user.available_token_count += payment.token_count;
        user.available_page_count = (user.available_page_count ?? 0) + (payment.page_count ?? 0);
        await user.save();

        // return the response to the razorpay

        // if (req.body.event === 'payment.captured') {
            
        // }

        // if (req.body.event === 'payment.failed') {
            
        // }

        res.status(200).json({ message: 'Webhook signed successfully' });


        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
export {
    createOrder,
    webhook,
};