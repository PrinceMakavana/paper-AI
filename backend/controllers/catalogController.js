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
    getCatalogBookPdfUrl,
};
