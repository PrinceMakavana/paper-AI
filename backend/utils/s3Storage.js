const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
dotenv.config();
const PDF_CONTENT_TYPE = 'application/pdf';
const JSON_CONTENT_TYPE = 'application/json';

function getBucketName() {
    const bucket = (
        process.env.AWS_S3_BUCKET_NAME
        || process.env.S3_BUCKET
        || process.env.AWS_S3_BUCKET
        || ''
    ).trim();
    if (!bucket) {
        const error = new Error('s3 bucket is required for S3 storage.');
        error.statusCode = 500;
        throw error;
    }
    return bucket;
}

function getPrefix() {
    const prefix = (process.env.AWS_S3_PREFIX || 'pageindex').trim().replace(/^\/+|\/+$/g, '');
    return prefix || 'pageindex';
}

function getRegion() {
    return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
}

function safePathPart(value, fallback) {
    const clean = String(value || fallback).trim().replace(/[\\/]/g, '-');
    return clean || fallback;
}

function buildObjectKey(userId, documentId, filename) {
    const safeUserId = safePathPart(userId, 'anonymous');
    const safeDocId = safePathPart(documentId, 'document');
    return `${getPrefix()}/${safeUserId}/${safeDocId}/${filename}`;
}

function getS3Client() {
    return new S3Client({ region: getRegion() });
}

function parseS3Uri(s3Uri) {
    if (!s3Uri || !String(s3Uri).startsWith('s3://')) {
        return null;
    }
    const withoutProtocol = String(s3Uri).slice('s3://'.length);
    const slashIndex = withoutProtocol.indexOf('/');
    if (slashIndex <= 0) {
        return null;
    }
    return {
        bucket: withoutProtocol.slice(0, slashIndex),
        key: withoutProtocol.slice(slashIndex + 1),
    };
}

function resolveObjectLocation({ s3Uri, storagePath }) {
    const parsed = parseS3Uri(s3Uri);
    if (parsed?.bucket && parsed?.key) {
        return parsed;
    }

    const key = String(storagePath || '').trim().replace(/^\/+/, '');
    if (!key) {
        return null;
    }

    return {
        bucket: getBucketName(),
        key,
    };
}

async function uploadBytes(buffer, objectKey, contentType) {
    const bucket = getBucketName();
    const client = getS3Client();

    await client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            Body: buffer,
            ContentType: contentType,
        }),
    );

    return {
        storage_path: objectKey,
        s3_uri: `s3://${bucket}/${objectKey}`,
    };
}

async function uploadJson(payload, objectKey) {
    const data = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
    return uploadBytes(data, objectKey, JSON_CONTENT_TYPE);
}

async function uploadPdf(buffer, userId, documentId) {
    const objectKey = buildObjectKey(userId, documentId, 'source.pdf');
    return uploadBytes(buffer, objectKey, PDF_CONTENT_TYPE);
}

async function uploadPageIndexJson(tree, userId, documentId) {
    const objectKey = buildObjectKey(userId, documentId, 'page_index.json');
    return uploadJson(tree, objectKey);
}

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

async function downloadJson({ s3Uri, storagePath }) {
    const location = resolveObjectLocation({ s3Uri, storagePath });
    if (!location?.bucket || !location?.key) {
        const error = new Error('S3 object location is not available.');
        error.statusCode = 404;
        throw error;
    }

    const client = getS3Client();
    const response = await client.send(
        new GetObjectCommand({
            Bucket: location.bucket,
            Key: location.key,
        }),
    );

    const buffer = await streamToBuffer(response.Body);
    return JSON.parse(buffer.toString('utf8'));
}

async function deleteObjectsByLocation(locations) {
    const bucket = getBucketName();
    const keys = [];

    for (const location of locations) {
        const resolved = resolveObjectLocation(location);
        if (resolved?.bucket === bucket && resolved?.key) {
            keys.push(resolved.key);
        }
    }

    const uniqueKeys = [...new Set(keys)];
    if (!uniqueKeys.length) {
        return { deletedCount: 0 };
    }

    const client = getS3Client();
    await client.send(
        new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
                Objects: uniqueKeys.map((Key) => ({ Key })),
                Quiet: true,
            },
        }),
    );

    return { deletedCount: uniqueKeys.length };
}

module.exports = {
    PDF_CONTENT_TYPE,
    JSON_CONTENT_TYPE,
    buildObjectKey,
    uploadBytes,
    uploadJson,
    uploadPdf,
    uploadPageIndexJson,
    downloadJson,
    deleteObjectsByLocation,
    resolveObjectLocation,
    parseS3Uri,
};
