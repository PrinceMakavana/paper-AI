const { test } = require('tap');
const { loadHostedTreeJson } = require('../utils/hostedTreeStorage');
const s3Storage = require('../utils/s3Storage');

test('loadHostedTreeJson returns null when no storage location is provided', async (t) => {
    const tree = await loadHostedTreeJson({});
    t.equal(tree, null);
    t.end();
});

test('loadHostedTreeJson downloads tree using pageindex_s3_uri', async (t) => {
    const originalDownloadJson = s3Storage.downloadJson;
    let received = null;

    s3Storage.downloadJson = async (location) => {
        received = location;
        return [{ title: 'Chapter 1' }];
    };

    try {
        const tree = await loadHostedTreeJson({
            pageindex_s3_uri: 's3://pageindex-json-store/pageindex/user/doc/page_index.json',
            pageindex_storage_path: 'pageindex/user/doc/page_index.json',
        });

        t.same(received, {
            s3Uri: 's3://pageindex-json-store/pageindex/user/doc/page_index.json',
            storagePath: 'pageindex/user/doc/page_index.json',
        });
        t.same(tree, [{ title: 'Chapter 1' }]);
    } finally {
        s3Storage.downloadJson = originalDownloadJson;
    }

    t.end();
});
