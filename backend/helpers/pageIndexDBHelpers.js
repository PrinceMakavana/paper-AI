import mongoose from 'mongoose';
import IndexStatus from '../utils/enums.js';

// Save Page Index Document to Database
import pageIndexSchema from '../models/pageIndexModal.js';
import PageIndexChatMessages from '../models/pageIndexChatMessagesModal.js';

function ensureMongoConnected() {
    if (mongoose.connection.readyState !== 1) {
        const error = new Error('MongoDB is not connected');
        error.statusCode = 503;
        throw error;
    }
}

async function savePageIndexDocument({
    user_id,
    document_id,
    document_name,
    file_size,
    mime_type,
    index_status,
    token_count,
    model_provider,
    model,
    pdf_storage_path,
    pdf_s3_uri,
    pageindex_storage_path,
    pageindex_s3_uri,
    storage_status,
    storage_error_message,
    source,
    hosted_job_id,
    page_count,
}) {
    try {
        const pageIndexDocument = new pageIndexSchema({
            user_id: user_id,
            document_id: document_id,
            document_name: document_name,
            file_size: file_size,
            mime_type: mime_type,
            index_status: index_status,
            token_count: token_count,
            model_provider: model_provider,
            model: model,
            pdf_storage_path,
            pdf_s3_uri,
            pageindex_storage_path,
            pageindex_s3_uri,
            storage_status,
            storage_error_message,
            source,
            hosted_job_id,
            page_count,
        });
        await pageIndexDocument.save();
    } catch (error) {
        console.error('Error saving document metadata:', error);
    }
}

async function createHostedUploadPlaceholderDocument({
    user_id,
    document_id,
    document_name,
    file_size,
    mime_type,
    hosted_job_id,
    pdf_storage_path,
    pdf_s3_uri,
    storage_status,
}) {
    ensureMongoConnected();

    const pageIndexDocument = new pageIndexSchema({
        user_id,
        document_id,
        document_name,
        file_size,
        mime_type,
        index_status: IndexStatus.QUEUED,
        source: 'hosted',
        hosted_job_id,
        pdf_storage_path,
        pdf_s3_uri,
        storage_status,
    });

    return pageIndexDocument.save();
}

async function updateHostedPageIndexDocumentAfterUpload({
    user_id,
    hosted_job_id,
    hosted_pageindex_doc_id,
    document_name,
    file_size,
    mime_type,
    page_count,
    index_status,
}) {
    ensureMongoConnected();

    return pageIndexSchema.findOneAndUpdate(
        { user_id, hosted_job_id, source: 'hosted' },
        {
            $set: {
                document_name,
                file_size,
                mime_type,
                page_count,
                index_status,
                hosted_pageindex_doc_id,
            },
        },
        { new: true },
    );
}

async function updateHostedPageIndexDocumentStatus({
    user_id,
    document_id,
    index_status,
    error_message,
    pageindex_storage_path,
    pageindex_s3_uri,
    page_count,
}) {
    ensureMongoConnected();

    const update = { index_status };
    if (error_message !== undefined) {
        update.error_message = error_message;
    }
    if (pageindex_storage_path !== undefined) {
        update.pageindex_storage_path = pageindex_storage_path;
    }
    if (pageindex_s3_uri !== undefined) {
        update.pageindex_s3_uri = pageindex_s3_uri;
    }
    if (page_count !== undefined) {
        update.page_count = page_count;
    }

    return pageIndexSchema.findOneAndUpdate(
        { user_id, document_id, source: 'hosted' },
        { $set: update },
        { new: true },
    );
}

async function getPageIndexDocumentByOwnerFull({ user_id, document_id }) {
    ensureMongoConnected();

    return pageIndexSchema.findOne({ user_id, document_id });
}

function mapChatMessageForClient(message) {
    return {
        id: message._id.toString(),
        role: message.role,
        content: message.content,
        timestamp: message.createdAt,
        documentId: message.document_id,
        chatModel: message.chat_model,
        tokenCount: message.token_count ?? 0,
        inputTokenCount: message.input_token_count ?? 0,
        outputTokenCount: message.output_token_count ?? 0,
    };
}

