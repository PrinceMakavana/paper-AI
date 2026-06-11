
import mongoose from 'mongoose';

const PageIndexChatMessagesSchema = new mongoose.Schema(
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
        previous_message_id: {
            type: String,
            required: false,
            trim: true,
            default: null,
        },
        role: {
            type: String,
            required: [true, 'Role is required'],
            trim: true,
            enum: ['user', 'assistant'],
        },
        content: {
            type: String,
            required: [true, 'Message content is required'],
            trim: true,
        },
        chat_model: {
            type: String,
            required: false,
            trim: true,
        },
        token_count: {
            type: Number,
            required: false,
            default: 0,
        },
        input_token_count: {
            type: Number,
            required: false,
            default: 0,
        },
        output_token_count: {
            type: Number,
            required: false,
            default: 0,
        },
    },
    { timestamps: true }
);

PageIndexChatMessagesSchema.index({ user_id: 1, document_id: 1, createdAt: 1 });
PageIndexChatMessagesSchema.index({ document_id: 1, createdAt: 1 });



export default mongoose.model('pageindex_chat_messages', PageIndexChatMessagesSchema, 'pageindex_chat_messages');
