import { test } from 'tap';

test('loadHostedTreeJson returns null when no storage location is provided', async (t) => {
    const { loadHostedTreeJson } = await import('../utils/hostedTreeStorage.js');
    const tree = await loadHostedTreeJson({});
    t.equal(tree, null);
    t.end();
});

test('loadHostedTreeJson downloads tree using pageindex_s3_uri', async (t) => {
    let received = null;

    const { loadHostedTreeJson } = await t.mockImport('../utils/hostedTreeStorage.js', {
        '../utils/s3Storage.js': {
            downloadJson: async (location) => {
                received = location;
                return [{ title: 'Chapter 1' }];
            },
        },
    });

    const tree = await loadHostedTreeJson({
        pageindex_s3_uri: 's3://pageindex-json-store/pageindex/user/doc/page_index.json',
        pageindex_storage_path: 'pageindex/user/doc/page_index.json',
    });

    t.same(received, {
        s3Uri: 's3://pageindex-json-store/pageindex/user/doc/page_index.json',
        storagePath: 'pageindex/user/doc/page_index.json',
    });
    t.same(tree, [{ title: 'Chapter 1' }]);
    t.end();
});
