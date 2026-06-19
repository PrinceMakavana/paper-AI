import { test } from 'tap';
import {
    buildCatalogObjectKey,
    buildObjectKey,
    parseS3Uri,
    resolveObjectLocation,
} from '../utils/s3Storage.js';

test('buildObjectKey uses pageindex prefix and sanitized path parts', (t) => {
    const originalPrefix = process.env.AWS_S3_PREFIX;
    process.env.AWS_S3_PREFIX = 'pageindex';

    t.equal(
        buildObjectKey('user/1', 'doc/2', 'source.pdf'),
        'pageindex/user-1/doc-2/source.pdf',
    );
    t.equal(
        buildObjectKey('6a1ff4cce22bcbc7b53d5d2', '289488a7-07b4-4020-a487-3b63b49ed5c7', 'page_index.json'),
        'pageindex/6a1ff4cce22bcbc7b53d5d2/289488a7-07b4-4020-a487-3b63b49ed5c7/page_index.json',
    );

    if (originalPrefix === undefined) {
        delete process.env.AWS_S3_PREFIX;
    } else {
        process.env.AWS_S3_PREFIX = originalPrefix;
    }

    t.end();
});

test('buildCatalogObjectKey uses catalog path and sanitized parts', (t) => {
    const originalPrefix = process.env.AWS_S3_PREFIX;
    process.env.AWS_S3_PREFIX = 'pageindex';

    t.equal(
        buildCatalogObjectKey('311/0005', 'paper_solution', 'Summer 2024', 'paper solution.pdf'),
        'pageindex/catalog/311-0005/paper_solution/Summer 2024/paper solution.pdf',
    );

    if (originalPrefix === undefined) {
        delete process.env.AWS_S3_PREFIX;
    } else {
        process.env.AWS_S3_PREFIX = originalPrefix;
    }

    t.end();
});

test('parseS3Uri extracts bucket and key', (t) => {
    t.same(parseS3Uri('s3://pageindex-json-store/pageindex/user/doc/source.pdf'), {
        bucket: 'pageindex-json-store',
        key: 'pageindex/user/doc/source.pdf',
    });
    t.equal(parseS3Uri('not-s3'), null);
    t.end();
});

test('resolveObjectLocation prefers s3 uri over storage path', (t) => {
    const originalBucket = process.env.PAGEINDEX_S3_BUCKET;
    process.env.PAGEINDEX_S3_BUCKET = 'pageindex-json-store';

    t.same(
        resolveObjectLocation({
            s3Uri: 's3://pageindex-json-store/pageindex/user/doc/page_index.json',
            storagePath: 'ignored/key.json',
        }),
        {
            bucket: 'pageindex-json-store',
            key: 'pageindex/user/doc/page_index.json',
        },
    );

    t.same(
        resolveObjectLocation({
            storagePath: 'pageindex/user/doc/source.pdf',
        }),
        {
            bucket: 'pageindex-json-store',
            key: 'pageindex/user/doc/source.pdf',
        },
    );

    if (originalBucket === undefined) {
        delete process.env.PAGEINDEX_S3_BUCKET;
    } else {
        process.env.PAGEINDEX_S3_BUCKET = originalBucket;
    }

    t.end();
});
