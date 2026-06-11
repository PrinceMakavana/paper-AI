import mongoose from 'mongoose';
import IndexStatus from '../utils/enums.js';

const pageIndexSchema = new mongoose.Schema(
    {
        user_id: {
            type: String,
            required: [true, 'User ID is required'],
            trim: true,
        },
        document_id: {
            type: String,
            required: [true, 'Document ID is required'],
        },
        document_name: {
            type: String,
            required: [true, 'Document Name is required'],
            trim: true,
        },
        summary: {
            type: String,
            required: false,
            trim: true,
        },
        page_count: {
            type: Number,
            required: false,
        },
        file_size: {
            type: Number,
            required: false,
        },
        mime_type: {
            type: String,
            required: false,
        },
        model_provider: {
            type: String,
            required: false,
            enum: ['ollama', 'gemini', 'claude', 'anthropic', 'openai'],
        },
        model: {
            type: String,
            required: false,
            trim: true,
        },
        pdf_storage_path: {
            type: String,
            required: false,
            trim: true,
        },
        pdf_s3_uri: {
            type: String,
            required: false,
            trim: true,
        },
        pageindex_storage_path: {
            type: String,
            required: false,
            trim: true,
        },
        pageindex_s3_uri: {
            type: String,
            required: false,
            trim: true,
        },
        storage_status: {
            type: String,
            required: false,
            enum: ['pdf_uploaded', 'uploaded', 'failed'],
        },
        storage_error_message: {
            type: String,
            required: false,
        },
        index_status: {
            type: String,
            required: false,
            enum: Object.values(IndexStatus),
            default: IndexStatus.UNKNOWN,
        },
        token_count: {
            type: Number,
            required: false,
        },
        error_message: {
            type: String,
            required: false,
        },
        source: {
            type: String,
            required: false,
            enum: ['local', 'hosted'],
            default: 'local',
        },
        hosted_job_id: {
            type: String,
            required: false,
            trim: true,
        },
        hosted_pageindex_doc_id: {
            type: String,
            required: false,
            trim: true,
        },
    },
    { timestamps: true }
);




export default mongoose.model('pageindex_documents', pageIndexSchema);
