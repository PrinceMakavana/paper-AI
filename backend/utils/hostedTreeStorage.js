const s3Storage = require('./s3Storage');

async function saveHostedTreeJson({ user_id, document_id, tree }) {
    const storage = await s3Storage.uploadPageIndexJson(tree, user_id, document_id);

    return {
        pageindex_storage_path: storage.storage_path,
        pageindex_s3_uri: storage.s3_uri,
    };
}

async function loadHostedTreeJson({ pageindex_s3_uri, pageindex_storage_path } = {}) {
    if (!pageindex_s3_uri && !pageindex_storage_path) {
        return null;
    }

    return s3Storage.downloadJson({
        s3Uri: pageindex_s3_uri,
        storagePath: pageindex_storage_path,
    });
}

module.exports = {
    saveHostedTreeJson,
    loadHostedTreeJson,
};
