import {
    findBookInSubject,
    getSubject,
    listSubjectDetails,
    listSubjects,
    mapMaterialFilesForClient,
} from '../helpers/catalogDataHelpers.js';
import CatalogSubject from '../models/catalogSubjectModel.js';
import {
    buildCatalogObjectKey,
    PDF_CONTENT_TYPE,
    uploadBytes,
} from '../utils/s3Storage.js';
import {
    buildSignedPdfUrl,
    getPdfSignedUrlExpiresSeconds,
    parseS3Location,
    validatePdfFile,
} from './pageIndexController.js';

const SUBJECT_MATERIAL_FIELDS = {
    syllabus: { field: 'syllabus', label: 'Syllabus' },
    paper_solution: { field: 'paper_solution', label: 'Paper solution' },
    prectical: { field: 'prectical', label: 'Practical' },
    viva_questions: { field: 'viva_questions', label: 'Viva questions' },
    imp_material: { field: 'imp_material', label: 'Important material' },
    assignments: { field: 'assignments', label: 'Assignment' },
};

const CONTENT_TYPES = new Set([
    'book',
    'old_paper',
    ...Object.keys(SUBJECT_MATERIAL_FIELDS),
]);

const UPLOAD_SOURCES = new Set(['file', 'link']);

function trimBodyValue(value) {
    return String(value || '').trim();
}

function buildHttpError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function slugPart(value, fallback) {
    return trimBodyValue(value)
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        || fallback;
}

function validateFileLink(value) {
    const fileLink = trimBodyValue(value);
    if (!fileLink) {
        throw buildHttpError('File link is required.');
    }

    try {
        const parsedUrl = new URL(fileLink);
        if (!['http:', 'https:', 's3:'].includes(parsedUrl.protocol)) {
            throw buildHttpError('File link must use http, https, or s3.');
        }
    } catch (error) {
        if (error?.statusCode) throw error;
        throw buildHttpError('File link must be a valid URL.');
    }

    return fileLink;
}

function getLinkedFilename(fileLink) {
    try {
        const parsedUrl = new URL(fileLink);
        const pathname = parsedUrl.protocol === 's3:'
            ? `${parsedUrl.hostname}${parsedUrl.pathname}`
            : parsedUrl.pathname;
        const filename = pathname.split('/').filter(Boolean).pop();
        return filename ? decodeURIComponent(filename) : 'linked-file.pdf';
    } catch {
        return 'linked-file.pdf';
    }
}

function buildLinkedMaterialFile({ fileLink, title, contentType, uploadedAt }) {
    const isS3Link = fileLink.startsWith('s3://');
    return {
        title: trimBodyValue(title) || getLinkedFilename(fileLink) || contentType,
        original_name: getLinkedFilename(fileLink),
        storage_path: isS3Link ? '' : fileLink,
        s3_uri: isS3Link ? fileLink : '',
        upload_source: 'link',
        uploaded_at: uploadedAt,
    };
}

function getStoredFileLocation(file) {
    return trimBodyValue(file?.s3_uri) || trimBodyValue(file?.storage_path);
}

function normalizeStoredMaterialFiles(value, fallbackTitle) {
    return mapMaterialFilesForClient(value, fallbackTitle).map((file) => ({
        title: file.title,
        original_name: file.originalName,
        storage_path: file.storagePath,
        s3_uri: file.s3Uri,
        uploaded_at: file.uploadedAt,
    }));
}

function countReadyBooksForUpdate(books = []) {
    return books.filter((book) => book.pageindex_status === 'ready' && book.pageindex_s3_uri).length;
}

function resolveSubjectStatusForUpdate(readyCount, bookCount) {
    if (bookCount === 0 || readyCount === 0) return 'pending';
    if (readyCount >= bookCount) return 'ready';
    return 'partial';
}