async function verifyPageIndexDocumentOwner({ user_id, document_id }) {
    ensureMongoConnected();

    return pageIndexSchema.exists({
        user_id,
        document_id,
    });
}

async function getPageIndexDocumentByOwner({ user_id, document_id }) {
    ensureMongoConnected();

    return pageIndexSchema
        .findOne({ user_id, document_id })
        .select('document_id document_name mime_type pdf_storage_path pdf_s3_uri storage_status createdAt');
}

async function savePageIndexChatMessage({
    user_id,
    document_id,
    previous_message_id = null,
    role,
    content,
    chat_model,
    token_count = 0,
    input_token_count = 0,
    output_token_count = 0,
}) {
    ensureMongoConnected();

    const message = new PageIndexChatMessages({
        user_id,
        document_id,
        previous_message_id,
        role,
        content,
        chat_model,
        token_count,
        input_token_count,
        output_token_count,
    });

    return message.save();
}

async function getPageIndexChatMessages({ user_id, document_id }) {
    ensureMongoConnected();

    return PageIndexChatMessages.find({
        user_id,
        document_id,
    }).sort({ createdAt: 1 });
}

async function deletePageIndexChatMessages({ user_id, document_id }) {
    ensureMongoConnected();

    return PageIndexChatMessages.deleteMany({
        user_id,
        document_id,
    });
}

async function deletePageIndexChatMessageById({ user_id, message_id }) {
    ensureMongoConnected();

    return PageIndexChatMessages.deleteOne({
        user_id,
        _id: message_id,
    });
}

async function deletePageIndexDocument({ user_id, document_id }) {
    ensureMongoConnected();

    return pageIndexSchema.deleteOne({
        user_id,
        document_id,
    });
}

async function getPageIndexDocuments({ user_id }) {
    ensureMongoConnected();

    return pageIndexSchema
        .find({ user_id })
        .sort({ createdAt: -1 })
        .select('document_id document_name file_size mime_type index_status token_count summary page_count pdf_storage_path pdf_s3_uri pageindex_storage_path pageindex_s3_uri storage_status storage_error_message source hosted_job_id hosted_pageindex_doc_id createdAt');
}

async function updatePageIndexDocumentStatus({
    user_id,
    document_id,
    index_status,
    error_message = undefined,
    pdf_storage_path = undefined,
    pdf_s3_uri = undefined,
    pageindex_storage_path = undefined,
    pageindex_s3_uri = undefined,
    storage_status = undefined,
    storage_error_message = undefined,
}) {
    ensureMongoConnected();

    const update = { index_status };
    if (error_message !== undefined) {
        update.error_message = error_message;
    }
    if (pdf_storage_path !== undefined) update.pdf_storage_path = pdf_storage_path;
    if (pdf_s3_uri !== undefined) update.pdf_s3_uri = pdf_s3_uri;
    if (pageindex_storage_path !== undefined) update.pageindex_storage_path = pageindex_storage_path;
    if (pageindex_s3_uri !== undefined) update.pageindex_s3_uri = pageindex_s3_uri;
    if (storage_status !== undefined) update.storage_status = storage_status;
    if (storage_error_message !== undefined) update.storage_error_message = storage_error_message;

    return pageIndexSchema.findOneAndUpdate(
        { user_id, document_id },
        { $set: update },
        { new: true }
    );
}

export {
    savePageIndexDocument,
    createHostedUploadPlaceholderDocument,
    updateHostedPageIndexDocumentAfterUpload,
    updateHostedPageIndexDocumentStatus,
    getPageIndexDocumentByOwnerFull,
    mapChatMessageForClient,
    verifyPageIndexDocumentOwner,
    savePageIndexChatMessage,
    getPageIndexChatMessages,
    deletePageIndexChatMessages,
    deletePageIndexChatMessageById,
    deletePageIndexDocument,
    getPageIndexDocuments,
    getPageIndexDocumentByOwner,
    updatePageIndexDocumentStatus,
};
