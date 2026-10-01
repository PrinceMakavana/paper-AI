import mongoose from 'mongoose';

const shopProjectImageSchema = new mongoose.Schema(
    {
        image_id: {
            type: String,
            required: true,
        },
        storage_path: {
            type: String,
            required: true,
            trim: true,
        },
        s3_uri: {
            type: String,
            required: true,
            trim: true,
        },
        content_type: {
            type: String,
            required: true,
            trim: true,
        },
        original_name: {
            type: String,
            trim: true,
            default: '',
        },
        sort_order: {
            type: Number,
            default: 0,
        },
    },
    { _id: false }
);

const shopProjectSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: [true, 'Slug is required'],
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
        },
        original_price: {
            type: Number,
            required: [true, 'Original price is required'],
            min: 0,
        },
        current_price: {
            type: Number,
            required: [true, 'Current price is required'],
            min: 1,
        },
        active: {
            type: Boolean,
            default: true,
            index: true,
        },
        images: {
            type: [shopProjectImageSchema],
            default: [],
        },
    },
    { timestamps: true }
);

export default mongoose.model('ShopProject', shopProjectSchema);