function buildCatalogContentUpdate(subject, { contentType, body, uploadedFiles }) {
    if (SUBJECT_MATERIAL_FIELDS[contentType]) {
        const { field, label } = SUBJECT_MATERIAL_FIELDS[contentType];
        const currentFiles = normalizeStoredMaterialFiles(subject[field], label);
        return {
            [`$set`]: {
                [field]: [...currentFiles, ...uploadedFiles],
            },
        };
    }

    if (contentType === 'old_paper') {
        const year = trimBodyValue(body.year);
        if (!year) {
            throw buildHttpError('Old paper year is required.');
        }

        const existingPapers = Array.isArray(subject.old_paper) ? [...subject.old_paper] : [];
        if (uploadedFiles.length === 1) {
            const existingIndex = existingPapers.findIndex((paper) => trimBodyValue(paper?.year) === year);
            if (existingIndex >= 0) {
                existingPapers[existingIndex] = {
                    ...existingPapers[existingIndex],
                    year,
                    link: getStoredFileLocation(uploadedFiles[0]),
                };
                return { $set: { old_paper: existingPapers } };
            }
        }

        return {
            $set: {
                old_paper: [
                    ...existingPapers,
                    ...uploadedFiles.map((file) => ({
                        year,
                        link: getStoredFileLocation(file),
                    })),
                ],
            },
        };
    }

    if (contentType === 'book') {
        const subjectCode = trimBodyValue(subject.subjecet_code || subject.subject_code || body.subjectCode);
        const bookId = trimBodyValue(body.bookId);
        if (!bookId) {
            throw buildHttpError('Book ID is required.');
        }
        if (uploadedFiles.length !== 1) {
            throw buildHttpError('Book upload requires exactly one PDF file.');
        }

        const existingBooks = Array.isArray(subject.Books)
            ? [...subject.Books]
            : Array.isArray(subject.books)
                ? [...subject.books]
                : [];
        const existingIndex = existingBooks.findIndex((book, index) => (
            trimBodyValue(book?.book_id || `${subjectCode}-${index}`) === bookId
        ));
        const existingBook = existingIndex >= 0 ? existingBooks[existingIndex] : {};
        const uploadedFile = uploadedFiles[0];
        const updatedBook = {
            ...existingBook,
            book_id: bookId,
            title: trimBodyValue(body.title) || existingBook.title || bookId,
            img: trimBodyValue(body.img) || existingBook.img,
            download_link: trimBodyValue(body.downloadLink)
                || (uploadedFile.upload_source === 'link' ? getStoredFileLocation(uploadedFile) : '')
                || existingBook.download_link,
            alt_data: trimBodyValue(body.altData) || existingBook.alt_data,
            pdf_storage_path: uploadedFile.storage_path,
            pdf_s3_uri: uploadedFile.s3_uri,
            pageindex_status: 'pending',
        };

        const books = [...existingBooks];
        if (existingIndex >= 0) {
            books[existingIndex] = updatedBook;
        } else {
            books.push(updatedBook);
        }

        const readyCount = countReadyBooksForUpdate(books);
        return {
            $set: {
                books,
                indexed_book_count: readyCount,
                pageindex_status: resolveSubjectStatusForUpdate(readyCount, books.length),
            },
        };
    }

    throw buildHttpError('Unsupported content type.');
}

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

