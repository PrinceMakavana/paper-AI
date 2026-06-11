import * as s3Storage from './s3Storage.js';

async function saveHostedTreeJson({ user_id, document_id, tree }) {
    const storage = await s3Storage.uploadPageIndexJson(tree, user_id, document_id);

    return {
        pageindex_s3_uri: storage.s3_uri,
    };
}

async function loadHostedTreeJson({ pageindex_s3_uri } = {}) {
    if (!pageindex_s3_uri) {
        return null;
    }

    return s3Storage.downloadJson({
        s3Uri: pageindex_s3_uri,
    });
}

export {
    saveHostedTreeJson,
    loadHostedTreeJson,
};
