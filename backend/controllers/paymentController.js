import rzpInstance from '../utils/rezorpay.js';
import PaymentModel from '../models/payment.js';
import ProductOrder from '../models/productOrder.js';
import User from '../models/userModel.js';
import dotenv from 'dotenv';
import { pagesForTokenPurchase, TOKENS_PER_RUPEE } from '../utils/billingConstants.js';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils.js';
import { getShopProduct } from '../config/shopProducts.js';
import { sendPurchaseConfirmationEmail } from '../utils/emailService.js';

dotenv.config();
const MIN_TOKEN_PURCHASE = 50000; // ₹100 at 500 tokens per rupee
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createOrder(req, res) {
    try {
        const tokenCount = Number(req.body?.token_count);

        if (!Number.isInteger(tokenCount) || tokenCount < MIN_TOKEN_PURCHASE) {
            return res.status(400).json({
                message: `Minimum ${MIN_TOKEN_PURCHASE} tokens required`,
            });
        }

        const amount = Math.round((tokenCount / TOKENS_PER_RUPEE) * 100);
        const pageCount = pagesForTokenPurchase(tokenCount);
        const receipt = `tokens_${tokenCount}`;

        const order = await rzpInstance.orders.create({
            amount,
            currency: 'INR',
            receipt,
            partial_payment: false,
            notes: {
                token_count: tokenCount,
                page_count: pageCount,
                user_id: req.user.userId,
                order_type: 'tokens',
            },
        });

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

        res.status(200).json({ ...savedPayment.toJSON(), key_id: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function createProductOrder(req, res) {
    try {
        const productSlug =
            typeof req.body?.product_slug === 'string' ? req.body.product_slug.trim() : '';
        const bodyName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

        if (!productSlug) {
            return res.status(400).json({ message: 'product_slug is required' });
        }

        const user = await User.findById(req.user.userId).select('name email').lean();
        if (!user) {
            return res.status(401).json({ message: 'User not found.' });
        }

        const name = bodyName.length >= 2 ? bodyName : String(user.name || '').trim();
        const email = String(user.email || req.user.email || '')
            .trim()
            .toLowerCase();

        if (!name || name.length < 2) {
            return res.status(400).json({ message: 'A valid name is required' });
        }
        if (!email || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ message: 'A valid account email is required' });
        }

        const product = getShopProduct(productSlug);
        if (!product) {
            return res.status(404).json({ message: 'Project not found or unavailable' });
        }

        const amountPaise = Math.round(Number(product.currentPrice) * 100);
        if (!Number.isFinite(amountPaise) || amountPaise < 100) {
            return res.status(500).json({ message: 'Invalid product price configuration' });
        }

        const receipt = `proj_${product.slug}`.slice(0, 40);

        const order = await rzpInstance.orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt,
            partial_payment: false,
            notes: {
                order_type: 'product',
                product_slug: product.slug,
                product_title: product.title,
                buyer_name: name,
                buyer_email: email,
                user_id: req.user.userId,
            },
        });

        const productOrder = new ProductOrder({
            product_slug: product.slug,
            product_title: product.title,
            name,
            email,
            user_id: req.user.userId,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            status: 'created',
            email_status: 'pending',
            notes: order.notes,
        });

        const saved = await productOrder.save();

        res.status(200).json({
            order_id: saved.order_id,
            amount: saved.amount,
            currency: saved.currency,
            product_slug: saved.product_slug,
            product_title: saved.product_title,
            key_id: process.env.RAZORPAY_KEY_ID,
            notes: saved.notes,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function handleProductOrderWebhook(paymentDetails) {
    const productOrder = await ProductOrder.findOne({ order_id: paymentDetails.order_id });
    if (!productOrder) {
        return false;
    }

    if (productOrder.status === 'paid') {
        return true;
    }

    const paymentStatus = paymentDetails.status;
    if (paymentStatus === 'failed') {
        productOrder.status = 'failed';
        if (paymentDetails.id) {
            productOrder.payment_id = paymentDetails.id;
        }
        await productOrder.save();
        return true;
    }

    productOrder.status = 'paid';
    if (paymentDetails.id) {
        productOrder.payment_id = paymentDetails.id;
    }
    await productOrder.save();

    try {
        const amountInr = Math.round(productOrder.amount / 100);
        const result = await sendPurchaseConfirmationEmail({
            name: productOrder.name,
            email: productOrder.email,
            orderId: productOrder.order_id,
            productTitle: productOrder.product_title,
            amountInr,
            purchaseDate: productOrder.updatedAt || new Date(),
            paymentMethod: 'Razorpay',
        });
        productOrder.email_status = result?.skipped ? 'skipped' : 'sent';
        await productOrder.save();
    } catch (emailError) {
        console.error(
            '[payment] Purchase confirmation email failed:',
            emailError?.message || emailError
        );
        productOrder.email_status = 'failed';
        await productOrder.save();
    }

    return true;
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

        const handledAsProduct = await handleProductOrderWebhook(paymentDetails);
        if (handledAsProduct) {
            return res.status(200).json({ message: 'Product order webhook handled' });
        }

        const payment = await PaymentModel.findOne({ order_id: paymentDetails.order_id });
        if (!payment) {
            return res.status(400).json({ message: 'Payment not found' });
        }
        payment.status = paymentDetails.status;
        await payment.save();

        const user = await User.findOne({ _id: payment.user_id });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        user.available_token_count += payment.token_count;
        user.available_page_count = (user.available_page_count ?? 0) + (payment.page_count ?? 0);
        await user.save();

        res.status(200).json({ message: 'Webhook signed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export { createOrder, createProductOrder, webhook };
