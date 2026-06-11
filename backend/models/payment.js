import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    user_id: {
        type: String,
        ref: 'User',
        required: [true, 'User ID is required'],
    },
    payment_id: {
        type: String,
        required: [false, 'Payment ID is required'],
    },
    order_id: {
        type: String,
        required: [true, 'Order ID is required'],
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
    },
    token_count: {
        type: Number,
        required: [true, 'Token count is required'],
    },
    page_count: {
        type: Number,
        required: [false, 'Page count is required'],
        default: 0,
    },
    currency: {
        type: String,
        required: [true, 'Currency is required'],
    },
    receipt: {
        type: String,
        required: [true, 'Receipt is required'],
    },
    status: {
        type: String,
        required: [true, 'Status is required'],
    },
    notes: {
        type: Object,
        required: [true, 'Notes is required'],
    },
}, {timestamps: true})

export default mongoose.model('Payment', paymentSchema);
