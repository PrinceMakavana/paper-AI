import mongoose from 'mongoose';

const productOrderSchema = new mongoose.Schema(
    {
        product_slug: {
            type: String,
            required: [true, 'Product slug is required'],
            index: true,
        },
        product_title: {
            type: String,
            required: [true, 'Product title is required'],
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
        },
        user_id: {
            type: String,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        order_id: {
            type: String,
            required: [true, 'Order ID is required'],
            unique: true,
            index: true,
        },
        payment_id: {
            type: String,
            required: false,
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
        },
        currency: {
            type: String,
            required: [true, 'Currency is required'],
            default: 'INR',
        },
        status: {
            type: String,
            required: true,
            enum: ['created', 'paid', 'failed'],
            default: 'created',
        },
        email_status: {
            type: String,
            required: true,
            enum: ['pending', 'sent', 'failed', 'skipped'],
            default: 'pending',
        },
        notes: {
            type: Object,
            required: false,
            default: {},
        },
    },
    { timestamps: true }
);

export default mongoose.model('ProductOrder', productOrderSchema);