async function listAdminCatalogSubjects(req, res) {
    try {
        const subjects = await listSubjectDetails();
        return res.json({
            status: 200,
            subjects,
            total: subjects.length,
        });
    } catch (error) {
        console.error('Error listing admin catalog subjects:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to list admin subjects',
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
        prectical: subject.prectical,
        vivaQuestions: subject.vivaQuestions,
        impMaterial: subject.impMaterial,
        assignments: subject.assignments,
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

async function uploadAdminCatalogContent(req, res) {
    try {
        const subjectCode = trimBodyValue(req.params.subjectCode);
        const contentType = trimBodyValue(req.body.contentType);
        const uploadSource = trimBodyValue(req.body.uploadSource) || 'file';
        const fileLink = trimBodyValue(req.body.fileLink);
        const files = Array.isArray(req.files) ? req.files : [];

        if (!subjectCode) {
            return res.status(400).json({ status: 400, message: 'Subject code is required.' });
        }
        if (!CONTENT_TYPES.has(contentType)) {
            return res.status(400).json({ status: 400, message: 'Valid content type is required.' });
        }
        if (!UPLOAD_SOURCES.has(uploadSource)) {
            return res.status(400).json({ status: 400, message: 'Upload file type must be file or link.' });
        }
        if (uploadSource === 'file' && files.length === 0) {
            return res.status(400).json({ status: 400, message: 'At least one PDF file is required.' });
        }
        if (uploadSource === 'link' && !fileLink) {
            return res.status(400).json({ status: 400, message: 'File link is required.' });
        }
        if (uploadSource === 'link' && files.length > 0) {
            return res.status(400).json({ status: 400, message: 'Choose either PDF files or a file link, not both.' });
        }
        if (uploadSource === 'file' && fileLink) {
            return res.status(400).json({ status: 400, message: 'Choose either PDF files or a file link, not both.' });
        }
        if ((contentType === 'book' || contentType === 'old_paper') && uploadSource === 'file' && files.length !== 1) {
            return res.status(400).json({
                status: 400,
                message: `${contentType === 'book' ? 'Book' : 'Old paper'} upload requires exactly one PDF file.`,
            });
        }
        if (contentType === 'book' && !trimBodyValue(req.body.bookId)) {
            return res.status(400).json({ status: 400, message: 'Book ID is required.' });
        }
        if (contentType === 'old_paper' && !trimBodyValue(req.body.year)) {
            return res.status(400).json({ status: 400, message: 'Old paper year is required.' });
        }

        const subject = await CatalogSubject.findOne({
            $or: [{ subjecet_code: subjectCode }, { subject_code: subjectCode }],
        }).lean();

        if (!subject) {
            return res.status(404).json({
                status: 404,
                message: `Subject not found: ${subjectCode}`,
            });
        }

        if (uploadSource === 'file') {
            for (const file of files) {
                try {
                    const validation = await validatePdfFile(file);
                    if (!validation.success) {
                        return res.status(400).json({
                            status: 400,
                            message: validation.message || 'Invalid PDF file.',
                        });
                    }
                } catch (error) {
                    return res.status(400).json({
                        status: 400,
                        message: error instanceof Error ? error.message : 'Invalid PDF file.',
                    });
                }
            }
        } else {
            try {
                validateFileLink(fileLink);
            } catch (error) {
                return res.status(400).json({
                    status: 400,
                    message: error instanceof Error ? error.message : 'Invalid file link.',
                });
            }
        }

        const uploadedAt = new Date().toISOString();
        const contentId = slugPart(
            req.body.bookId || req.body.year || req.body.title || `${uploadedAt}-${uploadSource === 'file' ? files.length : 1}`,
            'content'
        );
        const uploadedFiles = [];

        if (uploadSource === 'file') {
            for (const [index, file] of files.entries()) {
                const objectKey = buildCatalogObjectKey(
                    subjectCode,
                    contentType,
                    `${contentId}-${index + 1}`,
                    file.originalname || 'source.pdf'
                );
                const uploadResult = await uploadBytes(file.buffer, objectKey, PDF_CONTENT_TYPE);
                uploadedFiles.push({
                    title: trimBodyValue(req.body.title) || file.originalname || contentType,
                    original_name: file.originalname || 'source.pdf',
                    storage_path: uploadResult.storage_path,
                    s3_uri: uploadResult.s3_uri,
                    uploaded_at: uploadedAt,
                });
            }
        } else {
            const validFileLink = validateFileLink(fileLink);
            uploadedFiles.push({
                ...buildLinkedMaterialFile({
                    fileLink: validFileLink,
                    title: req.body.title,
                    contentType,
                    uploadedAt,
                }),
            });
        }

        const update = buildCatalogContentUpdate(subject, {
            contentType,
            body: { ...req.body, subjectCode },
            uploadedFiles,
        });

        await CatalogSubject.updateOne(
            { _id: subject._id },
            update,
            { runValidators: true }
        );

        const updatedSubject = await getSubject(subjectCode);
        return res.status(201).json({
            status: 201,
            subject: updatedSubject,
            uploadedFiles: uploadedFiles.map((file) => ({
                title: file.title,
                originalName: file.original_name,
                storagePath: file.storage_path,
                s3Uri: file.s3_uri,
                url: getStoredFileLocation(file),
                uploadedAt: file.uploaded_at,
            })),
        });
    } catch (error) {
        console.error('Error uploading admin catalog content:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to upload catalog content',
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
    listAdminCatalogSubjects,
    listCatalogSubjects,
    listPublicCatalogSubjects,
    getCatalogSubject,
    getPublicCatalogSubject,
    getPublicCatalogDownloadUrl,
    getCatalogBookPdfUrl,
    uploadAdminCatalogContent,
    buildCatalogContentUpdate,
};
