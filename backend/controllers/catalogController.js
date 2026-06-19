import {
    findBookInSubject,
    getSubject,
    listSubjectDetails,
    listSubjects,
} from '../helpers/catalogDataHelpers.js';
import {
    buildSignedPdfUrl,
    getPdfSignedUrlExpiresSeconds,
    parseS3Location,
} from './pageIndexController.js';

function setPublicCatalogCacheHeaders(res) {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
}

function isExplicitS3Location(location) {
    const trimmed = String(location || '').trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('s3://')) return true;

    try {
        const parsedUrl = new URL(trimmed);
        const hostParts = parsedUrl.hostname.split('.');
        return parsedUrl.protocol === 'https:'
            && (parsedUrl.hostname.includes('.s3.')
                || parsedUrl.hostname.endsWith('.s3.amazonaws.com')
                || hostParts[0] === 's3'
                || hostParts[0].startsWith('s3-'));
    } catch {
        return false;
    }
}

function getAllowedPublicDownloadBuckets() {
    return new Set(
        [
            process.env.PAGEINDEX_S3_BUCKET,
            process.env.S3_BUCKET,
            process.env.AWS_S3_BUCKET,
            process.env.AWS_S3_BUCKET_NAME,
        ]
            .map((bucket) => String(bucket || '').trim())
            .filter(Boolean)
    );
}

function getFilenameFromS3Key(key) {
    const filename = String(key || '').split('/').filter(Boolean).pop();
    if (!filename) return 'source.pdf';

    try {
        return decodeURIComponent(filename);
    } catch {
        return filename;
    }
}

async function listCatalogSubjects(req, res) {
    try {
        const subjects = await listSubjects();
        return res.json({ status: 200, subjects });
    } catch (error) {
        console.error('Error listing catalog subjects:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to list subjects',
            status: error.statusCode || 500,
        });
    }
}

async function getCatalogSubject(req, res) {
    try {
        const { subjectCode } = req.params;
        const subject = await getSubject(subjectCode);
        return res.json({ status: 200, subject });
    } catch (error) {
        console.error('Error fetching catalog subject:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to fetch subject',
            status: error.statusCode || 500,
        });
    }
}

function mapPublicSubject(subject) {
    return {
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        knownAs: subject.knownAs,
        pageindexStatus: subject.pageindexStatus,
        indexedBookCount: subject.indexedBookCount,
        bookCount: subject.bookCount,
        chatMode: subject.chatMode,
        primaryBookId: subject.primaryBookId,
        syllabus: subject.syllabus,
        paperSolution: subject.paperSolution,
        oldPaper: subject.oldPaper,
        books: (subject.books || []).map((book) => ({
            bookId: book.bookId,
            title: book.title,
            img: book.img,
            altData: book.altData,
            downloadLink: book.downloadLink,
            pageindexStatus: book.pageindexStatus,
        })),
    };
}

function mapPublicSubjectSummary(subject) {
    return {
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        knownAs: subject.knownAs,
        pageindexStatus: subject.pageindexStatus,
        indexedBookCount: subject.indexedBookCount,
        bookCount: subject.bookCount,
    };
}

async function listPublicCatalogSubjects(req, res) {
    try {
        const includeDetails = req.query.include === 'details';
        const subjects = includeDetails ? await listSubjectDetails() : await listSubjects();
        setPublicCatalogCacheHeaders(res);
        return res.json({
            status: 200,
            subjects: subjects.map(includeDetails ? mapPublicSubject : mapPublicSubjectSummary),
        });
    } catch (error) {
        console.error('Error listing public catalog subjects:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to list subjects',
            status: error.statusCode || 500,
        });
    }
}

async function getPublicCatalogSubject(req, res) {
    try {
        const { subjectCode } = req.params;
        const subject = await getSubject(subjectCode);
        setPublicCatalogCacheHeaders(res);
        return res.json({ status: 200, subject: mapPublicSubject(subject) });
    } catch (error) {
        console.error('Error fetching public catalog subject:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to fetch subject',
            status: error.statusCode || 500,
        });
    }
}

async function getPublicCatalogDownloadUrl(req, res) {
    try {
        const location = req.query.url;
        if (typeof location !== 'string' || !location.trim()) {
            return res.status(400).json({
                message: 'Download URL is required.',
                status: 400,
            });
        }

        if (!isExplicitS3Location(location)) {
            return res.status(400).json({
                message: 'Only S3 download URLs can be signed.',
                status: 400,
            });
        }

        const parsedLocation = parseS3Location(location);
        if (!parsedLocation?.bucket || !parsedLocation?.key) {
            return res.status(400).json({
                message: 'S3 download URL is invalid.',
                status: 400,
            });
        }

        const allowedBuckets = getAllowedPublicDownloadBuckets();
        if (allowedBuckets.size === 0) {
            return res.status(503).json({
                message: 'Public download signing is not configured.',
                status: 503,
            });
        }

        if (!allowedBuckets.has(parsedLocation.bucket)) {
            return res.status(403).json({
                message: 'S3 bucket is not allowed for public downloads.',
                status: 403,
            });
        }

        const expiresIn = getPdfSignedUrlExpiresSeconds();
        const url = buildSignedPdfUrl({
            bucket: parsedLocation.bucket,
            key: parsedLocation.key,
            filename: getFilenameFromS3Key(parsedLocation.key),
            expiresIn,
        });

        res.set('Cache-Control', 'private, no-store');
        return res.redirect(302, url);
    } catch (error) {
        console.error('Error creating public catalog download signed URL:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to create download URL',
            status: error.statusCode || 500,
        });
    }
}

async function getCatalogBookPdfUrl(req, res) {
    try {
        const { subjectCode, bookId } = req.params;
        const { book } = await findBookInSubject(subjectCode, bookId);

        const location = book.pdfS3Uri || book.pdfStoragePath;
        if (!location) {
            return res.status(404).json({
                message: 'PDF is not available for this book yet.',
                status: 404,
            });
        }

        const parsedLocation = parseS3Location(location);
        if (!parsedLocation?.bucket || !parsedLocation?.key) {
            return res.status(409).json({
                message: 'PDF storage location is invalid for this book.',
                status: 409,
            });
        }

        const expiresIn = getPdfSignedUrlExpiresSeconds();
        const url = buildSignedPdfUrl({
            bucket: parsedLocation.bucket,
            key: parsedLocation.key,
            filename: `${book.title || bookId}.pdf`,
            expiresIn,
        });

        return res.json({ status: 200, url, expiresIn, bookId });
    } catch (error) {
        console.error('Error creating catalog PDF signed URL:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to create PDF view URL',
            status: error.statusCode || 500,
        });
    }
}

export {
    listCatalogSubjects,
    listPublicCatalogSubjects,
    getCatalogSubject,
    getPublicCatalogSubject,
    getPublicCatalogDownloadUrl,
    getCatalogBookPdfUrl,
};
